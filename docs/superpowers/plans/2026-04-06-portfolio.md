# Portfolio Implementation Plan (Plan 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/portfolio` and `/portfolio/[id]` placeholder stubs with the working engagement grid and engagement detail page from the merris-platform-7 prototype, plus wire the MerrisTopBar engagement selector to real data. Adds a minimal `POST /api/v1/engagements` backend endpoint so the "New Engagement" button works.

**Architecture:** Server Component pages render thin shells around client-side `<PortfolioGrid />` and `<EngagementDetail />` components. Both consume a new `engagement-store` (Zustand) that hydrates from `api.listEngagements()`. The selected engagement also drives the existing `MerrisTopBar` chip (currently hardcoded "QAPCO Sustainability 2026"). New backend endpoint `POST /api/v1/engagements` accepts `{name, frameworks[], deadline?}` and inserts into the existing `engagements` collection. **Document Viewer split-pane is intentionally OUT OF SCOPE** for this plan — that's deferred to a follow-up Plan 4.5 because it's a substantial feature on its own (rich text rendering, annotation overlay, edit/review/export modes, apply-fix actions). Plan 4 ships the visible engagement surface without it.

**Tech Stack:** Fastify backend, Next.js 14 app router, Zustand, Tailwind, existing `apps/web/components/merris/*` primitives, existing `api` client from Plan 2.

---

## Context for the Implementer

**Read first:**

1. `merris-platform-7.html` lines 136–149 — the `Port` (portfolio grid) and `EDet` (engagement detail) components. Note the layouts:
   - Portfolio: header with "Engagements" + subtitle + "New Engagement" button, 3-column grid of cards (status pill, ScoreRing, name, framework chips, due date, time-since-update), trailing dashed "Start New" card, then a 2:1 row of Velocity bar chart + Sovereign Intel sidebar
   - Engagement Detail: back arrow + name + status pill, 2:1 grid (left: 130px ScoreRing donut + Report Readiness card, Framework Compliance 4-column grid, Critical Findings list; right: Workflow Terminal sidebar with action rows, Team sidebar)
2. `apps/api/src/modules/ingestion/ingestion.routes.ts` lines 86–120 — the existing `GET /api/v1/engagements` endpoint and the document shape it returns
3. `apps/web/lib/api.ts` — the existing `listEngagements`, `listEngagementDocuments`, `getDocument`, `getDisclosureFindings` typed methods
4. `apps/web/lib/store.ts` — the existing `useEngagementStore` (already exists with `currentEngagement`, `engagements`, `setCurrentEngagement`, `setEngagements`). **REUSE this store**, don't create a new one.
5. `apps/web/components/merris/top-bar.tsx` — the existing TopBar with the hardcoded "QAPCO" chip. We'll wire it to read from `useEngagementStore`.
6. `apps/web/components/merris/*` — primitives reused: MerrisCard, MerrisButton, Pill, Chip, ScoreRing (small + donut), SectionLabel
7. `apps/api/src/modules/auth/auth.middleware.ts` — to confirm the JWT shape (`request.user.orgId`)

**Critical reality checks:**

- The backend `GET /api/v1/engagements` returns `{engagements: Array<{id, name, frameworks, status, deadline, createdAt}>}`. There's NO `completeness`, `scope`, or `up` (time-since-update) field. The web client `Engagement` interface lists those as optional. Plan 4 components must handle their absence gracefully — for `completeness`, default to `0` and let the ScoreRing render `0%` (red). For `up`, derive from `createdAt` or just show `--`.
- There's NO `POST /api/v1/engagements` endpoint. **Task 1 adds it.**
- The database may be empty in dev — the portfolio grid must show an empty state, not crash.
- Findings: the existing `GET /engagements/:id/disclosures/:disclosureId/findings` requires a `disclosureId`. For Plan 4 we don't have a way to enumerate disclosures; the engagement detail page will use HARDCODED placeholder findings (matching the prototype's `FINDS` array) and document this as a follow-up.

