# Intelligence Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/intelligence` placeholder stub with a working three-phase chat surface (home → thinking → response) that consumes Plan 1's SSE chat endpoint via `api.chatStream()` and renders a transparent reasoning trace, citations, and an evaluation score — matching the merris-platform-7 prototype's Intelligence page.

**Architecture:** A client-side `IntelligenceView` orchestrator drives a Zustand `chat-store` through three phases. Phase transitions are triggered by SSE events from `api.chatStream()`. The store exposes ordered `thinkingSteps`, the latest `tokenText`, citations, and evaluation. Pure-presentational subcomponents read from the store. New code lives under `apps/web/components/intelligence/` and `apps/web/lib/chat-store.ts`. The existing `app/(dashboard)/intelligence/page.tsx` placeholder is replaced by a thin Server Component that renders `<IntelligenceView />`.

**Tech Stack:** Next.js 14 app router, React 18 client components, Zustand, Tailwind CSS, the existing `apps/web/components/merris/*` primitives, the typed `api.chatStream()` from Plan 2 Task 19, the `StreamEvent` types from `@merris/shared`.

---

## Context for the Implementer

**Read first, in this order:**

1. `merris-platform-7.html` — particularly the `Intel` component on lines 103–135. It has three phases controlled by a `ph` state: `home` (hero with chat input), `think` (vertical timeline of thinking steps with the active question shown above), `chat` (response with M avatar, confidence pill, score ring, response card with teal left border, SASB/Materiality stats, sources cited). Note: the prototype shows 7 thinking steps but the backend emits 6 (no `Checking precedent`); align with the backend.
2. `apps/web/lib/api.ts` — find the `ChatRequestPayload` interface and the `chatStream(payload, onEvent)` method. This is the SSE consumer you call from the store.
3. `packages/shared/src/stream-events.ts` — the `StreamEvent` discriminated union. Phase ordering for `ThinkingStepName`: `'Assessing query' | 'Searching context' | 'Retrieving intelligence' | 'Analyzing' | 'Evaluating quality' | 'Answering'`.
4. `apps/web/components/merris/*` — the existing primitives. You will use `MerrisCard`, `MerrisButton`, `Pill`, `Chip`, `ScoreRing`, `SectionLabel`. Don't reach into `components/ui/*` (shadcn primitives) for anything except where the merris/* doesn't have a primitive.
5. `apps/web/lib/store.ts` — existing Zustand auth store. Match the same library version and style for the new chat store.
6. `apps/web/lib/design-tokens.ts` — TS mirror of CSS variables. Use for inline styles where Tailwind utility classes aren't enough (rare).

**Backend behaviour to be aware of:**

- `chatStream` emits a single `token` event with the full response text (not progressive). The frontend can render it instantly when it arrives.
- `thinking_sources` event is emitted DURING the `Retrieving intelligence` phase, before that phase's `done`. The store should attach those sources to the `Retrieving intelligence` step.
- `sources` event (the citations) is emitted during `Answering`, after `token`.
- `evaluation` event is also emitted during `Answering`.
- Hard-block path: `chatStream` may emit a `'BLOCK'` decision in the `evaluation` event with a synthetic `score: 0` and a token containing a warning string. The UI should detect `decision === 'BLOCK'` and show a refusal-style message rather than the normal advisory layout.
- Error path: any phase failure emits an `error` event followed by `done`. The UI should show the error and let the user retry.
- The current implementation emits a single `token` event for the whole response. Token streaming (incremental tokens) is a future improvement; this plan doesn't depend on it.

**Out of scope for this plan (deferred):**

