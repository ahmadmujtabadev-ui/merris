# Remaining Pages Implementation Plan (Plan 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Replace the placeholder stubs for the seven remaining prototype pages — Knowledge, Workflow Agents, Compliance, Firm Library, History, AI Config, Settings — with prototype-faithful static implementations using the existing Merris primitives. No new backend endpoints.

**Architecture:** Each page is a single client component (or page-level Server Component wrapping a client component) that renders a static composition matching the merris-platform-7 prototype. Data is hardcoded in tiny `*-data.ts` files alongside the components — this matches the prototype, which itself is fully hardcoded. AI Config and Settings persist a few user preferences to `localStorage`. Real backend wiring (knowledge-base collections, workflow execution, framework compliance, history feed) is documented as Plan 5 follow-ups.

**Tech Stack:** Same as Plan 3/4 — Next.js client components, Tailwind, existing `apps/web/components/merris/*` primitives.

**Critical context for the implementer:** the existing `api` client has typed methods (`listKnowledgeCollections`, `listWorkflows`, `executeWorkflow`, `getDisclosureFindings`) that map to **fictional** backend routes — those endpoints don't exist. **Do NOT call any of those methods from Plan 5 pages.** Use hardcoded data instead. Wiring them up is a separate plan.

**Out of scope:**
- Backend route additions
- Workflow Agents "Builder" tab (Library tab only)
- Actual workflow execution (Run buttons are inert)
- Real history (hardcoded list)
- Real team data, real billing, real preferences (Settings page is read-only display)
- Drag-to-reorder on AI Config Knowledge Priorities
- File upload on Firm Library

---

## File Structure (end state)

```
apps/web/
├── app/(dashboard)/
│   ├── knowledge/page.tsx          (replaced)
│   ├── workflow-agents/page.tsx    (replaced)
│   ├── compliance/page.tsx         (replaced)
│   ├── firm-library/page.tsx       (replaced)
│   ├── history/page.tsx            (replaced)
│   ├── config/page.tsx             (replaced)
│   └── settings/page.tsx           (replaced)
└── components/pages/
    ├── knowledge/
    │   ├── knowledge-page.tsx
    │   └── knowledge-data.ts
    ├── workflow-agents/
    │   ├── workflow-agents-page.tsx
    │   └── workflow-agents-data.ts
    ├── compliance/
    │   ├── compliance-page.tsx
    │   └── compliance-data.ts
    ├── firm-library/
    │   ├── firm-library-page.tsx
    │   └── firm-library-data.ts
    ├── history/
    │   ├── history-page.tsx
    │   └── history-data.ts
    ├── config/
    │   └── ai-config-page.tsx
    └── settings/
        └── settings-page.tsx
```

14 new component/data files + 7 page replacements = 21 file changes.

---

## Tasks (one task = one page; bundling into larger dispatches by the controller)

### Task 1: Knowledge page

**Files:**
- Create `apps/web/components/pages/knowledge/knowledge-data.ts` — array of 7 K-collections (id, name, count, sample items)
- Create `apps/web/components/pages/knowledge/knowledge-page.tsx` — header + search input + 2-column grid of MerrisCard with each K-collection
- Replace `apps/web/app/(dashboard)/knowledge/page.tsx` to render `<KnowledgePage />`

**Acceptance:** route returns 200, renders "Knowledge Base" header, "1,273 entries — 7 internal collections" subtitle, search bar, 7 cards with K1-K7 data matching the prototype line 155.

### Task 2: Workflow Agents (Library tab only)

**Files:**
- Create `apps/web/components/pages/workflow-agents/workflow-agents-data.ts` — `AGENTS_PREBUILT` (8 entries) + `AGENTS_CUSTOM` (2 entries) matching prototype lines 73–86
- Create `apps/web/components/pages/workflow-agents/workflow-agents-page.tsx` — header + Library tab marker + category filter chips + 3-column agent card grid + "Recently Run" 3-card row
- Replace page

**Acceptance:** route returns 200, "Workflow Agents" header, category chips ("All", "Compliance", "Climate", etc.), 8 prebuilt + 2 custom agent cards, "Recently Run" section with 3 cards. Run button is a no-op (`type="button"` with no handler).

### Task 3: Compliance page

**Files:**
- Create `apps/web/components/pages/compliance/compliance-data.ts` — 4 framework summary cards + disclosure matrix rows (matching prototype line 152)
- Create `apps/web/components/pages/compliance/compliance-page.tsx`
- Replace page