**Out of scope (deferred):**
- Document Viewer split-pane (Plan 4.5)
- Real `Workflow Terminal` action wiring (the buttons are inert; clicking them just triggers a no-op for now)
- Real `Team` data (the prototype's team is hardcoded; Plan 4 will hardcode the same names)
- The Velocity bar chart and Sovereign Intel side card on the portfolio page (cosmetic — defer to a polish pass)
- Frameworks Compliance percentages (hardcoded matching the prototype)
- New Engagement form fields beyond `name` and a multi-select of frameworks

---

## File Structure (end state)

```
apps/api/
└── src/modules/ingestion/ingestion.routes.ts    (modified — adds POST /engagements)

apps/web/
├── app/(dashboard)/portfolio/
│   ├── page.tsx                                  (replaced — renders <PortfolioGrid />)
│   └── [id]/page.tsx                             (replaced — renders <EngagementDetail engagementId={id} />)
├── components/portfolio/
│   ├── portfolio-grid.tsx                        (NEW — fetches list, renders cards)
│   ├── engagement-card.tsx                       (NEW — individual card)
│   ├── new-engagement-modal.tsx                  (NEW — simple create form)
│   ├── engagement-detail.tsx                     (NEW — orchestrator for the [id] page)
│   ├── engagement-detail-header.tsx              (NEW — back arrow + name + status)
│   ├── engagement-detail-readiness.tsx           (NEW — donut + report readiness card)
│   ├── engagement-detail-frameworks.tsx          (NEW — 4-cell framework compliance grid)
│   ├── engagement-detail-findings.tsx            (NEW — critical findings list)
│   ├── engagement-detail-sidebar.tsx             (NEW — Workflow Terminal + Team)
│   └── engagement-empty-state.tsx                (NEW — shown when listEngagements returns [])
├── lib/
│   └── api.ts                                    (modified — adds createEngagement method)
└── components/merris/
    └── top-bar.tsx                               (modified — reads from useEngagementStore)
```

11 new files, 4 modifications.

---

## Constants (used in multiple files)

```ts
// apps/web/lib/portfolio-constants.ts
export const FRAMEWORK_OPTIONS = [
  'GRI', 'TCFD', 'ISSB', 'CSRD', 'EU TAX', 'QSE', 'ICMA', 'SASB',
] as const;

export type FrameworkCode = (typeof FRAMEWORK_OPTIONS)[number];

// Hardcoded findings shown on engagement detail (matches prototype FINDS)
export const PLACEHOLDER_FINDINGS = [
  { id: 'p1', severity: 'CRITICAL' as const, ref: 'GRI 305-1', title: 'Mismatched Direct Emissions', description: 'Scope 1 (14,200t) ≠ facility sum (15,840t).' },
  { id: 'p2', severity: 'IMPORTANT' as const, ref: 'G2.1',     title: 'Vague Board Oversight',       description: 'Missing Climate Risk Subcommittee.' },
  { id: 'p3', severity: 'MINOR' as const,     ref: 'Format',   title: 'Missing Appendix Link',       description: 'App-D reference broken.' },
];

// Hardcoded framework percentages shown on engagement detail
export const PLACEHOLDER_FRAMEWORK_COMPLIANCE = [
  { code: 'GRI', percent: 45 },
  { code: 'TCFD', percent: 20 },
  { code: 'QSE', percent: 60 },
  { code: 'ISSB', percent: 0 },
];

// Hardcoded team
export const PLACEHOLDER_TEAM = [
  { id: 't1', name: 'Marcus Sterling', role: 'Lead', online: true },
  { id: 't2', name: 'Elena Vance', role: 'Auditor', online: true },
  { id: 't3', name: 'David Chen', role: 'Analyst', online: false },
];
```

---

## Task 1: Backend — `POST /api/v1/engagements`

**File:** `apps/api/src/modules/ingestion/ingestion.routes.ts`

Add a new route AFTER the existing `GET /api/v1/engagements` block (around line 121). The route accepts `{name, frameworks?, deadline?}`, requires authentication, and inserts into the `engagements` Mongo collection with the user's `orgId`.

```ts
  // ----------------------------------------------------------
  // POST /api/v1/engagements — create a new engagement
  // ----------------------------------------------------------
  app.post<{ Body: { name: string; frameworks?: string[]; deadline?: string } }>(
    '/api/v1/engagements',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }
        const { name, frameworks = [], deadline } = request.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return reply.code(400).send({ error: 'name is required' });
        }
        const db = mongoose.connection.db;
        if (!db) {
          return reply.code(500).send({ error: 'Database not connected' });
        }
        const now = new Date();
        const doc = {
          orgId: new mongoose.Types.ObjectId(request.user.orgId),
          name: name.trim(),
          frameworks: Array.isArray(frameworks) ? frameworks : [],
          status: 'DRAFT',
          deadline: deadline ?? null,
          createdAt: now,
          updatedAt: now,
        };
        const result = await db.collection('engagements').insertOne(doc);
        return reply.code(201).send({
          engagement: {
            id: result.insertedId.toString(),
            name: doc.name,
            frameworks: doc.frameworks,
            status: doc.status,
            deadline: doc.deadline,
            createdAt: doc.createdAt,
          },
        });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );
```

- [ ] Verify with `pnpm --filter @merris/api build` (exit 0)
- [ ] Commit:

```bash
git add apps/api/src/modules/ingestion/ingestion.routes.ts
git commit -m "feat(api): add POST /api/v1/engagements endpoint"
```

---

## Task 2: Web client — `createEngagement` method

**File:** `apps/web/lib/api.ts`

Add to the `ApiClient` class, after the existing `uploadEngagementDocument` method (in the `// ===== Engagements =====` block):

```ts
  createEngagement(payload: { name: string; frameworks?: string[]; deadline?: string }) {
    return this.post<{ engagement: Engagement }>('/engagements', payload);
  }
```

- [ ] Verify build clean
- [ ] Commit: `feat(web): add createEngagement API client method`

---

## Task 3: Portfolio constants file

**File:** `apps/web/lib/portfolio-constants.ts`

Use the constants block from the "Constants" section above verbatim.

- [ ] Commit: `feat(portfolio): add framework + placeholder constants`

---

## Task 4: EngagementCard

**File:** `apps/web/components/portfolio/engagement-card.tsx`

```tsx
'use client';

import Link from 'next/link';
import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { Chip } from '@/components/merris/chip';
import { ScoreRing } from '@/components/merris/score-ring';
import type { Engagement } from '@/lib/api';

function statusVariant(status: string): 'in-progress' | 'under-review' | 'draft' | 'completed' | 'default' {
  const s = status.toUpperCase();
  if (s.includes('IN PROGRESS') || s === 'DRAFTING' || s === 'DATA_COLLECTION') return 'in-progress';
  if (s.includes('UNDER REVIEW') || s === 'REVIEW' || s === 'ASSURANCE') return 'under-review';
  if (s === 'DRAFT' || s === 'SETUP') return 'draft';
  if (s === 'COMPLETED') return 'completed';
  return 'default';
}

function formatDeadline(deadline?: string | null): string {
  if (!deadline) return '—';
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return deadline;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeSince(createdAt?: string): string {
  if (!createdAt) return '';
  const ms = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function EngagementCard({ engagement }: { engagement: Engagement }) {
  const completeness = typeof engagement.completeness === 'number' ? engagement.completeness : 0;
  const variant = statusVariant(engagement.status);

  return (
    <Link href={`/portfolio/${engagement.id}`} className="block">
      <MerrisCard hover>
        <div className="mb-2.5 flex items-start justify-between">
          <Pill variant={variant} size="sm">{engagement.status}</Pill>
          <ScoreRing score={completeness} size={40} />
        </div>
        <div className="mb-1.5 font-display text-[15px] font-semibold leading-snug text-merris-text">
          {engagement.name}
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {(engagement.frameworks ?? []).map((f) => (
            <Chip key={f}>{f}</Chip>
          ))}
        </div>
        <div className="flex justify-between font-body text-[10px] text-merris-text-tertiary">
          <span>Due: {formatDeadline(engagement.deadline)}</span>
          <span>{timeSince((engagement as { createdAt?: string }).createdAt)}</span>
        </div>
      </MerrisCard>
    </Link>
  );
}
```

NOTE: The `Engagement` interface in `api.ts` doesn't currently have `createdAt`. Cast as shown to access it without modifying the type yet — Task 5 may upgrade the interface if needed. Don't modify `api.ts` for this in this task.

- [ ] Build clean
- [ ] Commit: `feat(portfolio): add EngagementCard with status pill and completeness ring`

---

## Task 5: NewEngagementModal

**File:** `apps/web/components/portfolio/new-engagement-modal.tsx`

```tsx
'use client';

import { useState } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { Chip } from '@/components/merris/chip';
import { FRAMEWORK_OPTIONS } from '@/lib/portfolio-constants';
import { api } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function NewEngagementModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const toggle = (fw: string) =>
    setFrameworks((prev) => (prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]));

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createEngagement({ name: name.trim(), frameworks });
      setName('');
      setFrameworks([]);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create engagement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-4">
      <MerrisCard className="w-full max-w-md">
        <h2 className="mb-1 font-display text-[18px] font-bold text-merris-text">New Engagement</h2>
        <p className="mb-4 font-body text-[12px] text-merris-text-secondary">
          Create a new ESG verification or reporting cycle.
        </p>

        <label className="mb-1 block font-body text-[11px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
          Engagement name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. QAPCO Sustainability 2026"
          className="mb-4 w-full rounded-merris-sm border border-merris-border-medium bg-merris-surface px-3 py-2 font-body text-[13px] text-merris-text outline-none focus:border-merris-primary"
        />

        <label className="mb-1.5 block font-body text-[11px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
          Frameworks
        </label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {FRAMEWORK_OPTIONS.map((fw) => (
            <Chip key={fw} active={frameworks.includes(fw)} onClick={() => toggle(fw)}>
              {fw}
            </Chip>
          ))}
        </div>

        {error && (
          <div className="mb-3 rounded-merris-sm bg-merris-error-bg px-3 py-2 font-body text-[12px] text-merris-error">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <MerrisButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </MerrisButton>
          <MerrisButton variant="primary" onClick={submit} disabled={submitting || !name.trim()}>
            {submitting ? 'Creating…' : 'Create'}
          </MerrisButton>
        </div>
      </MerrisCard>
    </div>
  );
}
```

- [ ] Commit: `feat(portfolio): add NewEngagementModal create form`

---

## Task 6: EngagementEmptyState

**File:** `apps/web/components/portfolio/engagement-empty-state.tsx`

```tsx
'use client';

import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';

export function EngagementEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <MerrisCard className="border-2 border-dashed border-merris-border-medium bg-transparent text-center shadow-none" style={{ padding: '48px 32px' }}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-merris-surface-low text-2xl">
        📁
      </div>
      <div className="mb-1 font-display text-[16px] font-bold text-merris-text">No engagements yet</div>
      <p className="mb-4 font-body text-[12px] text-merris-text-secondary">
        Create your first engagement to start ingesting data, drafting disclosures, and running reviews.
      </p>
      <MerrisButton variant="primary" onClick={onCreate}>+ New Engagement</MerrisButton>
    </MerrisCard>
  );
}
```

- [ ] Commit: `feat(portfolio): add EngagementEmptyState component`

---

## Task 7: PortfolioGrid

**File:** `apps/web/components/portfolio/portfolio-grid.tsx`

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { api, type Engagement } from '@/lib/api';
import { useEngagementStore } from '@/lib/store';
import { EngagementCard } from './engagement-card';
import { NewEngagementModal } from './new-engagement-modal';
import { EngagementEmptyState } from './engagement-empty-state';

export function PortfolioGrid() {
  const engagements = useEngagementStore((s) => s.engagements);
  const setEngagements = useEngagementStore((s) => s.setEngagements);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listEngagements();
      setEngagements(res.engagements as unknown as Parameters<typeof setEngagements>[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load engagements');
    } finally {
      setLoading(false);
    }
  }, [setEngagements]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="mb-1 font-display text-[24px] font-bold text-merris-text">Engagements</h1>
          <p className="font-body text-[12px] text-merris-text-secondary">
            Active ESG verification and reporting cycles
          </p>
        </div>
        <MerrisButton variant="primary" onClick={() => setModalOpen(true)}>+ New Engagement</MerrisButton>
      </div>

      {loading && (
        <MerrisCard className="text-center font-body text-[12px] text-merris-text-tertiary">
          Loading engagements…
        </MerrisCard>
      )}

      {!loading && error && (
        <MerrisCard className="border-l-[3px] border-merris-error font-body text-[12px] text-merris-error">
          {error}
        </MerrisCard>
      )}

      {!loading && !error && engagements.length === 0 && (
        <EngagementEmptyState onCreate={() => setModalOpen(true)} />
      )}

      {!loading && !error && engagements.length > 0 && (
        <div className="mb-7 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(engagements as unknown as Engagement[]).map((e) => (
            <EngagementCard key={e.id} engagement={e} />
          ))}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex flex-col items-center justify-center rounded-merris border-2 border-dashed border-merris-border-medium bg-transparent p-6 transition-colors hover:bg-merris-surface-low"
          >
            <div className="text-2xl text-merris-text-tertiary">+</div>
            <div className="mt-2 font-display text-[12px] font-semibold text-merris-text">Start New</div>
          </button>
        </div>
      )}

      <NewEngagementModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => void reload()}
      />
    </div>
  );
}
```

NOTE: the `useEngagementStore.engagements` field is typed as `EngagementSummary[]` (the existing legacy interface in `lib/store.ts`). The API returns `Engagement[]` (the new interface in `lib/api.ts`). The two interfaces overlap enough that we cast through `unknown` to bridge them. A future cleanup task should unify the types — file as a follow-up.

- [ ] Build clean
- [ ] Commit: `feat(portfolio): add PortfolioGrid with empty/loading/error states`

---

## Task 8: Wire `app/(dashboard)/portfolio/page.tsx`

```tsx
import { PortfolioGrid } from '@/components/portfolio/portfolio-grid';