- Multi-turn conversation (only single-turn for MVP — each new query starts fresh)
- Document context (`documentBody`, `cursorSection`)
- @ mention attachments
- Mic input
- The Quantitative, Findings, and Refusal response archetypes (the backend doesn't yet emit different response shapes; one Advisory archetype handles all responses for now, with the Refusal archetype only triggered by `decision === 'BLOCK'`)
- Unit tests (web app has no test setup; manual smoke test at the end)
- The `Sector ▾`, `Vault ▾`, `Entity ▾` dropdowns (they're inert in the prototype too — hold space for future filters)
- Suggested workflow agents grid below the chat input (cosmetic; defer to Plan 5)

---

## File Structure (end state)

```
apps/web/
├── app/(dashboard)/intelligence/page.tsx       (replaced — thin Server Component)
├── components/intelligence/
│   ├── intelligence-view.tsx                    (3-phase orchestrator, client component)
│   ├── intelligence-hero.tsx                    (home phase: headline + context controls + chat input)
│   ├── jurisdiction-chips.tsx                   (Qatar/Oman/UAE/Saudi/EU/UK toggleable chips)
│   ├── source-toggles.tsx                       (K1..K7 + Web toggleable pills)
│   ├── chat-input.tsx                           (textarea + send button card)
│   ├── working-header.tsx                       (M avatar + active-phase pill, used in thinking phase)
│   ├── thinking-state.tsx                       (vertical timeline of phase circles)
│   ├── advisory-response.tsx                    (response renderer: text + score ring + citations)
│   ├── refusal-response.tsx                     (BLOCK decision: cannot comply + alternative)
│   └── citations-list.tsx                       (renders citation cards/chips)
└── lib/
    └── chat-store.ts                             (Zustand store: phase, thinkingSteps, tokenText, citations, evaluation, jurisdiction, knowledgeSources)
```

11 new files plus 1 file replacement (`page.tsx`).

---

## Constants (used in multiple files)

```ts
// Jurisdictions, in display order
export const JURISDICTIONS = ['Qatar', 'Oman', 'UAE', 'Saudi', 'EU', 'UK'] as const;

// Knowledge collections, in display order. Backend keys are the K-codes.
export const KNOWLEDGE_SOURCES = [
  { key: 'K1', label: 'K1 Disclosures' },
  { key: 'K2', label: 'K2 Market' },
  { key: 'K3', label: 'K3 Regulatory' },
  { key: 'K4', label: 'K4 Finance' },
  { key: 'K5', label: 'K5 Peers' },
  { key: 'K6', label: 'K6 Climate' },
  { key: 'K7', label: 'K7 Research' },
] as const;
```

These can either live in a tiny shared file (e.g., `apps/web/lib/intelligence-constants.ts`) or be inlined into each consuming component. The plan uses a shared file to avoid duplication.

---

## Task 1: Chat Store

**Files:**
- Create: `apps/web/lib/chat-store.ts`
- Create: `apps/web/lib/intelligence-constants.ts`

`apps/web/lib/intelligence-constants.ts`:

```ts
export const JURISDICTIONS = ['Qatar', 'Oman', 'UAE', 'Saudi', 'EU', 'UK'] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const KNOWLEDGE_SOURCES = [
  { key: 'K1', label: 'K1 Disclosures' },
  { key: 'K2', label: 'K2 Market' },
  { key: 'K3', label: 'K3 Regulatory' },
  { key: 'K4', label: 'K4 Finance' },
  { key: 'K5', label: 'K5 Peers' },
  { key: 'K6', label: 'K6 Climate' },
  { key: 'K7', label: 'K7 Research' },
] as const;

export type KnowledgeSourceKey = (typeof KNOWLEDGE_SOURCES)[number]['key'];

// The six thinking phases the backend emits, in order. Mirrors
// ThinkingStepName from @merris/shared.
export const THINKING_PHASES = [
  'Assessing query',
  'Searching context',
  'Retrieving intelligence',
  'Analyzing',
  'Evaluating quality',
  'Answering',
] as const;
```

`apps/web/lib/chat-store.ts`:

```ts
import { create } from 'zustand';
import type { StreamEvent, CitationItem } from '@merris/shared';
import { THINKING_PHASES } from './intelligence-constants';
import { api } from './api';

export type ChatPhase = 'home' | 'thinking' | 'response';

export interface ThinkingStepState {
  step: (typeof THINKING_PHASES)[number];
  status: 'pending' | 'active' | 'done' | 'failed';
  detail?: string;
  sources?: string[];
}

export interface EvaluationState {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  decision?: string;
}

interface ChatState {
  // input/context
  jurisdiction: string[];          // active codes
  knowledgeSources: string[];      // active K-codes (e.g., ['K1','K7'])
  engagementId: string;            // selected engagement; placeholder for now

  // current run
  phase: ChatPhase;
  question: string;                // the most recent submitted question
  thinkingSteps: ThinkingStepState[];
  tokenText: string;
  citations: CitationItem[];
  evaluation: EvaluationState | null;
  errorMessage: string | null;

  // actions
  toggleJurisdiction: (j: string) => void;
  toggleKnowledgeSource: (k: string) => void;
  setEngagementId: (id: string) => void;
  startQuery: (question: string) => Promise<void>;
  reset: () => void;
}

const initialThinkingSteps = (): ThinkingStepState[] =>
  THINKING_PHASES.map((step) => ({ step, status: 'pending' }));

export const useChatStore = create<ChatState>((set, get) => ({
  jurisdiction: ['Qatar'],
  knowledgeSources: ['K1', 'K7'],
  engagementId: '000000000000000000000000', // placeholder ObjectId; real one comes from engagement selector

  phase: 'home',
  question: '',
  thinkingSteps: initialThinkingSteps(),
  tokenText: '',
  citations: [],
  evaluation: null,
  errorMessage: null,

  toggleJurisdiction: (j) =>
    set((s) => ({
      jurisdiction: s.jurisdiction.includes(j)
        ? s.jurisdiction.filter((x) => x !== j)
        : [...s.jurisdiction, j],
    })),

  toggleKnowledgeSource: (k) =>
    set((s) => ({
      knowledgeSources: s.knowledgeSources.includes(k)
        ? s.knowledgeSources.filter((x) => x !== k)
        : [...s.knowledgeSources, k],
    })),

  setEngagementId: (id) => set({ engagementId: id }),

  startQuery: async (question) => {
    set({
      phase: 'thinking',
      question,
      thinkingSteps: initialThinkingSteps(),
      tokenText: '',
      citations: [],
      evaluation: null,
      errorMessage: null,
    });

    const { engagementId, jurisdiction, knowledgeSources } = get();

    try {
      await api.chatStream(
        {
          engagementId,
          message: question,
          jurisdiction: jurisdiction.join(','),
          knowledgeSources,
        },
        (event: StreamEvent) => {
          handleEvent(event, set, get);
        },
      );
    } catch (err) {
      set({
        phase: 'response',
        errorMessage: err instanceof Error ? err.message : 'Unknown stream error',
      });
    }
  },

  reset: () =>
    set({
      phase: 'home',
      question: '',
      thinkingSteps: initialThinkingSteps(),
      tokenText: '',
      citations: [],
      evaluation: null,
      errorMessage: null,
    }),
}));

// ----- Pure event reducer -----
// Extracted into a function so it can be unit-tested independently when
// the web app gains test infrastructure.
function handleEvent(
  event: StreamEvent,
  set: (partial: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>)) => void,
  _get: () => ChatState,
) {
  switch (event.type) {
    case 'thinking_step': {
      set((s) => ({
        thinkingSteps: s.thinkingSteps.map((step) =>
          step.step === event.step
            ? {
                ...step,
                status: event.status === 'done'
                  ? (event.detail === 'failed' ? 'failed' : 'done')
                  : 'active',
                detail: event.detail ?? step.detail,
              }
            : step,
        ),
      }));
      break;
    }
    case 'thinking_sources': {
      set((s) => ({
        thinkingSteps: s.thinkingSteps.map((step) =>
          step.step === 'Retrieving intelligence'
            ? { ...step, sources: event.sources }
            : step,
        ),
      }));
      break;
    }
    case 'token': {
      set({ tokenText: event.text });
      break;
    }
    case 'sources': {
      set({ citations: event.citations });
      break;
    }
    case 'evaluation': {
      set({
        evaluation: {
          score: event.score,
          confidence: event.confidence,
          decision: event.decision,
        },
      });
      break;
    }
    case 'error': {
      set({ errorMessage: event.message });
      break;
    }
    case 'done': {
      set({ phase: 'response' });
      break;
    }
  }
}
```

- [ ] **Step 1: Create both files with the exact contents above.**
- [ ] **Step 2: Run `pnpm --filter @merris/web build`** — should pass; the store is wired but no consumer exists yet.
- [ ] **Step 3: Commit:**

```bash
git add apps/web/lib/intelligence-constants.ts apps/web/lib/chat-store.ts
git commit -m "feat(web): add Zustand chat store consuming SSE StreamEvents"
```

---

## Task 2: JurisdictionChips

**Files:** Create `apps/web/components/intelligence/jurisdiction-chips.tsx`

```tsx
'use client';

import { Chip } from '@/components/merris/chip';
import { useChatStore } from '@/lib/chat-store';
import { JURISDICTIONS } from '@/lib/intelligence-constants';

export function JurisdictionChips() {
  const jurisdiction = useChatStore((s) => s.jurisdiction);
  const toggle = useChatStore((s) => s.toggleJurisdiction);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {JURISDICTIONS.map((j) => (
        <Chip key={j} active={jurisdiction.includes(j)} onClick={() => toggle(j)}>
          {j}
        </Chip>
      ))}
      <span className="px-1.5 py-1 font-body text-[11px] text-merris-text-tertiary">Sector ▾</span>
      <span className="px-1.5 py-1 font-body text-[11px] text-merris-text-tertiary">Vault ▾</span>
      <span className="px-1.5 py-1 font-body text-[11px] text-merris-text-tertiary">Entity ▾</span>
    </div>
  );
}
```

- [ ] **Step 1: Create the file.**
- [ ] **Step 2: Build, confirm clean.**
- [ ] **Step 3: Commit:**

```bash
git add apps/web/components/intelligence/jurisdiction-chips.tsx
git commit -m "feat(intelligence): add JurisdictionChips component"
```

---

## Task 3: SourceToggles

**Files:** Create `apps/web/components/intelligence/source-toggles.tsx`

```tsx
'use client';

import clsx from 'clsx';
import { useChatStore } from '@/lib/chat-store';
import { KNOWLEDGE_SOURCES } from '@/lib/intelligence-constants';

export function SourceToggles() {
  const active = useChatStore((s) => s.knowledgeSources);
  const toggle = useChatStore((s) => s.toggleKnowledgeSource);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {KNOWLEDGE_SOURCES.map(({ key, label }) => {
        const isActive = active.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[10px] transition-colors',
              isActive
                ? 'bg-merris-primary-bg font-semibold text-merris-primary'
                : 'bg-merris-surface-low text-merris-text-tertiary hover:text-merris-text-secondary',
            )}
          >
            <span
              className={clsx(
                'inline-block h-1 w-1 rounded-full',
                isActive ? 'bg-merris-primary' : 'bg-merris-text-tertiary',
              )}
            />
            {label}
          </button>
        );
      })}
      <span className="inline-flex items-center gap-1 rounded-full bg-merris-surface-low px-2 py-0.5 font-body text-[10px] text-merris-text-tertiary">
        🌐 Web
      </span>
    </div>
  );
}
```

- [ ] **Step 1: Create.**
- [ ] **Step 2: Build, confirm clean.**
- [ ] **Step 3: Commit:**

```bash
git add apps/web/components/intelligence/source-toggles.tsx
git commit -m "feat(intelligence): add K1-K7 SourceToggles component"
```

---

## Task 4: ChatInput

**Files:** Create `apps/web/components/intelligence/chat-input.tsx`

```tsx
'use client';

import { useState, KeyboardEvent } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { useChatStore } from '@/lib/chat-store';
import { merrisTokens } from '@/lib/design-tokens';

export function ChatInput() {
  const [text, setText] = useState('');
  const startQuery = useChatStore((s) => s.startQuery);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    void startQuery(trimmed);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <MerrisCard className="p-0 text-left">
      <div
        className="flex gap-3 px-4 py-2.5"
        style={{ borderBottom: `1px solid ${merrisTokens.border}` }}
      >
        <span className="font-body text-[11px] text-merris-text-secondary">Engagement ▾</span>
        <span className="font-body text-[11px] text-merris-text-secondary">Prompts ▾</span>
      </div>
      <div className="px-4 py-3.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask Merris anything. Type @ to add sources."
          className="min-h-[60px] w-full resize-none bg-transparent font-body text-[13px] text-merris-text outline-none"
        />
      </div>
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderTop: `1px solid ${merrisTokens.border}` }}
      >
        <div className="flex gap-2 text-merris-text-tertiary">
          <span className="text-[14px]">📎</span>
          <span className="text-[14px]">🔖</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-merris-text-tertiary">🎤</span>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-merris-sm bg-merris-primary text-white disabled:opacity-40"
            aria-label="Send"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4z" />
            </svg>
          </button>
        </div>
      </div>
    </MerrisCard>
  );
}
```

- [ ] **Step 1: Create.**
- [ ] **Step 2: Build, confirm clean.**
- [ ] **Step 3: Commit:**

```bash
git add apps/web/components/intelligence/chat-input.tsx
git commit -m "feat(intelligence): add ChatInput component triggering startQuery"
```

---

## Task 5: IntelligenceHero

**Files:** Create `apps/web/components/intelligence/intelligence-hero.tsx`

```tsx
'use client';

import { JurisdictionChips } from './jurisdiction-chips';
import { SourceToggles } from './source-toggles';
import { ChatInput } from './chat-input';

export function IntelligenceHero() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-11 text-center">
      <h1 className="font-display text-[34px] font-extrabold leading-[1.15] text-merris-text">
        Where sustainability meets <span className="text-merris-primary">precision</span>
      </h1>
      <p className="mt-2 mb-6 font-body text-[14px] text-merris-text-secondary">
        Analyze, validate, and report with institutional-grade ESG intelligence.
      </p>

      <div className="mb-7 flex justify-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-merris-sm bg-merris-primary px-[18px] py-[9px] font-display text-[13px] font-semibold text-white"
        >
          📄 Review report
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-merris-sm bg-merris-surface px-[14px] py-[7px] font-display text-[12px] font-medium text-merris-text border border-merris-border-medium"
        >
          🧱 Extract data
        </button>
      </div>

      <div className="mb-2">
        <JurisdictionChips />
      </div>
      <div className="mb-6">
        <SourceToggles />
      </div>

      <ChatInput />

      <div className="mt-7 flex justify-center gap-5 font-body text-[10px] text-merris-text-tertiary">
        <span>● High Performance</span>
        <span className="text-merris-primary">● Private Cloud</span>
        <span className="text-merris-primary">● ESG Validated</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Create.**
- [ ] **Step 2: Build, confirm clean.**
- [ ] **Step 3: Commit:**

```bash
git add apps/web/components/intelligence/intelligence-hero.tsx
git commit -m "feat(intelligence): add IntelligenceHero composing the home phase"
```

---

## Task 6: WorkingHeader

**Files:** Create `apps/web/components/intelligence/working-header.tsx`

```tsx
'use client';

export function WorkingHeader() {
  return (
    <div className="mb-5 flex items-center gap-2">
      <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-merris-primary font-display text-[11px] font-bold text-white">
        M
      </div>
      <span className="font-display text-[13px] font-semibold text-merris-primary">Working...</span>
    </div>
  );
}
```

- [ ] **Step 1: Create.**
- [ ] **Step 2: Build, confirm clean.**
- [ ] **Step 3: Commit:**

```bash
git add apps/web/components/intelligence/working-header.tsx
git commit -m "feat(intelligence): add WorkingHeader avatar+pill component"
```

---

## Task 7: ThinkingState

**Files:** Create `apps/web/components/intelligence/thinking-state.tsx`

```tsx
'use client';

import clsx from 'clsx';
import { MerrisCard } from '@/components/merris/card';
import { useChatStore } from '@/lib/chat-store';
import { merrisTokens } from '@/lib/design-tokens';

export function ThinkingState() {
  const steps = useChatStore((s) => s.thinkingSteps);

  return (
    <MerrisCard className="px-5 py-[18px]">
      {steps.map((s) => (
        <div
          key={s.step}
          className={clsx('mb-3.5 flex gap-2.5', s.status === 'pending' && 'opacity-30')}
        >
          <div
            className={clsx(
              'mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full',
              s.status === 'done' && 'bg-merris-primary',
              s.status === 'active' && 'bg-merris-primary-bg animate-pulse-soft',
              s.status === 'pending' && 'bg-merris-surface-high',
              s.status === 'failed' && 'bg-merris-error-bg',
            )}
          >
            {s.status === 'done' && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
            {s.status === 'active' && <div className="h-1.5 w-1.5 rounded-full bg-merris-primary" />}
            {s.status === 'failed' && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.error} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <div
              className={clsx(
                'font-display text-[13px] font-semibold',
                s.status === 'active' && 'text-merris-primary',
                s.status === 'failed' && 'text-merris-error',
                s.status !== 'active' && s.status !== 'failed' && 'text-merris-text',
              )}
            >
              {s.step}
            </div>
            {s.detail && s.status !== 'failed' && (
              <div className="font-mono text-[11px] text-merris-text-tertiary">{s.detail}</div>
            )}
            {s.status === 'active' && <div className="text-[11px] text-merris-primary">⋯</div>}
            {s.sources && s.sources.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {s.sources.map((src) => (
                  <span
                    key={src}
                    className="rounded-merris-sm bg-merris-surface-low px-2 py-0.5 font-body text-[10px] text-merris-text-secondary"
                  >
                    {src}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </MerrisCard>
  );
}
```

- [ ] **Step 1: Create.**
- [ ] **Step 2: Build, confirm clean.**
- [ ] **Step 3: Commit:**

```bash
git add apps/web/components/intelligence/thinking-state.tsx
git commit -m "feat(intelligence): add ThinkingState vertical timeline component"
```

---

## Task 8: CitationsList

**Files:** Create `apps/web/components/intelligence/citations-list.tsx`

```tsx
'use client';

import type { CitationItem } from '@merris/shared';

export function CitationsList({ citations }: { citations: CitationItem[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-3 border-t border-merris-border pt-3">
      <div className="mb-2 font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
        Sources
      </div>
      <ul className="space-y-2">
        {citations.map((c) => (
          <li key={c.id} className="font-body text-[11px] leading-relaxed">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-merris-text">{c.title}</span>
              {c.verified && (
                <span className="rounded-full bg-merris-success-bg px-1.5 py-0.5 text-[9px] font-semibold uppercase text-merris-success">
                  Verified
                </span>
              )}
            </div>
            <div className="text-merris-text-secondary">
              {c.source} · {c.year}
              {c.url && (
                <>
                  {' · '}
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-merris-primary hover:underline">
                    Source
                  </a>
                </>
              )}
            </div>
            {c.excerpt && <div className="mt-0.5 italic text-merris-text-tertiary">"{c.excerpt}"</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 1: Create.**
- [ ] **Step 2: Build, confirm clean.**
- [ ] **Step 3: Commit:**

```bash
git add apps/web/components/intelligence/citations-list.tsx
git commit -m "feat(intelligence): add CitationsList rendering CitationItem array"
```

---

## Task 9: AdvisoryResponse

**Files:** Create `apps/web/components/intelligence/advisory-response.tsx`

```tsx
'use client';

import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { ScoreRing } from '@/components/merris/score-ring';
import { useChatStore } from '@/lib/chat-store';
import { CitationsList } from './citations-list';
import { merrisTokens } from '@/lib/design-tokens';

export function AdvisoryResponse() {
  const tokenText = useChatStore((s) => s.tokenText);
  const citations = useChatStore((s) => s.citations);
  const evaluation = useChatStore((s) => s.evaluation);

  const confidenceVariant: 'completed' | 'in-progress' | 'draft' =
    evaluation?.confidence === 'high'
      ? 'completed'
      : evaluation?.confidence === 'medium'
        ? 'in-progress'
        : 'draft';

  return (
    <>
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-merris-primary font-display text-[11px] font-bold text-white">
          M
        </div>
        {evaluation && (
          <Pill variant={confidenceVariant} size="sm">
            {evaluation.confidence} Confidence
          </Pill>
        )}
        {evaluation && (
          <span className="ml-auto">
            <ScoreRing score={evaluation.score} size={34} />
          </span>
        )}
      </div>

      <MerrisCard
        className="mb-3.5 p-5"
        style={{ borderLeft: `3px solid ${merrisTokens.primaryLight}` }}
      >
        <p className="whitespace-pre-wrap font-body text-[13px] leading-[1.7] text-merris-text">
          {tokenText}
        </p>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <div className="rounded-merris-sm bg-merris-surface-low px-3 py-2">
            <div className="font-body text-[9px] uppercase text-merris-text-tertiary">SASB Alignment</div>
            <div className="font-display text-[13px] font-semibold text-merris-text">Compliant ✓</div>
          </div>
          <div className="rounded-merris-sm bg-merris-surface-low px-3 py-2">
            <div className="font-body text-[9px] uppercase text-merris-text-tertiary">Materiality Gap</div>
            <div className="font-display text-[13px] font-semibold text-merris-warning">Minimal Risk</div>
          </div>
        </div>

        <div className="mt-3.5 font-body text-[11px] text-merris-text-secondary">
          {citations.length} source{citations.length === 1 ? '' : 's'} cited
        </div>

        <CitationsList citations={citations} />
      </MerrisCard>
    </>
  );
}
```

NOTE: The SASB Alignment / Materiality Gap stat cards are currently HARDCODED to "Compliant ✓ / Minimal Risk" matching the prototype. The backend doesn't yet emit these signals; they're cosmetic placeholders that mirror the prototype's screenshot. Real wiring is a follow-up plan.

- [ ] **Step 1: Create.**
- [ ] **Step 2: Build, confirm clean.**
- [ ] **Step 3: Commit:**

```bash
git add apps/web/components/intelligence/advisory-response.tsx
git commit -m "feat(intelligence): add AdvisoryResponse archetype with citations + score"
```

---

## Task 10: RefusalResponse

**Files:** Create `apps/web/components/intelligence/refusal-response.tsx`

```tsx
'use client';

import { MerrisCard } from '@/components/merris/card';
import { useChatStore } from '@/lib/chat-store';

export function RefusalResponse() {
  const tokenText = useChatStore((s) => s.tokenText);

  return (
    <MerrisCard
      className="border-l-[3px] border-merris-error p-5"
    >
      <div className="mb-2 flex items-center gap-2 font-display text-[14px] font-bold text-merris-error">
        🛡️ Cannot Comply
      </div>
      <p className="mb-3 whitespace-pre-wrap font-body text-[13px] leading-[1.7] text-merris-text">
        {tokenText}
      </p>
      <div className="mt-3 border-t border-merris-border pt-3 font-body text-[11px] text-merris-text-secondary">
        This response was suppressed by Merris's evaluator because it would have produced an indefensible claim. Try rephrasing your question.
      </div>
    </MerrisCard>
  );
}
```

- [ ] **Step 1: Create.**
- [ ] **Step 2: Build, confirm clean.**
- [ ] **Step 3: Commit:**

```bash
git add apps/web/components/intelligence/refusal-response.tsx
git commit -m "feat(intelligence): add RefusalResponse archetype for BLOCK decisions"
```

---

## Task 11: IntelligenceView orchestrator

**Files:** Create `apps/web/components/intelligence/intelligence-view.tsx`

```tsx
'use client';

import { useChatStore } from '@/lib/chat-store';
import { IntelligenceHero } from './intelligence-hero';
import { ThinkingState } from './thinking-state';
import { WorkingHeader } from './working-header';
import { AdvisoryResponse } from './advisory-response';
import { RefusalResponse } from './refusal-response';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';

export function IntelligenceView() {
  const phase = useChatStore((s) => s.phase);
  const question = useChatStore((s) => s.question);
  const evaluation = useChatStore((s) => s.evaluation);
  const errorMessage = useChatStore((s) => s.errorMessage);
  const reset = useChatStore((s) => s.reset);

  if (phase === 'home') {
    return <IntelligenceHero />;
  }

  return (
    <div className="mx-auto max-w-[760px] px-5 py-9">
      <MerrisCard className="mb-5 bg-merris-surface-low px-4 py-3">
        <div className="font-body text-[13px] text-merris-text">{question}</div>
      </MerrisCard>

      {phase === 'thinking' && (
        <>
          <WorkingHeader />
          <ThinkingState />
        </>
      )}

      {phase === 'response' && (
        <>
          {errorMessage ? (
            <MerrisCard className="border-l-[3px] border-merris-error p-5 font-body text-[13px] text-merris-error">
              <div className="mb-2 font-display font-bold">Stream error</div>
              <div>{errorMessage}</div>
            </MerrisCard>
          ) : evaluation?.decision === 'BLOCK' ? (
            <RefusalResponse />
          ) : (
            <AdvisoryResponse />
          )}

          <div className="mt-6 text-center">
            <MerrisButton variant="secondary" onClick={reset}>
              Ask another question
            </MerrisButton>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 1: Create.**
- [ ] **Step 2: Build, confirm clean.**
- [ ] **Step 3: Commit:**

```bash
git add apps/web/components/intelligence/intelligence-view.tsx
git commit -m "feat(intelligence): add 3-phase IntelligenceView orchestrator"
```

---

## Task 12: Replace the placeholder page

**Files:** Replace `apps/web/app/(dashboard)/intelligence/page.tsx`

```tsx
import { IntelligenceView } from '@/components/intelligence/intelligence-view';

export default function IntelligencePage() {
  return <IntelligenceView />;
}
```

This file is a Server Component (no `'use client'`). It just renders the client component, which keeps Next.js's render boundary clean.

- [ ] **Step 1: Replace contents.**
- [ ] **Step 2: Run `pnpm --filter @merris/web build`** — confirm exit 0 and that `/intelligence` still appears in the route list (it will now be slightly larger because it imports the chat client code).
- [ ] **Step 3: Commit:**

```bash
git add apps/web/app/\(dashboard\)/intelligence/page.tsx
git commit -m "feat(intelligence): wire IntelligenceView into the /intelligence route"
```

---

## Task 13: End-to-end smoke test

This task is verification, no new code. Reuses the SSE smoke test launcher from Plan 1 Task 6 (`apps/api/src/scripts/sse-smoke-test.ts`) which spins up a stripped backend on port 3099 with a stubbed Anthropic fetch interceptor.

- [ ] **Step 1: Confirm `NEXT_PUBLIC_API_URL` points at the smoke server**

In a terminal:
```bash
export NEXT_PUBLIC_API_URL=http://127.0.0.1:3099/api/v1
```

OR add `apps/web/.env.local` containing:
```
NEXT_PUBLIC_API_URL=http://127.0.0.1:3099/api/v1
```

(Use the .env.local approach so the dev server picks it up automatically.)

- [ ] **Step 2: Start the SSE smoke server**

In a separate terminal:
```bash
pnpm --filter @merris/api exec tsx src/scripts/sse-smoke-test.ts
```

It will print the listening URL and a JWT for the operator.

- [ ] **Step 3: Start the web dev server**

In another terminal:
```bash
pnpm --filter @merris/web dev
```

- [ ] **Step 4: Manual UI walk**

Visit `http://localhost:3000/intelligence` and verify:

1. The hero renders with the headline "Where sustainability meets precision" in Manrope
2. Jurisdiction chips render and toggle when clicked
3. K1-K7 source toggles render and toggle when clicked
4. The chat input card is visible
5. Type a question (e.g., "What are QAPCO's Scope 1 emissions?") and press Enter
6. The view transitions to the thinking phase showing the question recap card
7. The thinking timeline animates: phases go from pending → active (pulsing teal) → done (green check)
8. The `Retrieving intelligence` step shows source chips (default `K1, K2, K3` or whatever the user toggled)
9. After all 6 phases complete, the view transitions to the response phase
10. The Advisory response renders with: M avatar, confidence pill, score ring, response text, SASB / Materiality stat cards, "N sources cited" line
11. If the smoke server's Anthropic stub fails (it tries to call the real API with a dummy key), the streamed `error` event is emitted; the UI should show the error path correctly
12. Click "Ask another question" — view returns to the hero phase

- [ ] **Step 5: Browser DevTools network check**

Open DevTools Network tab. The request to `/api/v1/assistant/chat` should:
- Have `Accept: text/event-stream` header
- Have `Content-Type: text/event-stream` response header
- Show as a streaming response (not a single JSON blob)

- [ ] **Step 6: If everything works, no commit. If you find UX bugs, file a follow-up**

Stop both servers (Ctrl-C). Document any visual deltas vs the prototype as follow-ups in a `# Follow-ups` section appended to this plan file. The MVP is "the chat surface works end-to-end with the SSE backend"; visual polish is iterative.

---

## Self-Review Checklist (after Task 13)

1. **Spec coverage:**
   - 3-phase view (home → thinking → response) ✓ Task 11
   - SSE consumer wired through chat store ✓ Task 1
   - Jurisdiction + K-source toggles affect chat payload ✓ Tasks 1, 2, 3
   - ThinkingState renders 6 phases with active/done/pending states ✓ Task 7
   - AdvisoryResponse renders text + score + citations ✓ Task 9
   - RefusalResponse triggered by BLOCK decision ✓ Task 10
   - Reset button returns to home ✓ Task 11
   - Page wired to route ✓ Task 12

2. **Backwards compatibility:** No changes to `apps/web/lib/api.ts`, `components/merris/*`, `components/ui/*`, `lib/store.ts`, or any other existing component. The new code is purely additive in `components/intelligence/` plus the one-file replacement of `intelligence/page.tsx`.

3. **No placeholders:** All code blocks are complete. The SASB / Materiality stat cards in AdvisoryResponse are intentionally hardcoded for visual parity with the prototype and documented as a follow-up.

4. **Type consistency:** `ThinkingStepName` from `@merris/shared` is mirrored by `THINKING_PHASES` constant in `intelligence-constants.ts`. Both must stay in sync — flagged inline as a note.

5. **Single phase transition rule:** the store sets `phase: 'response'` only when the `done` event arrives. Errors set `phase: 'response'` via the catch block. The store never gets stuck in `'thinking'`.

---

## Known Limitations / Follow-ups

- **No multi-turn conversation.** Each new query resets the store. Plan 6 will add `messages[]` and conversation history.
- **SASB Alignment + Materiality Gap stat cards are hardcoded** in `AdvisoryResponse`. The backend doesn't yet emit these signals.
- **No document context.** Plan 4 will activate `documentBody` and `cursorSection` when the user opens a document for review.
- **No real engagement selector.** The store uses a placeholder ObjectId; the real engagement comes from the top-bar selector in Plan 4.
- **No unit tests.** The web app has no test infrastructure. A separate plan should add Vitest + React Testing Library + jsdom and convert the chat-store reducer to a pure function with full coverage.
- **`token` event is one-shot.** True per-token streaming is a backend follow-up (Plan 1 follow-up #5 family); the UI is ready for it because `tokenText` is set via `set({ tokenText: event.text })` and could be appended instead.
- **Suggested workflow agents grid** below the chat input is not implemented (Plan 5).
- **No `@` mentions or attachments.** Future Plan.
- **The "Review report" and "Extract data" CTA buttons in the hero are inert.** They need wiring to document upload + the document viewer (Plan 4).
- **The Sector / Vault / Entity dropdowns are inert** — they're text labels with no interaction. Plan 4 wires them to real filter state.
