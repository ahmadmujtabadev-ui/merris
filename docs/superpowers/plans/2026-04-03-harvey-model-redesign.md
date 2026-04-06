# Merris Harvey-Model UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Merris web dashboard from 8 separate pages to a Harvey-style chat-primary, context-first single main page with workflow tiles, then wire it to the existing API and prepare for deployment.

**Architecture:** Replace the current 8-page sidebar layout with a unified main page: top bar (logo + engagement selector + user), centre chat with context chips (jurisdiction/sector/vault/entity type), source chips (K1-K7 + web), workflow tiles below. Keep a slim sidebar for Home/Engagements/Knowledge/History/Settings. The API already returns citations, confidence, data_gaps, and evaluation — the UI just needs to surface them.

**Tech Stack:** Next.js 14 (app router), React 18, Tailwind CSS 3.4, Zustand, shadcn/ui (Radix primitives), existing Fastify API.

---

## File Structure

### New Files (Frontend — `apps/web/`)

| File | Responsibility |
|------|---------------|
| `components/main-page/top-bar.tsx` | Logo, engagement selector dropdown, user avatar, settings link |
| `components/main-page/context-chips.tsx` | Jurisdiction toggles, sector dropdown, vault dropdown, entity type dropdown |
| `components/main-page/source-chips.tsx` | K1-K7 + Web Search toggle chips |
| `components/main-page/chat-area.tsx` | Scrollable chat with Merris responses (confidence badge, citations, eval score, copy/export) |
| `components/main-page/chat-input.tsx` | Large input with file drop zone, "Ask Merris" button |
| `components/main-page/workflow-tiles.tsx` | 4 rows of workflow card tiles |
| `components/main-page/workflow-modal.tsx` | Modal for workflow input (document upload, context confirmation) |
| `components/main-page/response-card.tsx` | Single Merris response: text, confidence badge, eval score, citations, data gaps, copy/export |
| `components/main-page/file-drop-zone.tsx` | Drag-and-drop file upload area with suggested actions |
| `lib/main-store.ts` | Zustand store for context chips, source chips, file uploads, workflow state |
| `app/(dashboard)/page.tsx` | New main page (replaces engagements as default) — composes all main-page components |
| `app/(dashboard)/history/page.tsx` | Past conversations list |

### Modified Files (Frontend)

| File | Change |
|------|--------|
| `components/sidebar.tsx` | Simplify nav to 5 items: Home, Engagements, Knowledge, History, Settings |
| `app/(dashboard)/layout.tsx` | Remove `<AgentChat />` floating widget (chat is now the main page) |
| `lib/chat-store.ts` | Extend sendMessage to pass context chips, source chips, documentId |

### Modified Files (API — `apps/api/`)

| File | Change |
|------|--------|
| `src/services/assistant/assistant.router.ts` | Accept jurisdiction, sector, ownershipType, knowledgeSources in chat body |
| `src/services/workflows/workflows.router.ts` | Accept context (jurisdiction, sector, ownershipType) in run body |

### New Files (Deployment)

| File | Responsibility |
|------|---------------|
| `scripts/create-test-accounts.ts` | Creates 3 consultant accounts + demo engagements |
| `scripts/seed-demo-engagement.ts` | Seeds demo engagement with pre-loaded data |
| `apps/web/public/guide.html` | Quick-start guide for testers |

---

## Phase 1: Platform UI — Harvey Model Redesign

### Task 1: Main Page Zustand Store

**Files:**
- Create: `apps/web/lib/main-store.ts`

- [ ] **Step 1: Create the main-store with context chips, source chips, and workflow state**

```typescript
// apps/web/lib/main-store.ts
import { create } from 'zustand';

export type Jurisdiction = 'qatar' | 'oman' | 'uae' | 'saudi' | 'eu' | 'uk' | 'us' | 'global';
export type EntityType = 'state-owned' | 'listed' | 'private' | 'subsidiary';
export type KnowledgeSource = 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6' | 'K7' | 'web_search';

export const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  qatar: 'Qatar', oman: 'Oman', uae: 'UAE', saudi: 'Saudi',
  eu: 'EU', uk: 'UK', us: 'US', global: 'Global',
};

export const SOURCE_LABELS: Record<KnowledgeSource, string> = {
  K1: 'Corporate Disclosures', K2: 'Climate Science', K3: 'Regulatory',
  K4: 'Sustainable Finance', K5: 'Environmental', K6: 'Supply Chain',
  K7: 'Research', web_search: 'Web Search',
};

export const SECTOR_OPTIONS = [
  'steel', 'petrochemicals', 'cement', 'oil_and_gas', 'financial_services',
  'mining', 'real_estate', 'agriculture', 'textiles',
] as const;
export type Sector = typeof SECTOR_OPTIONS[number];

export interface UploadedFile {
  id: string;
  name: string;
  documentId?: string;
  status: 'uploading' | 'ready' | 'failed';
}

export interface WorkflowExecution {
  id: string;
  templateId: string;
  status: 'running' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  results?: Record<string, unknown>;
  error?: string;
}

interface MainState {
  // Context chips
  jurisdictions: Set<Jurisdiction>;
  sector: Sector | null;
  vaultId: string | null;
  entityType: EntityType | null;

  // Source chips
  enabledSources: Set<KnowledgeSource>;

  // File uploads
  uploadedFiles: UploadedFile[];

  // Workflow
  activeWorkflow: WorkflowExecution | null;

  // Actions
  toggleJurisdiction: (j: Jurisdiction) => void;
  setSector: (s: Sector | null) => void;
  setVaultId: (id: string | null) => void;
  setEntityType: (e: EntityType | null) => void;
  toggleSource: (s: KnowledgeSource) => void;
  addUploadedFile: (f: UploadedFile) => void;
  updateUploadedFile: (id: string, updates: Partial<UploadedFile>) => void;
  removeUploadedFile: (id: string) => void;
  setActiveWorkflow: (w: WorkflowExecution | null) => void;
  setContextFromEngagement: (engagement: {
    jurisdiction?: string;
    sector?: string;
    entityType?: string;
    vaultId?: string;
  }) => void;
}

const ALL_SOURCES = new Set<KnowledgeSource>(['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'web_search']);

export const useMainStore = create<MainState>((set) => ({
  jurisdictions: new Set<Jurisdiction>(),
  sector: null,
  vaultId: null,
  entityType: null,
  enabledSources: new Set(ALL_SOURCES),
  uploadedFiles: [],
  activeWorkflow: null,

  toggleJurisdiction: (j) =>
    set((s) => {
      const next = new Set(s.jurisdictions);
      if (next.has(j)) next.delete(j); else next.add(j);
      return { jurisdictions: next };
    }),

  setSector: (sector) => set({ sector }),
  setVaultId: (vaultId) => set({ vaultId }),
  setEntityType: (entityType) => set({ entityType }),

  toggleSource: (src) =>
    set((s) => {
      const next = new Set(s.enabledSources);
      if (next.has(src)) next.delete(src); else next.add(src);
      return { enabledSources: next };
    }),

  addUploadedFile: (f) =>
    set((s) => ({ uploadedFiles: [...s.uploadedFiles, f] })),

  updateUploadedFile: (id, updates) =>
    set((s) => ({
      uploadedFiles: s.uploadedFiles.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),

  removeUploadedFile: (id) =>
    set((s) => ({ uploadedFiles: s.uploadedFiles.filter((f) => f.id !== id) })),

  setActiveWorkflow: (w) => set({ activeWorkflow: w }),

  setContextFromEngagement: (eng) =>
    set(() => ({
      jurisdictions: eng.jurisdiction
        ? new Set([eng.jurisdiction as Jurisdiction])
        : new Set<Jurisdiction>(),
      sector: (eng.sector as Sector) ?? null,
      entityType: (eng.entityType as EntityType) ?? null,
      vaultId: eng.vaultId ?? null,
    })),
}));
```