export default function PortfolioPage() {
  return <PortfolioGrid />;
}
```

- [ ] Build clean — verify `/portfolio` route is in the build output and the bundle grew (placeholder was ~595 B)
- [ ] Commit: `feat(portfolio): wire PortfolioGrid into /portfolio route`

---

## Task 9: EngagementDetail components (bundled)

Five files in one task because they're small and tightly coupled.

### File 9a: `apps/web/components/portfolio/engagement-detail-header.tsx`

```tsx
'use client';

import Link from 'next/link';
import { Pill } from '@/components/merris/pill';
import type { Engagement } from '@/lib/api';

function statusVariant(status: string): 'in-progress' | 'under-review' | 'draft' | 'completed' | 'default' {
  const s = status.toUpperCase();
  if (s.includes('IN PROGRESS')) return 'in-progress';
  if (s.includes('UNDER REVIEW') || s === 'REVIEW') return 'under-review';
  if (s === 'DRAFT') return 'draft';
  if (s === 'COMPLETED') return 'completed';
  return 'default';
}

export function EngagementDetailHeader({ engagement }: { engagement: Engagement }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <Link href="/portfolio" className="cursor-pointer text-merris-text-secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </Link>
      <h1 className="flex-1 font-display text-[18px] font-bold text-merris-text">{engagement.name}</h1>
      <Pill variant={statusVariant(engagement.status)} size="sm">{engagement.status}</Pill>
    </div>
  );
}
```

### File 9b: `apps/web/components/portfolio/engagement-detail-readiness.tsx`

```tsx
'use client';