**Acceptance:** route returns 200, "Compliance Tracker" header, 4 framework summary cards (GRI 2024 72%, TCFD 58%, ISSB 31%, EU Tax 44%) with progress bars, "Disclosure Matrix" card with 6 rows.

### Task 4: Firm Library page

**Files:**
- Create `apps/web/components/pages/firm-library/firm-library-data.ts` — 4 categories matching prototype line 158
- Create `apps/web/components/pages/firm-library/firm-library-page.tsx`
- Replace page

**Acceptance:** route returns 200, "Firm Library" header, subtitle, 2-column grid of 4 category cards (Templates, Methodologies, Past Engagements, Playbooks), upload dropzone card, "Sync Shared Drive" teal banner card.

### Task 5: History page

**Files:**
- Create `apps/web/components/pages/history/history-data.ts` — 4 hardcoded history entries matching prototype line 284
- Create `apps/web/components/pages/history/history-page.tsx`
- Replace page

**Acceptance:** route returns 200, "History" header, list of 4 hover-able cards with question text, engagement chip, optional confidence pill, time-since stamp.

### Task 6: AI Config page

**Files:**
- Create `apps/web/components/pages/config/ai-config-page.tsx` — Response Behaviour card (sliders + Challenge Mode toggle) + Knowledge Priorities card + Outputs card + Integrations card + Apply button
- Replace page

**localStorage keys:** `merris-config-challengeMode` (boolean), `merris-config-evalScore` (boolean), `merris-config-citations` (boolean), `merris-config-gaps` (boolean). Read on mount, write on toggle.

**Acceptance:** route returns 200, "AI Configuration" header, 2x2 grid of cards. The Challenge Mode toggle and the 3 Outputs toggles persist to localStorage across page reloads. The sliders are visual only (no state).

### Task 7: Settings page

**Files:**
- Create `apps/web/components/pages/settings/settings-page.tsx` — 2-column layout: 160px sidebar with 4 tabs (Profile, Team, Preferences, Billing) + main column showing the active tab
- Replace page

**Tab content:**
- Profile (default): Profile & Organisation form (read-only, populated from `useAuthStore` if token present, otherwise from PROTOTYPE_PROFILE constant) + Team Management (4 hardcoded members)
- Team: same Team Management card from Profile tab, expanded
- Preferences: 2-card grid (Preferences + Billing summary)
- Billing: same Billing card from Preferences tab, expanded

**Acceptance:** route returns 200, sidebar with 4 tab labels, Profile tab shows the form + team list. Tab clicks switch the main column.

### Task 8: End-to-end smoke test

Run `pnpm --filter @merris/web build`. Confirm exit 0. All 7 routes appear with bundles meaningfully larger than the placeholder versions.

Optionally start the dev server and curl each route — must return 200.

---

## Constraints (apply to every task)

1. Use the existing `apps/web/components/merris/*` primitives (MerrisCard, MerrisButton, Pill, Chip, ScoreRing, SectionLabel, MerrisHeader if it exists). Don't reinvent.
2. Do NOT call any `api.*` method that touches a fictional backend route (knowledge-base collections, workflows, etc.). Hardcode data instead.
3. Each page's data lives in a sibling `*-data.ts` file (except `ai-config-page.tsx` and `settings-page.tsx` which are small enough to inline).
4. Pages are client components ('use client'). The wrapping `app/(dashboard)/.../page.tsx` is a thin Server Component that imports and renders the client component.
5. After each page lands, the build must be green. If the build breaks, STOP and report.
6. Match the prototype layout 1:1 visually. Don't add features that aren't in the prototype.
7. ONE commit per task. Commit messages: `feat(plan5): wire <PageName> with prototype-faithful static layout`.

---

## Known Limitations (filed as Plan 5 follow-ups)

- Real `GET /api/v1/knowledge-base/collections` endpoint
- Real `GET /api/v1/workflows/templates` endpoint + execution + status polling (current `api.listWorkflows` and `api.executeWorkflow` reference fictional routes)
- Workflow Agents Builder tab
- Real history feed (`/assistant/history` or similar)
- Real framework compliance percentages (currently hardcoded matching prototype)
- Real team / preferences / billing endpoints
- File upload on Firm Library
- `'@/lib/utils'` `cn()` helper if some primitive needs it