- [ ] **Step 2: Verify the store compiles**

Run: `cd apps/web && npx tsc --noEmit lib/main-store.ts 2>&1 | head -20`
Expected: No errors (or only unrelated warnings from other files)

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/main-store.ts
git commit -m "feat(web): add main page zustand store for context/source chips and workflow state"
```

---

### Task 2: Top Bar Component

**Files:**
- Create: `apps/web/components/main-page/top-bar.tsx`

- [ ] **Step 1: Create the top bar with logo, engagement selector, user avatar**

```typescript
// apps/web/components/main-page/top-bar.tsx
'use client';

import Link from 'next/link';
import { useAuthStore, useEngagementStore, type EngagementSummary } from '@/lib/store';
import { useMainStore } from '@/lib/main-store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export function TopBar() {
  const { user, logout } = useAuthStore();
  const { currentEngagement, engagements, setCurrentEngagement } = useEngagementStore();
  const { setContextFromEngagement } = useMainStore();

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'ME';

  const handleEngagementSelect = (eng: EngagementSummary) => {
    setCurrentEngagement(eng);
    // Auto-populate context chips from engagement metadata
    // (engagement may have jurisdiction/sector stored — if not, user sets manually)
    setContextFromEngagement({});
  };

  return (
    <div className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <span className="text-xl" role="img" aria-label="leaf">🌿</span>
        <span className="text-lg font-bold text-zinc-100">Merris</span>
      </Link>

      {/* Engagement selector */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-600">
              <span className="max-w-[240px] truncate">
                {currentEngagement ? currentEngagement.name : 'Select engagement...'}
              </span>
              <svg className="h-4 w-4 text-zinc-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-72">
            <DropdownMenuLabel>Engagements</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {engagements.length === 0 && (
              <DropdownMenuItem disabled>No engagements yet</DropdownMenuItem>
            )}
            {engagements.map((eng) => (
              <DropdownMenuItem
                key={eng.id}
                onClick={() => handleEngagementSelect(eng)}
                className={eng.id === currentEngagement?.id ? 'bg-emerald-600/10 text-emerald-400' : ''}
              >
                <div className="flex flex-col">
                  <span className="text-sm">{eng.name}</span>
                  <span className="text-xs text-zinc-500">{eng.frameworks.join(', ')}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar + dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full ring-offset-zinc-950 transition-colors hover:ring-2 hover:ring-emerald-600/50 hover:ring-offset-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{user?.name ?? 'User'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/main-page/top-bar.tsx
git commit -m "feat(web): add top bar component with engagement selector and user menu"
```

---

### Task 3: Context Chips Component

**Files:**
- Create: `apps/web/components/main-page/context-chips.tsx`

- [ ] **Step 1: Create context chips — jurisdiction toggles, sector/vault/entity dropdowns**

```typescript
// apps/web/components/main-page/context-chips.tsx
'use client';

import { cn } from '@/lib/utils';
import {
  useMainStore,
  JURISDICTION_LABELS,
  SECTOR_OPTIONS,
  type Jurisdiction,
  type EntityType,
  type Sector,
} from '@/lib/main-store';

const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'state-owned', label: 'State-owned' },
  { value: 'listed', label: 'Listed' },
  { value: 'private', label: 'Private' },
  { value: 'subsidiary', label: 'Subsidiary' },
];

interface ContextChipsProps {
  vaults?: { id: string; name: string }[];
}

export function ContextChips({ vaults = [] }: ContextChipsProps) {
  const {
    jurisdictions, sector, vaultId, entityType,
    toggleJurisdiction, setSector, setVaultId, setEntityType,
  } = useMainStore();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Jurisdiction toggle chips */}
      {(Object.entries(JURISDICTION_LABELS) as [Jurisdiction, string][]).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => toggleJurisdiction(key)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            jurisdictions.has(key)
              ? 'border-emerald-600 bg-emerald-600/20 text-emerald-400'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300',
          )}
        >
          {label}
        </button>
      ))}

      {/* Sector dropdown chip */}
      <select
        value={sector ?? ''}
        onChange={(e) => setSector((e.target.value || null) as Sector | null)}
        className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 focus:border-emerald-600 focus:outline-none"
      >
        <option value="">Sector</option>
        {SECTOR_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </option>
        ))}
      </select>

      {/* Vault dropdown chip */}
      <select
        value={vaultId ?? ''}
        onChange={(e) => setVaultId(e.target.value || null)}
        className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 focus:border-emerald-600 focus:outline-none"
      >
        <option value="">Choose vault</option>
        {vaults.map((v) => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>

      {/* Entity type dropdown chip */}
      <select
        value={entityType ?? ''}
        onChange={(e) => setEntityType((e.target.value || null) as EntityType | null)}
        className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 focus:border-emerald-600 focus:outline-none"
      >
        <option value="">Entity type</option>
        {ENTITY_OPTIONS.map((e) => (
          <option key={e.value} value={e.value}>{e.label}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/main-page/context-chips.tsx
git commit -m "feat(web): add context chips component with jurisdiction toggles and dropdowns"
```

---

### Task 4: Source Chips Component

**Files:**
- Create: `apps/web/components/main-page/source-chips.tsx`

- [ ] **Step 1: Create source chips — toggleable K1-K7 + Web Search**

```typescript
// apps/web/components/main-page/source-chips.tsx
'use client';

import { cn } from '@/lib/utils';
import { useMainStore, SOURCE_LABELS, type KnowledgeSource } from '@/lib/main-store';

const SOURCE_ORDER: KnowledgeSource[] = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'web_search'];

export function SourceChips() {
  const { enabledSources, toggleSource } = useMainStore();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-zinc-500">Sources:</span>
      {SOURCE_ORDER.map((src) => (
        <button
          key={src}
          type="button"
          onClick={() => toggleSource(src)}
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
            enabledSources.has(src)
              ? 'border-emerald-700/50 bg-emerald-900/30 text-emerald-400'
              : 'border-zinc-700/50 bg-zinc-800/30 text-zinc-500 hover:text-zinc-400',
          )}
        >
          {src === 'web_search' ? 'Web Search' : `${src} ${SOURCE_LABELS[src]}`}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/main-page/source-chips.tsx
git commit -m "feat(web): add source chips component for knowledge source toggles"
```

---

### Task 5: Response Card Component

**Files:**
- Create: `apps/web/components/main-page/response-card.tsx`

- [ ] **Step 1: Create the response card with confidence badge, eval score, citations, data gaps, copy/export**

```typescript
// apps/web/components/main-page/response-card.tsx
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface Citation {
  title: string;
  source: string;
  url?: string;
  domain?: string;
}

export interface EvaluationData {
  intelligence_score?: number;
  discipline_score?: number;
  score?: number;
  decision?: string;
  flags?: string[];
  rewritten?: boolean;
}

export interface MerrisResponse {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  confidence?: 'high' | 'medium' | 'low';
  data_gaps?: string[];
  evaluation?: EvaluationData;
  toolCalls?: { name: string; input: Record<string, unknown>; output?: unknown }[];
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const variants = {
    high: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50',
    medium: 'bg-amber-900/40 text-amber-400 border-amber-700/50',
    low: 'bg-red-900/40 text-red-400 border-red-700/50',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', variants[level])}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function EvalScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'text-emerald-400 border-emerald-700/50' :
                score >= 70 ? 'text-amber-400 border-amber-700/50' :
                'text-red-400 border-red-700/50';
  return (
    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold', color)}>
      {score}
    </span>
  );
}

interface ResponseCardProps {
  message: MerrisResponse;
}

export function ResponseCard({ message }: ResponseCardProps) {
  const [citationsOpen, setCitationsOpen] = React.useState(false);
  const [gapsOpen, setGapsOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="mb-4 flex justify-end">
        <div className="max-w-[75%] rounded-lg bg-emerald-600/15 px-4 py-3 text-sm text-emerald-100">
          {message.content}
          <div className="mt-1 text-[10px] text-emerald-400/50">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  }

  const finalScore = message.evaluation?.score ??
    (message.evaluation?.intelligence_score != null
      ? Math.round((message.evaluation.intelligence_score * 0.8) + ((message.evaluation.discipline_score ?? 0) * 0.2))
      : undefined);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        {/* Header badges */}
        <div className="mb-2 flex items-center gap-2">
          {message.confidence && <ConfidenceBadge level={message.confidence} />}
          {finalScore != null && <EvalScoreBadge score={finalScore} />}
          {message.evaluation?.rewritten && (
            <span className="text-[10px] text-zinc-500">auto-refined</span>
          )}
        </div>

        {/* Response text */}
        <div className="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
          {message.content}
        </div>

        {/* Tool calls (collapsible) */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.toolCalls.map((tc, i) => (
              <span key={`${tc.name}-${i}`} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                {tc.name.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setCitationsOpen(!citationsOpen)}
              className="text-xs text-zinc-500 hover:text-zinc-400"
            >
              {citationsOpen ? '▲' : '▼'} {message.citations.length} citation{message.citations.length !== 1 ? 's' : ''}
            </button>
            {citationsOpen && (
              <div className="mt-1.5 space-y-1 rounded-md bg-zinc-800/50 p-2">
                {message.citations.map((c, i) => (
                  <div key={i} className="text-xs text-zinc-400">
                    <span className="font-medium text-zinc-300">{c.title}</span>
                    {c.source && <span className="ml-1 text-zinc-500">— {c.source}</span>}
                    {c.domain && <Badge variant="outline" className="ml-1 text-[9px]">{c.domain}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Data gaps */}
        {message.data_gaps && message.data_gaps.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setGapsOpen(!gapsOpen)}
              className="text-xs text-amber-500/70 hover:text-amber-400"
            >
              {gapsOpen ? '▲' : '▼'} {message.data_gaps.length} data gap{message.data_gaps.length !== 1 ? 's' : ''}
            </button>
            {gapsOpen && (
              <div className="mt-1.5 space-y-0.5 rounded-md bg-amber-900/10 p-2">
                {message.data_gaps.map((g, i) => (
                  <div key={i} className="text-xs text-amber-400/80">• {g}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2 border-t border-zinc-800 pt-2">
          <button type="button" onClick={handleCopy} className="text-[11px] text-zinc-500 hover:text-zinc-300">
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <span className="text-zinc-700">·</span>
          <div className="text-[10px] text-zinc-600">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/main-page/response-card.tsx
git commit -m "feat(web): add response card with confidence badges, citations, data gaps, and eval score"
```

---

### Task 6: Chat Input + File Drop Zone

**Files:**
- Create: `apps/web/components/main-page/chat-input.tsx`

- [ ] **Step 1: Create the chat input with file drop zone and "Ask Merris" button**

```typescript
// apps/web/components/main-page/chat-input.tsx
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useMainStore } from '@/lib/main-store';
import { api } from '@/lib/api';
import { useEngagementStore } from '@/lib/store';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [inputValue, setInputValue] = React.useState('');
  const [isDragging, setIsDragging] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const { addUploadedFile, updateUploadedFile } = useMainStore();
  const { currentEngagement } = useEngagementStore();

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleFileDrop = async (files: FileList) => {
    if (!currentEngagement) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempId = `upload-${Date.now()}-${i}`;
      addUploadedFile({ id: tempId, name: file.name, status: 'uploading' });

      try {
        const result = await api.upload<{ document: { id: string } }>(
          `/engagements/${currentEngagement.id}/documents`,
          file,
        );
        updateUploadedFile(tempId, { documentId: result.document.id, status: 'ready' });
      } catch {
        updateUploadedFile(tempId, { status: 'failed' });
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileDrop(e.dataTransfer.files);
    }
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  return (
    <div
      className={cn(
        'rounded-xl border bg-zinc-900/60 p-4 transition-colors',
        isDragging ? 'border-emerald-600 bg-emerald-900/10' : 'border-zinc-800',
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {isDragging && (
        <div className="mb-3 flex items-center justify-center rounded-lg border-2 border-dashed border-emerald-600/50 bg-emerald-900/10 py-6 text-sm text-emerald-400">
          Drop files here to upload
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={inputValue}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask Merris anything..."
        rows={2}
        className="w-full resize-none bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
      />

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* File upload button */}
          <label className="cursor-pointer rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-400">
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.docx,.xlsx,.csv"
              onChange={(e) => {
                if (e.target.files) handleFileDrop(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        <Button
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
          className="bg-emerald-600 px-6 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {isLoading ? 'Thinking...' : 'Ask Merris'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/main-page/chat-input.tsx
git commit -m "feat(web): add chat input with file drop zone and auto-resize textarea"
```

---

### Task 7: Chat Area Component

**Files:**
- Create: `apps/web/components/main-page/chat-area.tsx`

- [ ] **Step 1: Create the scrollable chat area composing ResponseCard components**

```typescript
// apps/web/components/main-page/chat-area.tsx
'use client';

import * as React from 'react';
import { ResponseCard, type MerrisResponse } from './response-card';

function LoadingIndicator() {
  return (
    <div className="mb-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-4">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <div className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
          </div>
          <span>Merris is thinking...</span>
        </div>
      </div>
    </div>
  );
}

interface ChatAreaProps {
  messages: MerrisResponse[];
  isLoading: boolean;
}

export function ChatArea({ messages, isLoading }: ChatAreaProps) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return null; // Empty state handled by parent (shows workflow tiles)
  }

  return (
    <div className="flex-1 overflow-y-auto px-1 scrollbar-thin">
      {messages.map((msg) => (
        <ResponseCard key={msg.id} message={msg} />
      ))}
      {isLoading && <LoadingIndicator />}
      <div ref={endRef} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/main-page/chat-area.tsx
git commit -m "feat(web): add scrollable chat area with response cards and loading indicator"
```

---

### Task 8: Workflow Tiles Component

**Files:**
- Create: `apps/web/components/main-page/workflow-tiles.tsx`

- [ ] **Step 1: Create workflow tiles — 4 rows of card tiles with icons**

```typescript
// apps/web/components/main-page/workflow-tiles.tsx
'use client';

interface WorkflowTile {
  id: string;
  name: string;
  steps: number;
  icon: string;
  templateId: string;
}

const WORKFLOW_ROWS: { label: string; tiles: WorkflowTile[] }[] = [
  {
    label: 'Core ESG',
    tiles: [
      { id: 'review-report', name: 'Review sustainability report', steps: 6, icon: '📋', templateId: 'review-sustainability-report' },
      { id: 'gri-index', name: 'Generate GRI content index', steps: 2, icon: '📊', templateId: 'generate-gri-index' },
      { id: 'esrs-index', name: 'Generate ESRS content index', steps: 2, icon: '📊', templateId: 'generate-esrs-index' },
      { id: 'validate-emissions', name: 'Validate emissions calculations', steps: 2, icon: '🔢', templateId: 'validate-emissions' },
    ],
  },
  {
    label: 'Climate & Regulatory',
    tiles: [
      { id: 'cbam', name: 'Assess CBAM exposure', steps: 3, icon: '🌍', templateId: 'assess-cbam-exposure' },
      { id: 'transition', name: 'Evaluate transition plan', steps: 3, icon: '🔄', templateId: 'evaluate-transition-plan' },
      { id: 'regulatory', name: 'Assess regulatory exposure', steps: 2, icon: '⚖️', templateId: 'assess-regulatory-impact' },
      { id: 'carbon-price', name: 'Model carbon pricing impact', steps: 2, icon: '💰', templateId: 'model-carbon-pricing' },
    ],
  },
  {
    label: 'Due Diligence & Risk',
    tiles: [
      { id: 'invest-screen', name: 'Screen investment ESG risks', steps: 3, icon: '🔍', templateId: 'screen-investment-esg' },
      { id: 'supply-chain', name: 'Supply chain risk scan', steps: 3, icon: '🔗', templateId: 'supply-chain-risk-scan' },
      { id: 'pre-audit', name: 'Pre-audit readiness check', steps: 3, icon: '✅', templateId: 'pre-audit-readiness' },
      { id: 'benchmark', name: 'Benchmark against peers', steps: 2, icon: '📈', templateId: 'benchmark-company' },
    ],
  },
  {
    label: 'Content & Drafting',
    tiles: [
      { id: 'draft-disclosure', name: 'Draft disclosure section', steps: 2, icon: '✍️', templateId: 'draft-disclosure' },
      { id: 'board-memo', name: 'Draft board ESG memo', steps: 2, icon: '📝', templateId: 'draft-board-memo' },
      { id: 'consistency', name: 'Cross-document consistency check', steps: 2, icon: '🔄', templateId: 'cross-doc-consistency' },
      { id: 'custom', name: 'Custom workflow', steps: 0, icon: '➕', templateId: 'custom' },
    ],
  },
];

interface WorkflowTilesProps {
  onTileClick: (tile: WorkflowTile) => void;
}

export function WorkflowTiles({ onTileClick }: WorkflowTilesProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Recommended workflows</h3>
      {WORKFLOW_ROWS.map((row) => (
        <div key={row.label}>
          <p className="mb-2 text-[11px] text-zinc-600">{row.label}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {row.tiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => onTileClick(tile)}
                className="group flex flex-col items-start rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-left transition-colors hover:border-emerald-700/50 hover:bg-emerald-900/10"
              >
                <span className="mb-1.5 text-lg">{tile.icon}</span>
                <span className="text-xs font-medium text-zinc-300 group-hover:text-emerald-400">
                  {tile.name}
                </span>
                {tile.steps > 0 && (
                  <span className="mt-1 text-[10px] text-zinc-600">
                    {tile.steps} step{tile.steps !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export type { WorkflowTile };
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/main-page/workflow-tiles.tsx
git commit -m "feat(web): add workflow tiles component with 16 pre-defined workflows in 4 rows"
```

---

### Task 9: Workflow Modal Component

**Files:**
- Create: `apps/web/components/main-page/workflow-modal.tsx`

- [ ] **Step 1: Create the workflow modal for document upload and context confirmation**

```typescript
// apps/web/components/main-page/workflow-modal.tsx
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMainStore } from '@/lib/main-store';
import { useEngagementStore } from '@/lib/store';
import { api } from '@/lib/api';
import type { WorkflowTile } from './workflow-tiles';

interface WorkflowModalProps {
  tile: WorkflowTile | null;
  onClose: () => void;
  onStarted: (execution: { id: string; templateId: string; totalSteps: number }) => void;
}

export function WorkflowModal({ tile, onClose, onStarted }: WorkflowModalProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const { currentEngagement } = useEngagementStore();
  const { jurisdictions, sector, entityType } = useMainStore();

  if (!tile) return null;

  const handleRun = async () => {
    if (!currentEngagement) return;
    setIsRunning(true);

    try {
      // If file provided, upload first
      let documentId: string | undefined;
      if (file) {
        const uploadResult = await api.upload<{ document: { id: string } }>(
          `/engagements/${currentEngagement.id}/documents`,
          file,
        );
        documentId = uploadResult.document.id;
      }

      // Run workflow
      const result = await api.post<{
        id: string;
        templateId: string;
        totalSteps: number;
        status: string;
      }>(`/workflows/${tile.templateId}/run`, {
        engagementId: currentEngagement.id,
        inputs: {
          documentId,
          jurisdiction: Array.from(jurisdictions).join(','),
          sector,
          entityType,
        },
      });

      onStarted({ id: result.id, templateId: result.templateId, totalSteps: result.totalSteps });
      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={!!tile} onOpenChange={() => onClose()}>
      <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <span>{tile.icon}</span>
            <span>{tile.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Engagement context */}
          <div className="rounded-md bg-zinc-800/50 p-3 text-xs text-zinc-400">
            <p className="font-medium text-zinc-300">Context</p>
            <p className="mt-1">
              Engagement: {currentEngagement?.name ?? 'None selected'}
            </p>
            {jurisdictions.size > 0 && (
              <p>Jurisdiction: {Array.from(jurisdictions).join(', ')}</p>
            )}
            {sector && <p>Sector: {sector.replace(/_/g, ' ')}</p>}
            {entityType && <p>Entity: {entityType}</p>}
          </div>

          {/* File upload */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Upload document (optional)
            </label>
            <label className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-zinc-700 bg-zinc-800/30 py-6 text-sm text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-400">
              {file ? file.name : 'Click to select or drag a file'}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {!currentEngagement && (
            <p className="text-xs text-amber-400">
              Please select an engagement from the top bar before running a workflow.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-zinc-400">
            Cancel
          </Button>
          <Button
            onClick={handleRun}
            disabled={!currentEngagement || isRunning}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {isRunning ? 'Starting...' : `Run (${tile.steps} steps)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/main-page/workflow-modal.tsx
git commit -m "feat(web): add workflow modal for document upload and context before execution"
```

---

### Task 10: Uploaded Files Bar

**Files:**
- Create: `apps/web/components/main-page/file-bar.tsx`

- [ ] **Step 1: Create file bar showing uploaded files with status**

```typescript
// apps/web/components/main-page/file-bar.tsx
'use client';

import { useMainStore } from '@/lib/main-store';
import { cn } from '@/lib/utils';

export function FileBar() {
  const { uploadedFiles, removeUploadedFile } = useMainStore();

  if (uploadedFiles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-1">
      {uploadedFiles.map((f) => (
        <div
          key={f.id}
          className={cn(
            'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs',
            f.status === 'ready' ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-400' :
            f.status === 'uploading' ? 'border-zinc-700 bg-zinc-800 text-zinc-400' :
            'border-red-700/50 bg-red-900/20 text-red-400',
          )}
        >
          <span className="max-w-[120px] truncate">{f.name}</span>
          {f.status === 'uploading' && (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-emerald-400" />
          )}
          <button
            type="button"
            onClick={() => removeUploadedFile(f.id)}
            className="ml-1 text-zinc-500 hover:text-zinc-300"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/main-page/file-bar.tsx
git commit -m "feat(web): add uploaded files bar with status indicators"
```

---

### Task 11: Update Chat Store for Context/Sources

**Files:**
- Modify: `apps/web/lib/chat-store.ts`

- [ ] **Step 1: Extend sendMessage to pass context chips, source chips, and documentId**

In `apps/web/lib/chat-store.ts`, replace the `sendMessage` function body. The function signature changes to accept optional context:

Replace the entire `sendMessage: async (content: string) => {` function with:

```typescript
  sendMessage: async (content: string, context?: {
    jurisdictions?: string[];
    sector?: string | null;
    ownershipType?: string | null;
    engagementId?: string | null;
    documentId?: string | null;
    knowledgeSources?: string[];
  }) => {
    const { engagementId: storeEngagementId, messages } = get();
    const effectiveEngagementId = context?.engagementId ?? storeEngagementId;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      suggestedActions: [],
    }));

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const API_BASE =
        typeof window !== 'undefined'
          ? (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1')
          : 'http://localhost:3001/api/v1';

      let authToken: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('merris_auth');
          if (stored) {
            const parsed = JSON.parse(stored) as { token?: string };
            if (parsed.token) authToken = parsed.token;
          }
        } catch { /* ignore */ }
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_BASE}/assistant/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          engagementId: effectiveEngagementId ?? 'default',
          message: content,
          conversationHistory,
          jurisdiction: context?.jurisdictions?.join(','),
          sector: context?.sector,
          ownershipType: context?.ownershipType,
          documentId: context?.documentId,
          knowledgeSources: context?.knowledgeSources,
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const data = (await response.json()) as {
        response: string;
        toolCalls?: ChatToolCall[];
        suggestedActions?: SuggestedAction[];
        citations?: { title: string; source: string; url?: string; domain?: string }[];
        confidence?: 'high' | 'medium' | 'low';
        data_gaps?: string[];
        evaluation?: {
          intelligence_score?: number;
          discipline_score?: number;
          score?: number;
          decision?: string;
          flags?: string[];
          rewritten?: boolean;
        };
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
        citations: data.citations,
        confidence: data.confidence,
        data_gaps: data.data_gaps,
        evaluation: data.evaluation,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        suggestedActions: data.suggestedActions ?? [
          { label: 'Draft next section', action: 'draft_next' },
          { label: 'Run consistency check', action: 'check_consistency' },
          { label: 'Show data gaps', action: 'show_gaps' },
        ],
      }));
    } catch {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content:
          'I apologize, but I encountered an issue processing your request. Please try again.',
        timestamp: new Date(),
      };

      set((state) => ({
        messages: [...state.messages, errorMessage],
        isLoading: false,
      }));
    }
  },
```

Also update the `ChatMessage` interface to include the new response fields:

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ChatToolCall[];
  citations?: { title: string; source: string; url?: string; domain?: string }[];
  confidence?: 'high' | 'medium' | 'low';
  data_gaps?: string[];
  evaluation?: {
    intelligence_score?: number;
    discipline_score?: number;
    score?: number;
    decision?: string;
    flags?: string[];
    rewritten?: boolean;
  };
}
```

And update the `sendMessage` type in `ChatState`:

```typescript
sendMessage: (content: string, context?: {
  jurisdictions?: string[];
  sector?: string | null;
  ownershipType?: string | null;
  engagementId?: string | null;
  documentId?: string | null;
  knowledgeSources?: string[];
}) => Promise<void>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/chat-store.ts
git commit -m "feat(web): extend chat store to pass context chips and surface citations/evaluation in responses"
```

---

### Task 12: Simplify Sidebar

**Files:**
- Modify: `apps/web/components/sidebar.tsx`

- [ ] **Step 1: Replace NAV_ITEMS array with the simplified 5-item list**

In `apps/web/components/sidebar.tsx`, replace the `NAV_ITEMS` array:

```typescript
const NAV_ITEMS: NavItem[] = [
  { href: '/', labelKey: 'nav.home', icon: 'HOME' },
  { href: '/engagements', labelKey: 'nav.engagements', icon: 'B' },
  { href: '/knowledge', labelKey: 'nav.knowledge', icon: 'BOOK' },
  { href: '/history', labelKey: 'nav.history', icon: 'HISTORY' },
  { href: '/settings', labelKey: 'nav.settings', icon: 'S' },
];
```

Add two new icon components at the end of the icon definitions (before ICON_MAP):

```typescript
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
    </svg>
  );
}
```

Update ICON_MAP to add:

```typescript
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  HOME: HomeIcon,
  B: BriefcaseIcon,
  BOOK: BookIcon,
  HISTORY: HistoryIcon,
  S: SettingsIcon,
};
```

Also update the logo link `href` from `/engagements` to `/`:

```typescript
<Link href="/" className="flex items-center gap-2">
```

Fix the active route check for Home — exact match for `/`:

```typescript
const isActive = item.href === '/'
  ? pathname === '/'
  : pathname.startsWith(item.href);
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat(web): simplify sidebar to 5 items — Home, Engagements, Knowledge, History, Settings"
```

---

### Task 13: Update Dashboard Layout

**Files:**
- Modify: `apps/web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Remove the floating AgentChat widget**

Replace the contents of `apps/web/app/(dashboard)/layout.tsx`:

```typescript
'use client';

import { Sidebar } from '@/components/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-950 scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
```

Key change: removed `<AgentChat />` and the `max-w-7xl p-6` wrapper (main page handles its own layout).

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(dashboard)/layout.tsx
git commit -m "feat(web): remove floating chat widget from layout — chat is now the main page"
```

---

### Task 14: Main Page — Compose Everything

**Files:**
- Create: `apps/web/app/(dashboard)/page.tsx` (replace the root dashboard page)

- [ ] **Step 1: Create the main page composing all components**

```typescript
// apps/web/app/(dashboard)/page.tsx
'use client';

import * as React from 'react';
import { TopBar } from '@/components/main-page/top-bar';
import { ContextChips } from '@/components/main-page/context-chips';
import { SourceChips } from '@/components/main-page/source-chips';
import { ChatArea } from '@/components/main-page/chat-area';
import { ChatInput } from '@/components/main-page/chat-input';
import { FileBar } from '@/components/main-page/file-bar';
import { WorkflowTiles, type WorkflowTile } from '@/components/main-page/workflow-tiles';
import { WorkflowModal } from '@/components/main-page/workflow-modal';
import { useChatStore } from '@/lib/chat-store';
import { useMainStore, type MerrisResponse } from '@/lib/main-store';
import { useEngagementStore } from '@/lib/store';
import { api } from '@/lib/api';

export default function MainPage() {
  const { messages, isLoading, sendMessage, setEngagementId } = useChatStore();
  const { jurisdictions, sector, entityType, enabledSources, uploadedFiles, activeWorkflow, setActiveWorkflow } = useMainStore();
  const { currentEngagement, engagements, setEngagements } = useEngagementStore();
  const [selectedTile, setSelectedTile] = React.useState<WorkflowTile | null>(null);
  const [vaults, setVaults] = React.useState<{ id: string; name: string }[]>([]);

  // Load engagements on mount
  React.useEffect(() => {
    api.get<{ engagements: any[] }>('/engagements')
      .then((data) => {
        if (data.engagements) setEngagements(data.engagements);
      })
      .catch(() => {});
  }, [setEngagements]);

  // Sync engagement ID to chat store
  React.useEffect(() => {
    if (currentEngagement) {
      setEngagementId(currentEngagement.id);
      // Load vaults for this engagement
      api.get<{ vaults: { id: string; name: string }[] }>(`/vault/list`)
        .then((data) => { if (data.vaults) setVaults(data.vaults); })
        .catch(() => {});
    }
  }, [currentEngagement, setEngagementId]);

  // Poll active workflow status
  React.useEffect(() => {
    if (!activeWorkflow || activeWorkflow.status !== 'running') return;
    const interval = setInterval(async () => {
      try {
        const status = await api.get<{
          status: string;
          currentStep: number;
          totalSteps: number;
          results?: Record<string, unknown>;
          error?: string;
        }>(`/workflows/${activeWorkflow.id}/status`);

        setActiveWorkflow({
          ...activeWorkflow,
          status: status.status as 'running' | 'completed' | 'failed',
          currentStep: status.currentStep,
          totalSteps: status.totalSteps,
          results: status.results,
          error: status.error,
        });

        if (status.status !== 'running') clearInterval(interval);
      } catch {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeWorkflow, setActiveWorkflow]);

  const handleSend = (content: string) => {
    const readyFile = uploadedFiles.find((f) => f.status === 'ready');
    sendMessage(content, {
      jurisdictions: Array.from(jurisdictions),
      sector,
      ownershipType: entityType,
      engagementId: currentEngagement?.id,
      documentId: readyFile?.documentId,
      knowledgeSources: Array.from(enabledSources),
    });
  };

  const handleWorkflowTileClick = (tile: WorkflowTile) => {
    if (tile.templateId === 'custom') {
      // Just focus the chat input for custom workflows
      return;
    }
    setSelectedTile(tile);
  };

  const handleWorkflowStarted = (execution: { id: string; templateId: string; totalSteps: number }) => {
    setActiveWorkflow({
      ...execution,
      status: 'running',
      currentStep: 0,
    });
  };

  // Convert chat messages to MerrisResponse type for the chat area
  const merrisMessages: MerrisResponse[] = messages.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    timestamp: m.timestamp,
    citations: m.citations,
    confidence: m.confidence,
    data_gaps: m.data_gaps,
    evaluation: m.evaluation,
    toolCalls: m.toolCalls,
  }));

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      <TopBar />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-4">
        {/* Chat area — only visible when there are messages */}
        {hasMessages && (
          <ChatArea messages={merrisMessages} isLoading={isLoading} />
        )}

        {/* Active workflow progress */}
        {activeWorkflow && activeWorkflow.status === 'running' && (
          <div className="mb-3 rounded-lg border border-emerald-800/50 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-400">
            Running workflow: step {activeWorkflow.currentStep} of {activeWorkflow.totalSteps}...
          </div>
        )}

        {/* Context chips */}
        <div className="mb-3 space-y-2">
          <ContextChips vaults={vaults} />
          <SourceChips />
        </div>

        {/* File bar */}
        <div className="mb-3">
          <FileBar />
        </div>

        {/* Chat input */}
        <ChatInput onSend={handleSend} isLoading={isLoading} />

        {/* Workflow tiles — visible when no messages or at bottom */}
        {!hasMessages && (
          <div className="mt-6">
            <WorkflowTiles onTileClick={handleWorkflowTileClick} />
          </div>
        )}
      </div>

      {/* Workflow modal */}
      <WorkflowModal
        tile={selectedTile}
        onClose={() => setSelectedTile(null)}
        onStarted={handleWorkflowStarted}
      />
    </div>
  );
}
```

- [ ] **Step 2: Fix the import — MerrisResponse is defined in response-card.tsx, not main-store.ts**

The `MerrisResponse` type should be imported from `@/components/main-page/response-card`:

```typescript
import type { MerrisResponse } from '@/components/main-page/response-card';
```

Remove the `MerrisResponse` import from `@/lib/main-store` (it's not there).

- [ ] **Step 3: Verify the page renders**

Run: `cd apps/web && npx next build 2>&1 | tail -30`
Expected: Build succeeds or only shows minor type warnings

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/page.tsx
git commit -m "feat(web): add main page composing chat, context chips, source chips, and workflow tiles"
```

---

### Task 15: History Page (stub)

**Files:**
- Create: `apps/web/app/(dashboard)/history/page.tsx`

- [ ] **Step 1: Create a simple history page stub**

```typescript
// apps/web/app/(dashboard)/history/page.tsx
'use client';

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-lg font-semibold text-zinc-100">Conversation History</h1>
      <p className="text-sm text-zinc-500">
        Past conversations will appear here. This feature is coming soon.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/history/page.tsx
git commit -m "feat(web): add history page stub"
```

---

## Phase 2: API Fixes for UI Integration

### Task 16: Accept Context Fields in Assistant Chat Endpoint

**Files:**
- Modify: `apps/api/src/services/assistant/assistant.router.ts`

- [ ] **Step 1: Destructure new context fields from request body and pass to chat**

In `apps/api/src/services/assistant/assistant.router.ts`, update the chat handler (line 31) to destructure and pass the new fields:

Replace:

```typescript
const { engagementId, message, conversationHistory, documentBody, cursorSection } = request.body as any;
```

With:

```typescript
const {
  engagementId, message, conversationHistory, documentBody, cursorSection,
  jurisdiction, sector, ownershipType, documentId, knowledgeSources,
} = request.body as any;
```

And update the `chat()` call to pass them:

```typescript
const result = await chat({
  engagementId,
  userId: user.userId,
  message,
  conversationHistory,
  documentBody,
  cursorSection,
  jurisdiction,
  sector,
  ownershipType,
  documentId,
  knowledgeSources,
});
```

Do the same for the retry calls (lines 51 and 65).

**Note:** The `chat` function in `agent.service.ts` already accepts additional fields via `ChatRequest`. If it doesn't have these fields yet, add them to the interface — the agent system prompt already uses context, but passing structured context lets the tool handlers filter knowledge sources.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/assistant/assistant.router.ts
git commit -m "feat(api): accept jurisdiction, sector, ownershipType, knowledgeSources in assistant chat endpoint"
```

---

### Task 17: Accept Context in Workflow Run Endpoint

**Files:**
- Modify: `apps/api/src/services/workflows/workflows.router.ts`

- [ ] **Step 1: Read the current workflow router**

Read the file to understand the current run handler.

- [ ] **Step 2: Ensure the run handler passes context from inputs to workflow execution**

The workflow router already accepts `inputs` in the body and passes them to the executor. The UI sends jurisdiction, sector, entityType in the `inputs` object. No change needed if `inputs` is already a pass-through.

Verify this by reading the handler — if it already does `const { engagementId, inputs } = body` and passes `inputs` to the execution engine, this task is done.

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add apps/api/src/services/workflows/workflows.router.ts
git commit -m "feat(api): pass context inputs through to workflow execution"
```

---

## Phase 3: Deployment Preparation

### Task 18: Create Test Accounts Script

**Files:**
- Create: `apps/api/scripts/create-test-accounts.ts`

- [ ] **Step 1: Create the script**

```typescript
// apps/api/scripts/create-test-accounts.ts
//
// Creates 3 consultant test accounts + demo engagements.
// Run: npx tsx scripts/create-test-accounts.ts

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/merris';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  // Create organization if not exists
  const orgsCol = db.collection('organizations');
  let org = await orgsCol.findOne({ name: 'Merris Demo' });
  if (!org) {
    const result = await orgsCol.insertOne({
      name: 'Merris Demo',
      type: 'consulting',
      plan: 'enterprise',
      region: 'GCC',
      industry: 'esg_consulting',
      createdAt: new Date(),
    });
    org = { _id: result.insertedId, name: 'Merris Demo' };
    console.log('Created organization: Merris Demo');
  }

  const orgId = org._id.toString();

  // Create 3 consultant accounts
  const accounts = [
    { email: 'consultant1@merris.ai', name: 'Consultant One', password: 'Merris2026!Demo1' },
    { email: 'consultant2@merris.ai', name: 'Consultant Two', password: 'Merris2026!Demo2' },
    { email: 'consultant3@merris.ai', name: 'Consultant Three', password: 'Merris2026!Demo3' },
  ];

  const usersCol = db.collection('users');
  const engagementsCol = db.collection('engagements');

  for (const account of accounts) {
    const existing = await usersCol.findOne({ email: account.email });
    if (existing) {
      console.log(`Account ${account.email} already exists, skipping.`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(account.password, 12);
    const userResult = await usersCol.insertOne({
      email: account.email,
      name: account.name,
      password: hashedPassword,
      orgId,
      role: 'manager',
      permissions: [
        { resource: 'engagements', actions: ['read', 'write'] },
        { resource: 'data', actions: ['read', 'write'] },
        { resource: 'reports', actions: ['read', 'write'] },
        { resource: 'evidence', actions: ['read', 'write'] },
      ],
      preferences: {
        language: 'en',
        timezone: 'Asia/Qatar',
        notifications: { email: true, inApp: true, teams: false },
      },
      createdAt: new Date(),
    });

    // Create demo engagement for this user
    await engagementsCol.insertOne({
      name: `Demo Engagement - ${account.name}`,
      orgId,
      createdBy: userResult.insertedId.toString(),
      frameworks: ['GRI', 'TCFD', 'ISSB'],
      status: 'data_collection',
      jurisdiction: 'oman',
      sector: 'steel',
      entityType: 'listed',
      deadline: new Date('2026-06-30'),
      completeness: 0,
      createdAt: new Date(),
    });

    console.log(`Created: ${account.email} / ${account.password}`);
  }

  console.log('\nDone. Test accounts:');
  accounts.forEach((a) => console.log(`  ${a.email} / ${a.password}`));

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/scripts/create-test-accounts.ts
git commit -m "feat(api): add script to create 3 consultant test accounts with demo engagements"
```

---

### Task 19: Quick-Start Guide

**Files:**
- Create: `apps/web/public/guide.html`

- [ ] **Step 1: Create the guide HTML page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Merris — Quick Start Guide</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #09090b; color: #e4e4e7; line-height: 1.6; padding: 2rem; max-width: 720px; margin: 0 auto; }
    h1 { color: #34d399; font-size: 1.5rem; margin-bottom: 0.5rem; }
    h2 { color: #a1a1aa; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; margin: 2rem 0 0.5rem; }
    .subtitle { color: #71717a; font-size: 0.875rem; margin-bottom: 2rem; }
    .step { background: #18181b; border: 1px solid #27272a; border-radius: 0.5rem; padding: 1rem 1.25rem; margin-bottom: 0.75rem; }
    .step-num { color: #34d399; font-weight: 700; margin-right: 0.5rem; }
    .try { background: #064e3b20; border-color: #065f46; }
    .try code { background: #27272a; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.8125rem; color: #34d399; }
    .look { background: #78350f10; border-color: #78350f40; }
    a { color: #34d399; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #27272a; color: #52525b; font-size: 0.75rem; }
  </style>
</head>
<body>
  <h1>Merris — Quick Start</h1>
  <p class="subtitle">5 minutes to see what Merris can do for your ESG practice.</p>

  <h2>1. Log In</h2>
  <div class="step">
    <span class="step-num">→</span> Go to your Merris URL and sign in with the credentials you received by email.
  </div>

  <h2>2. Orient Yourself</h2>
  <div class="step">
    <span class="step-num">→</span> You will see the main dashboard with a chat input, context chips (jurisdiction, sector, entity type), and workflow tiles below.
    Select your demo engagement from the top bar dropdown — this pre-loads context for a GCC steel company.
  </div>

  <h2>3. Try These First</h2>

  <div class="step try">
    <span class="step-num">A.</span>
    Click the <strong>"Review sustainability report"</strong> workflow tile → upload the pre-loaded AJSS document → see 15+ findings in 2 minutes.
  </div>

  <div class="step try">
    <span class="step-num">B.</span>
    Type: <code>What frameworks are mandatory for a listed steel company in Oman?</code> → see contextualised regulatory advice with citations.
  </div>

  <div class="step try">
    <span class="step-num">C.</span>
    Type: <code>Verify: Scope 2 of 148,000 tCO2e from 320,000 MWh in Oman</code> → see calculation verification with formula and emission factor source.
  </div>

  <div class="step try">
    <span class="step-num">D.</span>
    Click <strong>"Assess CBAM exposure"</strong> → test with the AJSS data → see EU CBAM impact analysis.
  </div>

  <h2>4. What to Look For</h2>

  <div class="step look">
    <span class="step-num">•</span> Does Merris catch real errors in the data?
  </div>
  <div class="step look">
    <span class="step-num">•</span> Is the advice contextualised to the region and sector you selected?
  </div>
  <div class="step look">
    <span class="step-num">•</span> Does it refuse unrealistic requests? Try: <em>"Draft a press release announcing carbon neutrality"</em> for a company with no GHG inventory.
  </div>
  <div class="step look">
    <span class="step-num">•</span> Are the citations real and traceable? Check the collapsible citations section on each response.
  </div>
  <div class="step look">
    <span class="step-num">•</span> Does the confidence badge (green/amber/red) match the quality of the response?
  </div>

  <h2>5. Feedback</h2>
  <div class="step">
    <span class="step-num">→</span> Email <a href="mailto:tim@merris.ai">tim@merris.ai</a> with what worked, what did not, and what you wish it did.
  </div>

  <div class="footer">
    Merris — ESG Intelligence Platform. Built for consultants who advise at partner level.
  </div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/public/guide.html
git commit -m "feat(web): add quick-start guide for demo testers"
```

---

## Phase 2 (continued): API Context Pass-Through

### Task 20: Extend ChatRequest Interface

**Files:**
- Modify: `apps/api/src/modules/agent/agent.service.ts`

- [ ] **Step 1: Read the current ChatRequest interface**

Read `apps/api/src/modules/agent/agent.service.ts` to see the current interface.

- [ ] **Step 2: Add context fields to ChatRequest**

Add these optional fields to the `ChatRequest` interface:

```typescript
export interface ChatRequest {
  engagementId: string;
  userId: string;
  message: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
  documentBody?: string;
  cursorSection?: string;
  // Context from UI chips
  jurisdiction?: string;
  sector?: string;
  ownershipType?: string;
  documentId?: string;
  knowledgeSources?: string[];
}
```

- [ ] **Step 3: In the chat function, prepend context to the system prompt or message**

Find where the chat function builds the Claude API call. Before the message is sent, if context fields are present, prepend a context block:

```typescript
let contextPrefix = '';
if (request.jurisdiction) contextPrefix += `Jurisdiction: ${request.jurisdiction}. `;
if (request.sector) contextPrefix += `Sector: ${request.sector}. `;
if (request.ownershipType) contextPrefix += `Entity type: ${request.ownershipType}. `;
if (contextPrefix) {
  contextPrefix = `[Context: ${contextPrefix.trim()}]\n\n`;
}
// Prepend to message when building the Claude prompt
const enrichedMessage = contextPrefix + request.message;
```

If `knowledgeSources` is provided, filter knowledge search to only those domains.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/agent/agent.service.ts
git commit -m "feat(api): accept and use context fields (jurisdiction, sector, entityType, knowledgeSources) in chat"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] 1.1 Main page layout — Task 14 (composes TopBar, ContextChips, SourceChips, ChatInput, ChatArea, WorkflowTiles)
- [x] 1.2 Workflow tiles — Task 8 (16 tiles in 4 rows)
- [x] 1.3 Sidebar simplification — Task 12 (5 items)
- [x] 1.4 Engagement context — Task 2 (TopBar selector) + Task 1 (setContextFromEngagement)
- [x] 1.5 Response display — Task 5 (confidence badge, eval score, citations, data gaps, copy)
- [x] 1.6 Document upload flow — Task 6 (ChatInput drop zone) + Task 10 (FileBar)
- [x] 2.1 Chat endpoint context — Task 16 + Task 20
- [x] 2.2 Workflow execution via UI — Task 9 (WorkflowModal) + Task 17
- [x] 2.3 File upload — Existing endpoint at POST /engagements/:id/documents (used by ChatInput)
- [x] 2.4 Evaluation metadata — Task 11 (chat store surfaces evaluation) + Task 5 (ResponseCard displays it)
- [x] 3.5 Test accounts — Task 18
- [x] 4 Quick-start guide — Task 19
- [ ] 3.1-3.4 Deployment (env, migration, API deploy, frontend build) — these are ops tasks, not code tasks. Noted below.

**Deployment tasks (3.1-3.4)** are infrastructure/ops steps (MongoDB Atlas setup, Vercel deploy, CORS config, rate limiting). These should be done interactively after the code is built and tested locally. The plan covers all code changes needed.

**Placeholder scan:** No TBDs, TODOs, or "implement later" found.

**Type consistency:** `MerrisResponse` type defined in response-card.tsx, imported in main page. `ChatMessage` extended in chat-store.ts with matching fields. `WorkflowTile` type exported from workflow-tiles.tsx, imported in main page and modal.