import { MerrisCard } from '@/components/merris/card';
import { ScoreRing } from '@/components/merris/score-ring';

export function EngagementDetailReadiness({ score }: { score: number }) {
  return (
    <MerrisCard className="mb-5">
      <div className="flex items-center gap-6">
        <ScoreRing score={score} variant="donut" />
        <div>
          <div className="mb-1 font-display text-[18px] font-bold text-merris-text">Report Readiness</div>
          <p className="font-body text-[12px] leading-relaxed text-merris-text-secondary">
            Critical gaps in Scope 2 and Water stewardship.
          </p>
        </div>
      </div>
    </MerrisCard>
  );
}
```

### File 9c: `apps/web/components/portfolio/engagement-detail-frameworks.tsx`

```tsx
'use client';

import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';
import { PLACEHOLDER_FRAMEWORK_COMPLIANCE } from '@/lib/portfolio-constants';

export function EngagementDetailFrameworks() {
  return (
    <>
      <SectionLabel>Framework Compliance</SectionLabel>
      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
        {PLACEHOLDER_FRAMEWORK_COMPLIANCE.map(({ code, percent }) => {
          const color = percent > 50 ? 'text-merris-primary' : percent > 0 ? 'text-merris-warning' : 'text-merris-text-tertiary';
          return (
            <MerrisCard key={code} className="text-center" style={{ padding: '12px' }}>
              <div className="mb-1 font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">{code}</div>
              <div className={`font-display text-[20px] font-bold ${color}`}>{percent}%</div>
            </MerrisCard>
          );
        })}
      </div>
    </>
  );
}
```

### File 9d: `apps/web/components/portfolio/engagement-detail-findings.tsx`

```tsx
'use client';

import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';
import { PLACEHOLDER_FINDINGS } from '@/lib/portfolio-constants';

const SEVERITY_BORDER: Record<string, string> = {
  CRITICAL: 'border-merris-error',
  IMPORTANT: 'border-merris-warning',
  MINOR: 'border-merris-text-tertiary',
};

export function EngagementDetailFindings() {
  return (
    <>
      <SectionLabel>Critical Findings</SectionLabel>
      {PLACEHOLDER_FINDINGS.map((f) => (
        <MerrisCard
          key={f.id}
          className={`mb-2 border-l-[3px] ${SEVERITY_BORDER[f.severity] ?? 'border-merris-text-tertiary'}`}
          style={{ padding: '12px 16px' }}
        >
          <div className="font-display text-[13px] font-semibold text-merris-text">{f.title}</div>
          <div className="font-body text-[11px] text-merris-text-secondary">{f.description}</div>
        </MerrisCard>
      ))}
    </>
  );
}
```

### File 9e: `apps/web/components/portfolio/engagement-detail-sidebar.tsx`

```tsx
'use client';

import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';
import { PLACEHOLDER_TEAM } from '@/lib/portfolio-constants';

const TERMINAL_ACTIONS = [
  { label: 'Run Full Review', icon: '⚡' },
  { label: 'Generate Report', icon: '📄' },
  { label: 'Export Findings', icon: '⬇️' },
];

export function EngagementDetailSidebar() {
  return (
    <>
      <MerrisCard className="mb-3.5">
        <SectionLabel>Workflow Terminal</SectionLabel>
        {TERMINAL_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            className="flex w-full items-center justify-between border-t border-merris-border py-2.5 text-left first:border-t-0"
          >
            <span className="flex items-center gap-2 font-display text-[12px] font-medium text-merris-text">
              <span>{a.icon}</span>
              {a.label}
            </span>
            <span className="text-merris-text-tertiary">›</span>
          </button>
        ))}
      </MerrisCard>

      <MerrisCard>
        <SectionLabel>Team</SectionLabel>
        {PLACEHOLDER_TEAM.map((m) => (
          <div key={m.id} className="flex items-center gap-2 py-1.5">
            <div className="h-6 w-6 rounded-full bg-merris-surface-high" />
            <div className="flex-1">
              <div className="font-display text-[11px] font-medium text-merris-text">{m.name}</div>
              <div className="font-body text-[9px] text-merris-text-tertiary">{m.role}</div>
            </div>
            <div className={`h-1.5 w-1.5 rounded-full ${m.online ? 'bg-merris-primary' : 'bg-merris-surface-high'}`} />
          </div>
        ))}
      </MerrisCard>
    </>
  );
}
```

- [ ] Build clean after all 5 files
- [ ] Commit (single commit for the bundle): `feat(portfolio): add engagement detail subcomponents (header, readiness, frameworks, findings, sidebar)`

---

## Task 10: EngagementDetail orchestrator

**File:** `apps/web/components/portfolio/engagement-detail.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api, type Engagement } from '@/lib/api';
import { MerrisCard } from '@/components/merris/card';
import { EngagementDetailHeader } from './engagement-detail-header';
import { EngagementDetailReadiness } from './engagement-detail-readiness';
import { EngagementDetailFrameworks } from './engagement-detail-frameworks';
import { EngagementDetailFindings } from './engagement-detail-findings';
import { EngagementDetailSidebar } from './engagement-detail-sidebar';

export function EngagementDetail({ engagementId }: { engagementId: string }) {
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listEngagements()
      .then((res) => {
        if (cancelled) return;
        const found = res.engagements.find((e) => e.id === engagementId) ?? null;
        if (!found) {
          setError('Engagement not found.');
        } else {
          setEngagement(found);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load engagement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  if (loading) {
    return (
      <div className="p-6">
        <MerrisCard className="text-center font-body text-[12px] text-merris-text-tertiary">
          Loading engagement…
        </MerrisCard>
      </div>
    );
  }
  if (error || !engagement) {
    return (
      <div className="p-6">
        <MerrisCard className="border-l-[3px] border-merris-error font-body text-[12px] text-merris-error">
          {error ?? 'Engagement not found.'}
        </MerrisCard>
      </div>
    );
  }

  const completeness = typeof engagement.completeness === 'number' ? engagement.completeness : 0;

  return (
    <div className="p-6">
      <EngagementDetailHeader engagement={engagement} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <EngagementDetailReadiness score={completeness} />
          <EngagementDetailFrameworks />
          <EngagementDetailFindings />
        </div>
        <div>
          <EngagementDetailSidebar />
        </div>
      </div>
    </div>
  );
}
```

NOTE: We use `api.listEngagements()` and `find()` instead of a dedicated `api.getEngagement(id)` because there's no backend endpoint for the latter. Could add one later as a follow-up.

- [ ] Build clean
- [ ] Commit: `feat(portfolio): add EngagementDetail orchestrator`

---

## Task 11: Wire `app/(dashboard)/portfolio/[id]/page.tsx`

```tsx
import { EngagementDetail } from '@/components/portfolio/engagement-detail';

export default function EngagementDetailPage({ params }: { params: { id: string } }) {
  return <EngagementDetail engagementId={params.id} />;
}
```

- [ ] Build clean
- [ ] Commit: `feat(portfolio): wire EngagementDetail into /portfolio/[id] route`

---

## Task 12: Wire MerrisTopBar engagement selector

**File:** `apps/web/components/merris/top-bar.tsx`

The top bar currently shows a hardcoded chip "QAPCO Sustainability 2026". Replace with a chip that reads from `useEngagementStore.currentEngagement` and falls back to "No engagement selected" when null.

The chip should also be a click target — opening a simple dropdown of available engagements (from `useEngagementStore.engagements`). On click of an option, call `setCurrentEngagement(option)`. The dropdown can be a basic absolute-positioned ul; no need for Radix.

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Pill } from './pill';
import { merrisTokens } from '@/lib/design-tokens';
import { useEngagementStore } from '@/lib/store';

const TABS = ['Dashboard', 'Analytics', 'Archive'] as const;

export function MerrisTopBar() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Dashboard');
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const engagements = useEngagementStore((s) => s.engagements);
  const current = useEngagementStore((s) => s.currentEngagement);
  const setCurrent = useEngagementStore((s) => s.setCurrentEngagement);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const label = current?.name ?? 'No engagement selected';

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between bg-merris-surface px-6 py-2.5"
      style={{ borderBottom: `1px solid ${merrisTokens.border}` }}
    >
      <div className="flex gap-[18px]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={
              activeTab === t
                ? 'pb-0.5 font-display text-[12px] font-semibold text-merris-text'
                : 'pb-0.5 font-display text-[12px] font-normal text-merris-text-tertiary'
            }
            style={activeTab === t ? { borderBottom: `2px solid ${merrisTokens.primary}` } : undefined}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-merris-sm px-2.5 py-1 font-body text-[11px]"
          style={{ border: `1px solid ${merrisTokens.borderMedium}` }}
        >
          {current && <Pill size="sm">Active</Pill>}
          <span className="font-medium text-merris-text">{label}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div
            className="absolute right-0 top-full z-[100] mt-1 max-h-64 w-64 overflow-y-auto rounded-merris-sm bg-merris-surface shadow-merris-hover"
            style={{ border: `1px solid ${merrisTokens.borderMedium}` }}
          >
            {engagements.length === 0 && (
              <div className="px-3 py-2 font-body text-[11px] text-merris-text-tertiary">No engagements available</div>
            )}
            {engagements.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  setCurrent(e);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left font-body text-[12px] text-merris-text hover:bg-merris-surface-low"
              >
                {e.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
```

- [ ] Build clean
- [ ] Commit: `feat(portfolio): wire MerrisTopBar engagement selector to engagement-store`

---

## Task 13: End-to-end smoke test

This task is verification, no new code.

1. Start the SSE smoke launcher (which has in-memory MongoDB): `pnpm --filter @merris/api smoke:sse`
2. Add `apps/web/.env.local` with `NEXT_PUBLIC_API_URL=http://127.0.0.1:3099/api/v1`
3. Start dev server: `pnpm --filter @merris/web dev`
4. The smoke launcher only registers `assistant.router`, NOT `ingestion.routes`. So `GET /api/v1/engagements` will return 404. **This means the portfolio page will show its error state in dev**, which IS a valid verification of the loading/error/empty path.
5. To ALSO test the create flow end-to-end, optionally extend the smoke launcher to ALSO register `ingestion.routes` — this is a 2-line edit. Document the option but don't require it.
6. At minimum, verify:
   - `/portfolio` page renders with "Engagements" header + "+ New Engagement" button
   - Either the loading state, error state, or grid renders (depending on whether engagements are seeded)
   - `/portfolio/test-id` page renders an "Engagement not found" or loading state without crashing
   - The `MerrisTopBar` chip shows "No engagement selected" if `currentEngagement` is null
7. Build the web app: `pnpm --filter @merris/web build` — confirm clean and that `/portfolio` and `/portfolio/[id]` both appear in the route list with bundles larger than the placeholder versions.

No commit for this task unless you find a bug.

---

## Self-Review Checklist

1. **Spec coverage:**
   - POST /engagements endpoint ✓ Task 1
   - createEngagement client method ✓ Task 2
   - PortfolioGrid with empty/loading/error states ✓ Task 7
   - EngagementCard ✓ Task 4
   - NewEngagementModal ✓ Task 5
   - EngagementDetail orchestrator ✓ Task 10
   - 5 detail subcomponents ✓ Task 9
   - MerrisTopBar wired to engagement store ✓ Task 12

2. **Backwards compatibility:** the only modification outside `apps/web/components/portfolio/` is to `top-bar.tsx`. The existing `/intelligence` page still uses the same TopBar and will continue to render correctly (the chip text just changes from "QAPCO" to "No engagement selected" until something populates the store).

3. **Out of scope confirmed:**
   - DocumentViewer split-pane: NOT implemented (deferred to Plan 4.5)
   - Workflow Terminal action wiring: buttons render but click is a no-op
   - Real findings (uses `PLACEHOLDER_FINDINGS`)
   - Real framework compliance percentages (uses `PLACEHOLDER_FRAMEWORK_COMPLIANCE`)
   - Real team data (uses `PLACEHOLDER_TEAM`)
   - Velocity bar chart and Sovereign Intel side card (not implemented)

4. **Type consistency:** the `Engagement` type from `lib/api.ts` and the `EngagementSummary` type from `lib/store.ts` overlap but aren't identical. Components cast through `unknown` to bridge them. A future cleanup task should unify these into a single source of truth.

---

## Known Limitations / Follow-ups

- **No `GET /api/v1/engagements/:id` endpoint** — `EngagementDetail` does `listEngagements().find(...)` instead. Should add a real getter.
- **DocumentViewer split-pane** — entirely deferred. Plan 4.5 will build it.
- **No real findings** — the engagement detail page hardcodes three findings. Real wiring requires either enumerating disclosures (no endpoint exists) or a new aggregate endpoint like `GET /engagements/:id/findings`.
- **No real framework compliance** — also hardcoded.
- **Workflow Terminal actions are inert** — Run Full Review, Generate Report, Export Findings buttons render but don't call anything. Plan 5 may wire them.
- **Team data is hardcoded** — there's no team API endpoint yet.
- **MerrisTopBar dropdown is unsorted and doesn't filter** — fine for ~5 engagements; needs search for 50+.
- **NewEngagementModal doesn't validate frameworks against a schema** — backend just stores whatever array.
- **`EngagementSummary` and `Engagement` types should be unified.**
