# Web Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gut the existing `apps/web` Next.js dashboard in place and rebuild it as a 1:1 structural and visual match for `merris-platform-7.html` — light theme, Merris teal palette, Manrope/Inter fonts, 9-item sidebar with the exact prototype routes — while preserving the working auth flow, API client, and shadcn UI primitives so we don't lose ground.

**Architecture:** Single-pass migration of `apps/web/`. Theme inversion (dark→light), Tailwind palette swap, font loading via `next/font/google`, prototype-driven design tokens in `globals.css`, route renames via folder moves, sidebar rebuild, and a refactored typed API client mapped against the **real** backend route inventory (not the spec's fictional one). Out of scope: page implementations beyond placeholder shells. Each prototype page gets a stub that imports the new design system and renders a "Coming in Plan N" message; Plans 3–5 fill them in.

**Tech Stack:** Next.js 14 (app router), Tailwind CSS 3.4, `next/font/google`, Zustand, shadcn-style primitives, Vitest (only if existing).

---

## Context for the Implementer

**Read first, in this order:**

1. `merris-platform-7.html` — the visual spec. Especially the `T` token object on line 19 (CSS variables), the `NAV` array on line 90 (sidebar items), and the `Side` component on lines 92–96 (sidebar markup with 192px width, white background, teal accent).
2. `apps/web/app/layout.tsx` — current dark-mode shell (`<html className="dark">`).
3. `apps/web/app/(dashboard)/layout.tsx` — current dashboard shell (`bg-zinc-950`, dark).
4. `apps/web/components/sidebar.tsx` — current 5-item sidebar that needs to become a 9-item teal-accented one.
5. `apps/web/tailwind.config.ts` — current `merris` palette is **emerald (#047857), wrong**; must become teal (#006b5f).
6. `apps/web/lib/api.ts` — current generic client; we'll keep the class but add typed methods that map to **real** routes.
7. `apps/web/app/globals.css` — where the prototype's CSS variables get installed.

**Real backend route inventory (verified by reading source, not the spec):**

| Domain | Method | Path |
|---|---|---|
| Auth | POST | `/api/v1/auth/login` |
| Auth | POST | `/api/v1/auth/register` |
| Auth | GET | `/api/v1/auth/me` |
| Assistant | POST | `/api/v1/assistant/chat` (SSE if `Accept: text/event-stream`, JSON otherwise — see Plan 1) |
| Assistant | POST | `/api/v1/assistant/draft` |
| Assistant | POST | `/api/v1/assistant/review` |
| Assistant | POST | `/api/v1/assistant/deep-analysis` |
| Assistant | GET | `/api/v1/assistant/suggestions` |
| Assistant | GET | `/api/v1/assistant/memory/:engagementId` |
| Assistant | POST | `/api/v1/assistant/generate-report` |
| Assistant | POST | `/api/v1/assistant/generate-assurance-pack` |
| Ingestion | GET | `/api/v1/engagements` |
| Ingestion | POST | `/api/v1/engagements/:id/documents` (multipart) |
| Ingestion | GET | `/api/v1/engagements/:id/documents` |
| Ingestion | GET | `/api/v1/documents/:id` |
| Assurance | POST | `/api/v1/engagements/:id/assurance-pack` |
| Assurance | GET | `/api/v1/engagements/:id/disclosures/:disclosureId/findings` |
| Workflow | GET | `/api/v1/workflows` |
| Workflow | POST | `/api/v1/workflows` |
| Workflow | POST | `/api/v1/workflows/:id/execute` |
| Workflow | GET | `/api/v1/workflows/:id/status` |
| Knowledge | GET | `/api/v1/knowledge-base/collections` |
| Knowledge | POST | `/api/v1/knowledge-base/search` |
| Framework | GET | `/api/v1/frameworks` (and version/disclosure subroutes) |

The spec's `lib/api.ts` example uses `/knowledge`, `/workflows/run`, `/assurance/findings?engagementId=…` — **these don't exist**. Do not create methods that hit them.

**Route mapping (existing → new):**

| Existing path | New path | Action |
|---|---|---|
| `app/(dashboard)/page.tsx` | `app/(dashboard)/intelligence/page.tsx` | move + rewrite (Plan 3) |
| `app/(dashboard)/home/page.tsx` | — | delete (replaced by `intelligence`) |
| `app/(dashboard)/assistant/page.tsx` | — | delete (Intelligence IS the chat) |
| `app/(dashboard)/engagements/page.tsx` | `app/(dashboard)/portfolio/page.tsx` | move + rewrite (Plan 4) |
| `app/(dashboard)/engagements/[id]/page.tsx` | `app/(dashboard)/portfolio/[id]/page.tsx` | move (Plan 4) |
| `app/(dashboard)/compliance/page.tsx` | `app/(dashboard)/compliance/page.tsx` | keep path, restyle (Plan 5) |
| `app/(dashboard)/knowledge/page.tsx` | `app/(dashboard)/knowledge/page.tsx` | keep path, restyle (Plan 5) |
| `app/(dashboard)/vault/page.tsx` | `app/(dashboard)/firm-library/page.tsx` | move + rewrite (Plan 5) |
| `app/(dashboard)/workflows/page.tsx` | `app/(dashboard)/workflow-agents/page.tsx` | move + rewrite (Plan 5) |
| `app/(dashboard)/history/page.tsx` | `app/(dashboard)/history/page.tsx` | keep path, restyle (Plan 5) |
| `app/(dashboard)/settings/page.tsx` | `app/(dashboard)/settings/page.tsx` | keep path, restyle (Plan 5) |
| — | `app/(dashboard)/config/page.tsx` | new (Plan 5: AI Config) |
| `app/(dashboard)/data-collection/page.tsx` | — | **delete** (not in prototype) |
| `app/(dashboard)/verification/page.tsx` | — | **delete** (not in prototype) |
| `app/(dashboard)/presentations/page.tsx` | — | **delete** (not in prototype) |
| `app/(dashboard)/reports/page.tsx` | — | **delete** (not in prototype) |
| `app/(dashboard)/reports/[id]/page.tsx` | — | **delete** (not in prototype) |

**Components to delete (not used by prototype):** `components/main-page/` directory (its pieces will be re-implemented in Plan 3 against the new design system), `components/agent-chat.tsx`, `components/chat-message.tsx`, `components/completion-donut.tsx`. Keep `components/ui/*` (shadcn primitives — they're style-agnostic and we'll restyle them via Tailwind tokens). Keep `components/file-upload.tsx`.

**Out of scope for this plan:**
- Page contents beyond stubs.
- DocumentViewer, ThinkingState, response archetypes, knowledge collections rendering — all in Plans 3–5.
- Microsoft OAuth.
- WebSocket.

---

## File Structure (end state after this plan)

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          (restyled to light/teal)
│   │   └── register/page.tsx       (restyled to light/teal)
│   ├── (dashboard)/
│   │   ├── layout.tsx              (light theme, new sidebar + topbar)
│   │   ├── intelligence/page.tsx   (stub)
│   │   ├── portfolio/page.tsx      (stub)
│   │   ├── portfolio/[id]/page.tsx (stub)
│   │   ├── compliance/page.tsx     (stub)
│   │   ├── knowledge/page.tsx      (stub)
│   │   ├── firm-library/page.tsx   (stub)
│   │   ├── workflow-agents/page.tsx(stub)
│   │   ├── history/page.tsx        (stub)
│   │   ├── config/page.tsx         (stub)
│   │   └── settings/page.tsx       (stub)
│   ├── layout.tsx                  (Manrope + Inter via next/font, no `dark` class)
│   ├── globals.css                 (Merris CSS variables)
│   └── page.tsx                    (redirect to /intelligence)
├── components/
│   ├── ui/                         (kept; shadcn primitives)
│   ├── file-upload.tsx             (kept)
│   ├── merris/
│   │   ├── sidebar.tsx             (NEW — 9-item teal sidebar matching prototype)
│   │   ├── top-bar.tsx             (NEW — engagement selector + tabs)
│   │   ├── card.tsx                (NEW — Cd primitive)
│   │   ├── pill.tsx                (NEW — Pill + status pill SP)
│   │   ├── chip.tsx                (NEW — Ch primitive)
│   │   ├── button.tsx              (NEW — Bt primary + B2 secondary)
│   │   ├── score-ring.tsx          (NEW — Rn + Dn donuts)
│   │   └── label.tsx               (NEW — Lb section label)
│   └── sidebar.tsx                 (DELETE)
├── lib/
│   ├── api.ts                      (refactored: typed methods against real routes + SSE chat)
│   ├── store.ts, chat-store.ts, main-store.ts  (kept; chat-store may be touched in Plan 3)
│   ├── utils.ts, i18n.ts           (kept)
│   └── design-tokens.ts            (NEW — TS-side mirror of CSS vars for inline use)
└── tailwind.config.ts              (Merris teal palette + Manrope/Inter font families)
```

---

## Task 1: Snapshot the current state in a clean commit

This makes the rest of the migration revertable in a single `git revert`.

- [ ] **Step 1: Confirm working tree is clean**

Run: `cd apps/web && git status`
Expected: no uncommitted changes inside `apps/web/`. If there are any, stash or commit them first.

- [ ] **Step 2: Tag the pre-migration state**

Run: `git tag pre-merris7-migration`
Expected: tag created.

- [ ] **Step 3: Confirm dev server runs (baseline)**

Run: `pnpm --filter @merris/web dev`
Expected: `apps/web` builds and serves on `http://localhost:3000`. Visit `/login` — confirm it loads (in current dark theme). Stop the server.

---

## Task 2: Install Manrope + Inter via next/font and remove dark mode

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Replace `app/layout.tsx`**

Replace the entire contents of `apps/web/app/layout.tsx` with:

```tsx
import './globals.css';
import type { Metadata } from 'next';
import { Manrope, Inter } from 'next/font/google';
import { RootBody } from './root-body';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Merris — ESG Intelligence',
  description: 'AI co-pilot for ESG professionals',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`}>
      <body className="font-body bg-merris-bg text-merris-text antialiased">
        <RootBody>{children}</RootBody>
      </body>
    </html>
  );
}
```

Note: removed `className="dark"` and the bare `<body>`. The class names `font-body`, `bg-merris-bg`, `text-merris-text` are added in Task 4.

- [ ] **Step 2: Verify build passes**

Run: `pnpm --filter @merris/web build`
Expected: build fails with Tailwind class warnings (`bg-merris-bg` etc. don't exist yet). That's fine — Task 4 fixes it.

If the build fails for an unrelated reason (e.g., next/font network), fix the underlying issue. Don't suppress.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web): load Manrope+Inter and remove dark mode from root layout"
```

---

## Task 3: Install Merris CSS variables in globals.css

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Read current globals.css**

Run: open `apps/web/app/globals.css` and note any custom utilities you must preserve.

- [ ] **Step 2: Replace globals.css**

Replace the entire contents of `apps/web/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Surfaces */
  --merris-bg: #f8f9fa;
  --merris-surface: #ffffff;
  --merris-surface-low: #f3f4f5;
  --merris-surface-high: #edeef0;

  /* Text */
  --merris-text: #191c1d;
  --merris-text-secondary: #5f6368;
  --merris-text-tertiary: #9aa0a6;

  /* Brand */
  --merris-primary: #006b5f;
  --merris-primary-light: #2dd4bf;
  --merris-primary-bg: #e0f5f1;

  /* States */
  --merris-warning: #d97706;
  --merris-warning-bg: #fff7ed;
  --merris-error: #dc2626;
  --merris-error-bg: #fef2f2;
  --merris-success: #16a34a;
  --merris-success-bg: #f0fdf4;

  /* Borders + shadow */
  --merris-border: rgba(0, 107, 95, 0.08);
  --merris-border-medium: rgba(0, 107, 95, 0.15);
  --merris-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03);
  --merris-shadow-hover: 0 4px 24px rgba(0, 0, 0, 0.06);

  /* Radii */
  --merris-radius: 12px;
  --merris-radius-sm: 8px;
}

html, body {
  background: var(--merris-bg);
  color: var(--merris-text);
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: rgba(0, 107, 95, 0.15); border-radius: 3px; }

button { cursor: pointer; }
input::placeholder, textarea::placeholder { color: var(--merris-text-tertiary); }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(web): install Merris CSS variables and light-mode base styles"
```

---

## Task 4: Rewrite tailwind.config.ts with Merris tokens

**Files:**
- Modify: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Replace tailwind.config.ts**

Replace the entire contents with:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        merris: {
          bg: 'var(--merris-bg)',
          surface: 'var(--merris-surface)',
          'surface-low': 'var(--merris-surface-low)',
          'surface-high': 'var(--merris-surface-high)',
          text: 'var(--merris-text)',
          'text-secondary': 'var(--merris-text-secondary)',
          'text-tertiary': 'var(--merris-text-tertiary)',
          primary: 'var(--merris-primary)',
          'primary-light': 'var(--merris-primary-light)',
          'primary-bg': 'var(--merris-primary-bg)',
          warning: 'var(--merris-warning)',
          'warning-bg': 'var(--merris-warning-bg)',
          error: 'var(--merris-error)',
          'error-bg': 'var(--merris-error-bg)',
          success: 'var(--merris-success)',
          'success-bg': 'var(--merris-success-bg)',
          border: 'var(--merris-border)',
          'border-medium': 'var(--merris-border-medium)',
        },
      },
      fontFamily: {
        display: ['var(--font-manrope)', 'Manrope', 'sans-serif'],
        body: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        merris: 'var(--merris-radius)',
        'merris-sm': 'var(--merris-radius-sm)',
      },
      boxShadow: {
        merris: 'var(--merris-shadow)',
        'merris-hover': 'var(--merris-shadow-hover)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pulse-soft': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm --filter @merris/web build`
Expected: build succeeds (the layout from Task 2 references `bg-merris-bg`, `text-merris-text`, `font-body`, all of which now exist). Pages may visually look broken because their hardcoded `bg-zinc-950` etc. classes still apply, but compilation works.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tailwind.config.ts
git commit -m "feat(web): replace emerald palette with Merris teal CSS-variable tokens"
```

---

## Task 5: Add design-tokens.ts (TS mirror for inline-style use)

**Files:**
- Create: `apps/web/lib/design-tokens.ts`

- [ ] **Step 1: Create the file**

Create `apps/web/lib/design-tokens.ts`:

```ts
// TypeScript mirror of the CSS variables in globals.css.
// Use these when a component needs inline styles (e.g., SVG fills, runtime-computed colors).
// For static styling, prefer Tailwind utility classes.

export const merrisTokens = {
  bg: '#f8f9fa',
  surface: '#ffffff',
  surfaceLow: '#f3f4f5',
  surfaceHigh: '#edeef0',
  text: '#191c1d',
  textSecondary: '#5f6368',
  textTertiary: '#9aa0a6',
  primary: '#006b5f',
  primaryLight: '#2dd4bf',
  primaryBg: '#e0f5f1',
  warning: '#d97706',
  warningBg: '#fff7ed',
  error: '#dc2626',
  errorBg: '#fef2f2',
  success: '#16a34a',
  successBg: '#f0fdf4',
  border: 'rgba(0, 107, 95, 0.08)',
  borderMedium: 'rgba(0, 107, 95, 0.15)',
  shadow: '0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.03)',
  shadowHover: '0 4px 24px rgba(0,0,0,.06)',
  radius: '12px',
  radiusSm: '8px',
  fontDisplay: "'Manrope', sans-serif",
  fontBody: "'Inter', sans-serif",
} as const;

export type MerrisTokens = typeof merrisTokens;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/design-tokens.ts
git commit -m "feat(web): add TS design-token mirror for inline-style consumers"
```

---

## Task 6: Build the Pill primitive

**Files:**
- Create: `apps/web/components/merris/pill.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { ReactNode } from 'react';
import clsx from 'clsx';

interface PillProps {
  children: ReactNode;
  variant?: 'default' | 'in-progress' | 'under-review' | 'draft' | 'completed' | 'critical' | 'important' | 'minor';
  size?: 'sm' | 'md';
}

const VARIANTS: Record<NonNullable<PillProps['variant']>, string> = {
  'default':       'text-merris-primary bg-merris-primary-bg',
  'in-progress':   'text-merris-primary bg-merris-primary-bg',
  'under-review':  'text-amber-700 bg-merris-warning-bg',
  'draft':         'text-merris-text-tertiary bg-merris-surface-high',
  'completed':     'text-merris-success bg-merris-success-bg',
  'critical':      'text-merris-error bg-merris-error-bg',
  'important':     'text-merris-warning bg-merris-warning-bg',
  'minor':         'text-merris-text-tertiary bg-merris-surface-high',
};

export function Pill({ children, variant = 'default', size = 'md' }: PillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-body font-semibold uppercase tracking-wider whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-[3px] text-[11px]',
        VARIANTS[variant],
      )}
    >
      {children}
    </span>
  );
}
```

If `clsx` isn't installed, run `pnpm --filter @merris/web add clsx` first.

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/merris/pill.tsx apps/web/package.json apps/web/../../pnpm-lock.yaml 2>/dev/null || git add apps/web/components/merris/pill.tsx
git commit -m "feat(web): add Pill primitive with prototype variants"
```

---

## Task 7: Build the Chip primitive

**Files:**
- Create: `apps/web/components/merris/chip.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';
import type { ReactNode } from 'react';
import clsx from 'clsx';

interface ChipProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function Chip({ children, active = false, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-body transition-colors',
        active
          ? 'bg-merris-primary text-white font-semibold'
          : 'bg-merris-surface-low text-merris-text-secondary border border-merris-border hover:border-merris-border-medium',
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/merris/chip.tsx
git commit -m "feat(web): add Chip primitive with active/inactive states"
```

---

## Task 8: Build Button primitives (Bt primary + B2 secondary)

**Files:**
- Create: `apps/web/components/merris/button.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary';

interface MerrisButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
}

export function MerrisButton({
  variant = 'primary',
  icon,
  children,
  className,
  ...rest
}: MerrisButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-merris-sm font-display transition-opacity disabled:opacity-50',
        variant === 'primary'
          ? 'bg-merris-primary text-white font-semibold text-[13px] px-[18px] py-[9px] hover:opacity-95'
          : 'bg-merris-surface text-merris-text font-medium text-[12px] px-[14px] py-[7px] border border-merris-border-medium hover:bg-merris-surface-low',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}
```

**Decision:** This is a `merris/`-namespaced primitive intentionally separate from `components/ui/button.tsx` (the shadcn one). The shadcn one stays for compatibility with existing modal/dialog primitives that import it. New code uses `MerrisButton`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/merris/button.tsx
git commit -m "feat(web): add MerrisButton primitive (primary/secondary variants)"
```

---

## Task 9: Build the Card primitive

**Files:**
- Create: `apps/web/components/merris/card.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';
import type { ReactNode, HTMLAttributes } from 'react';
import clsx from 'clsx';

interface MerrisCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  children: ReactNode;
}

export function MerrisCard({ hover = false, className, children, ...rest }: MerrisCardProps) {
  return (
    <div
      {...rest}
      className={clsx(
        'bg-merris-surface rounded-merris shadow-merris p-[22px]',
        hover && 'transition-shadow hover:shadow-merris-hover',
        rest.onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/merris/card.tsx
git commit -m "feat(web): add MerrisCard primitive with optional hover lift"
```

---

## Task 10: Build the ScoreRing primitive

**Files:**
- Create: `apps/web/components/merris/score-ring.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { merrisTokens } from '@/lib/design-tokens';

interface ScoreRingProps {
  score: number;       // 0–100
  size?: number;       // px
  variant?: 'small' | 'donut';
}

/**
 * Mirrors the prototype Rn (small ring, 40px) and Dn (donut, 130px) components.
 * Color: red <40, amber <70, green ≥70 (matches prototype thresholds).
 */
export function ScoreRing({ score, size = 40, variant = 'small' }: ScoreRingProps) {
  const sz = variant === 'donut' ? 130 : size;
  const stroke = variant === 'donut' ? 7 : 3;
  const r = (sz - stroke - 2) / 2;
  const c = 2 * Math.PI * r;
  const color =
    variant === 'donut'
      ? merrisTokens.primary
      : score >= 70
        ? merrisTokens.success
        : score >= 40
          ? merrisTokens.warning
          : merrisTokens.error;

  return (
    <svg width={sz} height={sz} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={merrisTokens.surfaceLow} strokeWidth={stroke} />
      <circle
        cx={sz / 2}
        cy={sz / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
        strokeLinecap="round"
      />
      <text
        x={sz / 2}
        y={variant === 'donut' ? sz / 2 - 4 : sz / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={merrisTokens.text}
        fontSize={variant === 'donut' ? 30 : 11}
        fontWeight={variant === 'donut' ? 700 : 600}
        fontFamily={merrisTokens.fontDisplay}
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
      >
        {variant === 'donut' ? score : `${score}%`}
      </text>
      {variant === 'donut' && (
        <text
          x={sz / 2}
          y={sz / 2 + 14}
          textAnchor="middle"
          dominantBaseline="central"
          fill={merrisTokens.textTertiary}
          fontSize={10}
          fontFamily={merrisTokens.fontBody}
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          /100
        </text>
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/merris/score-ring.tsx
git commit -m "feat(web): add ScoreRing primitive (small ring + 130px donut)"
```

---

## Task 11: Build the Section Label primitive (Lb)

**Files:**
- Create: `apps/web/components/merris/label.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { ReactNode } from 'react';

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-merris-primary mb-3.5">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/merris/label.tsx
git commit -m "feat(web): add SectionLabel primitive matching prototype Lb"
```

---

## Task 12: Build the new Merris Sidebar (192px, 9 items)

**Files:**
- Create: `apps/web/components/merris/sidebar.tsx`

- [ ] **Step 1: Create the sidebar**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { merrisTokens } from '@/lib/design-tokens';
import { MerrisButton } from './button';

interface NavItem {
  href: string;
  label: string;
  iconPath: string; // raw SVG path data
}

const NAV: NavItem[] = [
  { href: '/intelligence',    label: 'Intelligence',    iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3' },
  { href: '/portfolio',       label: 'Portfolio',       iconPath: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { href: '/compliance',      label: 'Compliance',      iconPath: 'M9 12l2 2 4-4M3 12a9 9 0 1018 0 9 9 0 00-18 0z' },
  { href: '/knowledge',       label: 'Knowledge',       iconPath: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z' },
  { href: '/firm-library',    label: 'Firm Library',    iconPath: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
  { href: '/workflow-agents', label: 'Workflow Agents', iconPath: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z' },
  { href: '/history',         label: 'History',         iconPath: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2' },
  { href: '/config',          label: 'AI Config',       iconPath: 'M4 4h16v16H4zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M20 9h3M1 15h3M20 15h3' },
  { href: '/settings',        label: 'Settings',        iconPath: 'M12 15a3 3 0 100-6 3 3 0 000 6zM12 1v2M12 21v2M3.5 12h2M18.5 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4' },
];

function Icon({ d, color }: { d: string; color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function MerrisSidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed left-0 top-0 z-[100] flex h-screen w-[192px] flex-col bg-merris-surface py-[18px]"
      style={{ borderRight: `1px solid ${merrisTokens.border}` }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-[18px] pb-[22px]">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-merris-sm bg-merris-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div className="font-display text-[14px] font-bold text-merris-text">Merris</div>
          <div className="font-body text-[9px] font-medium uppercase tracking-wider text-merris-primary">
            ESG Intelligence
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                'flex items-center gap-2.5 px-[18px] py-2 font-display text-[12.5px] transition-colors',
                active
                  ? 'border-l-[3px] border-merris-primary bg-merris-primary-bg font-semibold text-merris-primary'
                  : 'border-l-[3px] border-transparent text-merris-text-secondary hover:bg-merris-surface-low',
              )}
            >
              <Icon d={n.iconPath} color={active ? merrisTokens.primary : merrisTokens.textTertiary} />
              {n.label}
            </Link>
          );
        })}
      </div>

      {/* New Analysis CTA */}
      <div className="px-[18px]">
        <Link href="/intelligence">
          <MerrisButton
            variant="primary"
            className="w-full justify-center text-[12px]"
            style={{ padding: '8px 14px' }}
          >
            + New Analysis
          </MerrisButton>
        </Link>
      </div>

      {/* User chip */}
      <div className="flex items-center gap-1.5 px-[18px] pt-2.5">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-merris-surface-high">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textSecondary} strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <div className="font-display text-[11px] font-medium text-merris-text">Alex Thorne</div>
          <div className="font-body text-[9px] text-merris-text-tertiary">Senior Lead</div>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/merris/sidebar.tsx
git commit -m "feat(web): add 9-item Merris sidebar matching prototype layout"
```

---

## Task 13: Build the TopBar (engagement selector + tabs)

**Files:**
- Create: `apps/web/components/merris/top-bar.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { Pill } from './pill';
import { merrisTokens } from '@/lib/design-tokens';

const TABS = ['Dashboard', 'Analytics', 'Archive'] as const;

export function MerrisTopBar() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Dashboard');

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
      <div
        className="flex items-center gap-1.5 rounded-merris-sm px-2.5 py-1 font-body text-[11px]"
        style={{ border: `1px solid ${merrisTokens.borderMedium}` }}
      >
        <Pill size="sm">Active</Pill>
        <span className="font-medium text-merris-text">QAPCO Sustainability 2026</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.5">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </header>
  );
}
```

The engagement selector is currently static. Plan 4 (`portfolio-and-doc-viewer`) wires it to `/engagements`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/merris/top-bar.tsx
git commit -m "feat(web): add MerrisTopBar with placeholder engagement selector"
```

---

## Task 14: Replace dashboard layout with light-mode shell

**Files:**
- Modify: `apps/web/app/(dashboard)/layout.tsx`
- Delete: `apps/web/components/sidebar.tsx`

- [ ] **Step 1: Replace dashboard layout**

Replace the entire contents of `apps/web/app/(dashboard)/layout.tsx` with:

```tsx
import { MerrisSidebar } from '@/components/merris/sidebar';
import { MerrisTopBar } from '@/components/merris/top-bar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-merris-bg">
      <MerrisSidebar />
      <div className="ml-[192px] flex flex-1 flex-col">
        <MerrisTopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete the old sidebar**

```bash
rm apps/web/components/sidebar.tsx
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @merris/web build`
Expected: build fails because some old pages still import `@/components/sidebar`. Note which files. They will all be deleted in Tasks 16–17.

If build fails ONLY on pages we're about to delete, proceed. If it fails on something we're keeping, fix the import there.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/layout.tsx apps/web/components/sidebar.tsx
git commit -m "feat(web): replace dashboard shell with Merris light-mode layout"
```

---

## Task 15: Add a root-level redirect from / to /intelligence

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace app/page.tsx**

Replace contents with:

```tsx
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/intelligence');
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): redirect root to /intelligence"
```

---

## Task 16: Delete pages and components not in the prototype

**Files:**
- Delete: see list below

This task removes everything that won't exist in the prototype, in one commit, so the build is clean before we add stubs.

- [ ] **Step 1: Delete dashboard pages not in prototype**

```bash
cd apps/web
rm -rf app/\(dashboard\)/home
rm -rf app/\(dashboard\)/assistant
rm -rf app/\(dashboard\)/data-collection
rm -rf app/\(dashboard\)/verification
rm -rf app/\(dashboard\)/presentations
rm -rf app/\(dashboard\)/reports
rm app/\(dashboard\)/page.tsx
```

(The prototype has no `(dashboard)/page.tsx` — `/` is handled by the root redirect, and the dashboard root URL is `/intelligence`.)

- [ ] **Step 2: Delete components not in prototype**

```bash
cd apps/web
rm -rf components/main-page
rm -f components/agent-chat.tsx
rm -f components/chat-message.tsx
rm -f components/completion-donut.tsx
```

- [ ] **Step 3: Delete unused chat-store and main-store**

These Zustand stores were tied to the old chat UI and will be replaced in Plan 3.

```bash
rm apps/web/lib/chat-store.ts
rm apps/web/lib/main-store.ts
```

(`lib/store.ts` — auth store — stays.)

- [ ] **Step 4: Verify nothing imports the deleted files**

Run: `cd apps/web && grep -r "main-store\|chat-store\|main-page\|agent-chat\|chat-message\|completion-donut" app components lib 2>/dev/null`
Expected: no output.

If any references remain, follow them and remove the importing files (they're almost certainly more deleted-page artifacts).

- [ ] **Step 5: Commit**

```bash
git add -A apps/web
git commit -m "chore(web): remove pages and components absent from merris-platform-7 prototype"
```

---

## Task 17: Create stub pages for the 9 prototype routes

**Files:**
- Move: `app/(dashboard)/engagements/` → `app/(dashboard)/portfolio/`
- Move: `app/(dashboard)/vault/` → `app/(dashboard)/firm-library/`
- Move: `app/(dashboard)/workflows/` → `app/(dashboard)/workflow-agents/`
- Create: `app/(dashboard)/intelligence/page.tsx`
- Create: `app/(dashboard)/config/page.tsx`
- Modify: existing kept pages (`compliance`, `knowledge`, `history`, `settings`)

This task is mechanical: every prototype page becomes a stub `<PlaceholderPage planRef="…">`.

- [ ] **Step 1: Create the placeholder component**

Create `apps/web/components/merris/placeholder-page.tsx`:

```tsx
import { MerrisCard } from './card';
import { SectionLabel } from './label';

export function PlaceholderPage({
  title,
  planRef,
  description,
}: {
  title: string;
  planRef: string;
  description: string;
}) {
  return (
    <div className="p-8">
      <SectionLabel>{planRef}</SectionLabel>
      <h1 className="font-display text-[28px] font-bold text-merris-text">{title}</h1>
      <p className="mt-2 max-w-xl font-body text-[14px] text-merris-text-secondary">{description}</p>
      <MerrisCard className="mt-6 max-w-xl">
        <p className="font-body text-[13px] text-merris-text-secondary">
          This page is a stub. Implementation lands in <strong>{planRef}</strong>.
        </p>
      </MerrisCard>
    </div>
  );
}
```

- [ ] **Step 2: Move engagements → portfolio**

```bash
cd apps/web
mkdir -p app/\(dashboard\)/portfolio
git mv app/\(dashboard\)/engagements/page.tsx app/\(dashboard\)/portfolio/page.tsx
git mv app/\(dashboard\)/engagements/\[id\] app/\(dashboard\)/portfolio/\[id\] 2>/dev/null || true
rmdir app/\(dashboard\)/engagements 2>/dev/null || true
```

Then replace `app/(dashboard)/portfolio/page.tsx` contents with:

```tsx
import { PlaceholderPage } from '@/components/merris/placeholder-page';

export default function PortfolioPage() {
  return (
    <PlaceholderPage
      title="Portfolio"
      planRef="Plan 4: portfolio-and-doc-viewer"
      description="Active engagements grid: QAPCO, AJSS, Aldar, Equinor. Each card shows status pill, completeness ring, frameworks, and due date."
    />
  );
}
```

And `app/(dashboard)/portfolio/[id]/page.tsx` with:

```tsx
import { PlaceholderPage } from '@/components/merris/placeholder-page';

export default function EngagementDetailPage({ params }: { params: { id: string } }) {
  return (
    <PlaceholderPage
      title={`Engagement ${params.id}`}
      planRef="Plan 4: portfolio-and-doc-viewer"
      description="Engagement detail view with split-pane document viewer activated by review actions."
    />
  );
}
```

- [ ] **Step 3: Move vault → firm-library**

```bash
cd apps/web
mkdir -p app/\(dashboard\)/firm-library
git mv app/\(dashboard\)/vault/page.tsx app/\(dashboard\)/firm-library/page.tsx
rmdir app/\(dashboard\)/vault 2>/dev/null || true
```

Replace `app/(dashboard)/firm-library/page.tsx` contents:

```tsx
import { PlaceholderPage } from '@/components/merris/placeholder-page';

export default function FirmLibraryPage() {
  return (
    <PlaceholderPage
      title="Firm Library"
      planRef="Plan 5: remaining-pages"
      description="Document vault for cross-engagement assets: templates, methodologies, prior reports."
    />
  );
}
```

- [ ] **Step 4: Move workflows → workflow-agents**

```bash
cd apps/web
mkdir -p app/\(dashboard\)/workflow-agents
git mv app/\(dashboard\)/workflows/page.tsx app/\(dashboard\)/workflow-agents/page.tsx
rmdir app/\(dashboard\)/workflows 2>/dev/null || true
```

Replace `app/(dashboard)/workflow-agents/page.tsx` contents:

```tsx
import { PlaceholderPage } from '@/components/merris/placeholder-page';

export default function WorkflowAgentsPage() {
  return (
    <PlaceholderPage
      title="Workflow Agents"
      planRef="Plan 5: remaining-pages"
      description="Library of pre-built ESG agents (Gap Analysis, Carbon Benchmarking, Regulatory Scanner, …) plus the Agent Builder tab."
    />
  );
}
```

- [ ] **Step 5: Create intelligence page (new)**

Create `apps/web/app/(dashboard)/intelligence/page.tsx`:

```tsx
import { PlaceholderPage } from '@/components/merris/placeholder-page';

export default function IntelligencePage() {
  return (
    <PlaceholderPage
      title="Intelligence"
      planRef="Plan 3: intelligence-page"
      description="Main chat surface with ThinkingState reasoning trace, response archetypes, jurisdiction chips, and K1–K7 source toggles."
    />
  );
}
```

- [ ] **Step 6: Create AI config page (new)**

Create `apps/web/app/(dashboard)/config/page.tsx`:

```tsx
import { PlaceholderPage } from '@/components/merris/placeholder-page';

export default function ConfigPage() {
  return (
    <PlaceholderPage
      title="AI Configuration"
      planRef="Plan 5: remaining-pages"
      description="Configure default jurisdictions, knowledge sources, model behaviour, and refusal policies."
    />
  );
}
```

- [ ] **Step 7: Stub the kept pages (compliance, knowledge, history, settings)**

For each of these four files, replace the existing contents with a placeholder:

`apps/web/app/(dashboard)/compliance/page.tsx`:
```tsx
import { PlaceholderPage } from '@/components/merris/placeholder-page';

export default function CompliancePage() {
  return (
    <PlaceholderPage
      title="Compliance"
      planRef="Plan 5: remaining-pages"
      description="Cross-engagement compliance tracker by framework and jurisdiction."
    />
  );
}
```

`apps/web/app/(dashboard)/knowledge/page.tsx`:
```tsx
import { PlaceholderPage } from '@/components/merris/placeholder-page';

export default function KnowledgePage() {
  return (
    <PlaceholderPage
      title="Knowledge"
      planRef="Plan 5: remaining-pages"
      description="Browse the K1–K7 knowledge collections (Disclosures, Market, Regulatory, Finance, Peers, Climate, Research)."
    />
  );
}
```

`apps/web/app/(dashboard)/history/page.tsx`:
```tsx
import { PlaceholderPage } from '@/components/merris/placeholder-page';

export default function HistoryPage() {
  return (
    <PlaceholderPage
      title="History"
      planRef="Plan 5: remaining-pages"
      description="Activity log of past analyses, conversations, and document edits."
    />
  );
}
```

`apps/web/app/(dashboard)/settings/page.tsx`:
```tsx
import { PlaceholderPage } from '@/components/merris/placeholder-page';

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      planRef="Plan 5: remaining-pages"
      description="Profile, team, billing, and integrations."
    />
  );
}
```

- [ ] **Step 8: Verify build**

Run: `pnpm --filter @merris/web build`
Expected: build succeeds. All 9 routes resolve.

- [ ] **Step 9: Manual visual check**

Run: `pnpm --filter @merris/web dev`
Visit each route and confirm:
- Light theme everywhere (no black backgrounds)
- Sidebar shows all 9 items in correct order with teal active state
- Active route is highlighted on click
- Top bar shows tabs + engagement chip
- Each placeholder card renders

Stop the server.

- [ ] **Step 10: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): create stub pages for all 9 prototype routes"
```

---

## Task 18: Restyle the auth pages (login + register)

**Files:**
- Modify: `apps/web/app/(auth)/login/page.tsx`
- Modify: `apps/web/app/(auth)/register/page.tsx`

The auth pages currently use the dark theme. Make them light + Merris-branded but DO NOT touch the underlying logic (form state, API call, JWT storage).

- [ ] **Step 1: Read login page to identify the form structure**

Run: open `apps/web/app/(auth)/login/page.tsx` and identify (a) the form's existing wrapper class names (b) the submit handler.

- [ ] **Step 2: Replace the JSX wrapper while keeping logic**

Replace the outermost layout JSX so the page renders as:
- Full-screen `bg-merris-bg`
- Centred white `MerrisCard` (max-width ~400px)
- Merris logo (teal shield) above the heading
- Heading "Sign in to Merris" in `font-display`
- Inputs styled with white background, `border-merris-border-medium`, focus ring `merris-primary`
- Submit `MerrisButton` (primary, full-width)

Keep all existing form fields, validation, error rendering, and the call to `api.post('/auth/login', …)`.

If the existing page uses `components/ui/input` and `components/ui/label`, leave those imports — they're style-agnostic shadcn primitives and will pick up the new theme.

- [ ] **Step 3: Repeat for register page**

Same restyling for `app/(auth)/register/page.tsx`.

- [ ] **Step 4: Manual smoke test**

Run: `pnpm --filter @merris/web dev`
Visit `/login`, attempt a real login against the running API. Confirm: light theme, redirect to `/intelligence` on success.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(auth\)
git commit -m "feat(web): restyle auth pages to Merris light theme"
```

---

## Task 19: Refactor lib/api.ts with typed methods against real routes

**Files:**
- Modify: `apps/web/lib/api.ts`

This is the biggest task in the plan. The class shape stays the same (so existing imports keep working), but we add typed domain methods that match the **real** backend route inventory.

- [ ] **Step 1: Add types**

At the top of `apps/web/lib/api.ts` (above the existing class), add:

```ts
import type { StreamEvent } from '@merris/shared';

// ----- Domain types (loose; tighten in Plan 3+ as pages bind) -----

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  orgId: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Engagement {
  id: string;
  name: string;
  status: string;
  scope?: string;
  deadline?: string;
  frameworks?: string[];
  completeness?: number;
}

export interface IngestedDocument {
  id: string;
  filename: string;
  format: string;
  size: number;
  status: string;
  createdAt: string;
}

export interface KnowledgeCollection {
  id: string;
  code: string;     // K1..K7
  name: string;
  description?: string;
  entryCount?: number;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  category?: string;
  steps?: Array<{ name: string; description?: string }>;
}

export interface ChatRequestPayload {
  engagementId: string;
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  documentBody?: string;
  cursorSection?: string;
  jurisdiction?: string;
  sector?: string;
  ownershipType?: string;
  documentId?: string;
  knowledgeSources?: string[];
}
```

- [ ] **Step 2: Add typed domain methods inside the existing `ApiClient` class**

Inside the existing `class ApiClient` (after the existing `upload()` method, before the closing brace), add:

```ts
  // ===== Auth =====
  login(email: string, password: string) {
    return this.post<LoginResponse>('/auth/login', { email, password });
  }

  register(payload: { email: string; password: string; name: string; orgName?: string }) {
    return this.post<LoginResponse>('/auth/register', payload);
  }

  getMe() {
    return this.get<{ user: AuthUser }>('/auth/me');
  }

  // ===== Engagements (ingestion module) =====
  listEngagements() {
    return this.get<{ engagements: Engagement[] }>('/engagements');
  }

  listEngagementDocuments(engagementId: string) {
    return this.get<{ documents: IngestedDocument[] }>(`/engagements/${engagementId}/documents`);
  }

  getDocument(documentId: string) {
    return this.get<{ document: IngestedDocument & { content?: string } }>(`/documents/${documentId}`);
  }

  uploadEngagementDocument(engagementId: string, file: File) {
    return this.upload<{ document: IngestedDocument }>(
      `/engagements/${engagementId}/documents`,
      file,
    );
  }

  // ===== Assistant (chat) — JSON path =====
  chatJson(payload: ChatRequestPayload) {
    return this.post<{
      response: string;
      toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
      citations: Array<{ id: string; title: string; source: string; year: number; url?: string; domain: string; excerpt: string; verified: boolean }>;
      references: string[];
      confidence: 'high' | 'medium' | 'low';
      data_gaps: string[];
      evaluation?: { score: number; decision: string; flags?: unknown };
    }>('/assistant/chat', payload);
  }

  // ===== Assistant (chat) — SSE path =====
  /**
   * Streams typed events from POST /assistant/chat with Accept: text/event-stream.
   * The caller's onEvent callback fires for each parsed event; the returned promise
   * resolves when the stream ends ({type:'done'}).
   *
   * Implements line-buffered SSE parsing per the W3C eventsource spec.
   */
  async chatStream(payload: ChatRequestPayload, onEvent: (event: StreamEvent) => void): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      const errBody = await res.text().catch(() => res.statusText);
      throw new ApiError(res.status, errBody || 'Stream request failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines
      let sepIdx;
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          try {
            const parsed = JSON.parse(jsonStr) as StreamEvent;
            onEvent(parsed);
            if (parsed.type === 'done') return;
          } catch {
            // skip malformed line
          }
        }
      }
    }
  }

  getChatSuggestions() {
    return this.get<{ suggestions: string[] }>('/assistant/suggestions');
  }

  getEngagementMemory(engagementId: string) {
    return this.get<{ memory: unknown }>(`/assistant/memory/${engagementId}`);
  }

  // ===== Knowledge base =====
  listKnowledgeCollections() {
    return this.get<{ collections: KnowledgeCollection[] }>('/knowledge-base/collections');
  }

  searchKnowledge(query: string, collectionId?: string) {
    return this.post<{ results: Array<{ id: string; title: string; excerpt: string; collection: string }> }>(
      '/knowledge-base/search',
      { query, ...(collectionId ? { collectionId } : {}) },
    );
  }

  // ===== Workflows =====
  listWorkflows() {
    return this.get<{ workflows: Workflow[] }>('/workflows');
  }

  executeWorkflow(workflowId: string, params: Record<string, unknown>) {
    return this.post<{ executionId: string; status: string }>(
      `/workflows/${workflowId}/execute`,
      params,
    );
  }

  getWorkflowStatus(workflowId: string) {
    return this.get<{ status: string; steps: Array<{ name: string; status: string }> }>(
      `/workflows/${workflowId}/status`,
    );
  }

  // ===== Assurance =====
  runAssurancePack(engagementId: string) {
    return this.post<{ packId: string; findings: unknown[] }>(
      `/engagements/${engagementId}/assurance-pack`,
      {},
    );
  }

  getDisclosureFindings(engagementId: string, disclosureId: string) {
    return this.get<{ findings: Array<{ id: string; severity: string; title: string; description: string }> }>(
      `/engagements/${engagementId}/disclosures/${disclosureId}/findings`,
    );
  }

  // ===== Frameworks =====
  listFrameworks() {
    return this.get<{ frameworks: Array<{ id: string; code: string; name: string; version: string }> }>(
      '/frameworks',
    );
  }
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @merris/web build`
Expected: build succeeds. If `@merris/shared` `StreamEvent` import fails, ensure Plan 1 Task 1 has shipped (re-exporting from `packages/shared/src/index.ts`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/api.ts
git commit -m "feat(web): typed API client methods mapping to real backend routes + SSE chatStream"
```

---

## Task 20: End-to-end smoke test

This task is verification, not new code.

- [ ] **Step 1: Start API and web in parallel**

Terminal A: `pnpm --filter @merris/api dev`
Terminal B: `pnpm --filter @merris/web dev`

- [ ] **Step 2: Walk every route**

Visit in a browser, in this order, and confirm each renders without errors:
1. `http://localhost:3000/` → redirects to `/intelligence`
2. `/intelligence` → placeholder
3. `/portfolio` → placeholder
4. `/portfolio/test-id` → placeholder
5. `/compliance` → placeholder
6. `/knowledge` → placeholder
7. `/firm-library` → placeholder
8. `/workflow-agents` → placeholder
9. `/history` → placeholder
10. `/config` → placeholder
11. `/settings` → placeholder
12. `/login` → light-themed login form

- [ ] **Step 3: Verify visual parity with prototype**

Open `merris-platform-7.html` in a separate browser tab. Compare side-by-side:
- Sidebar width and item layout match
- Brand colour matches (`#006b5f`)
- Font (Manrope headings, Inter body) matches
- No dark backgrounds anywhere in the dashboard
- Active sidebar item has the teal left border + tinted background

- [ ] **Step 4: API client smoke test from the browser console**

In the browser DevTools console on `/intelligence`:

```js
const { api } = await import('/lib/api.ts'); // or whichever path works in dev
api.setToken('<paste a valid JWT>');
await api.listEngagements();
```

Expected: returns the engagements array (or an empty list if the seed is empty). 401 means token issue, not a code bug.

- [ ] **Step 5: Document any visual deltas**

If there are visual deltas vs the prototype that aren't covered by Plans 3–5, file them as follow-up tasks. Don't fix them in this plan — Plan 2 is foundation only.

- [ ] **Step 6: No commit needed if everything passed.**

---

## Self-Review Checklist

1. **Spec coverage:**
   - Light theme installed ✓ (Tasks 2, 3, 4, 14)
   - Manrope + Inter fonts ✓ (Task 2)
   - `#006b5f` palette ✓ (Tasks 3, 4)
   - 9-item sidebar matching prototype order ✓ (Task 12)
   - All 9 prototype routes exist as stubs ✓ (Task 17)
   - Old extra pages deleted ✓ (Task 16)
   - API client uses real route inventory ✓ (Task 19)
   - SSE chat consumer exists for Plan 1 backend ✓ (Task 19)
   - Auth flow preserved and restyled ✓ (Task 18)

2. **Backwards compatibility:** Existing shadcn `components/ui/*` primitives kept; existing `lib/utils.ts` and `lib/store.ts` (auth) untouched. The chat-store and main-store are deleted because they were tightly coupled to the deleted UI; Plan 3 will introduce a new chat store designed around SSE events.

3. **No placeholders in code:** Every code block in this plan is complete and executable. The "PlaceholderPage" component is itself a real component, not a planning placeholder.

4. **Type consistency:** `StreamEvent` is imported from `@merris/shared` (defined in Plan 1 Task 1). `MerrisButton`, `MerrisCard`, `MerrisSidebar`, `MerrisTopBar`, `Pill`, `Chip`, `ScoreRing`, `SectionLabel`, `PlaceholderPage` are the canonical names used consistently across all tasks.

5. **Dependency on Plan 1:** Task 19 imports `StreamEvent` from `@merris/shared`. **Plan 1 Tasks 1–2 must merge first**, or this task will fail. The other tasks in Plan 2 are independent of Plan 1.

---

## Sketches: Plans 3, 4, 5 (one paragraph each — full plans written after Plans 1+2 merge)

### Plan 3: `intelligence-page`

Wires the `/intelligence` chat surface end-to-end. Builds a `ThinkingState` component that subscribes to `api.chatStream(payload, onEvent)` from Plan 2 and renders a vertical timeline of phase circles (pending → pulsing → checked) with source chips on `thinking_sources`. Builds the response-archetype renderers: `AdvisoryResponse` (with `ScoreRing`, confidence pill, citations, copy/export actions), `QuantitativeResponse` (monospace formula card), `FindingsResponse` (severity-coloured cards from `findings` events), and `RefusalResponse`. Builds the context controls header: jurisdiction `Chip` row, K1–K7 source toggles, sector/vault dropdowns wired to the `ChatRequestPayload`. Replaces the placeholder `PlaceholderPage` import in `app/(dashboard)/intelligence/page.tsx` with the real composition. New chat store (Zustand) holds `messages[]`, `pendingThinkingSteps`, `currentSources`, `jurisdiction[]`, `knowledgeSources[]`. Tests: a Vitest component test for `ThinkingState` driven by a mocked event stream; a Playwright test for the full chat→thinking→response flow against a mocked SSE endpoint. **Depends on:** Plans 1 and 2.

### Plan 4: `portfolio-and-doc-viewer`

Wires the `/portfolio` engagement grid and `/portfolio/[id]` engagement detail with the document viewer split-pane. Engagement cards use `MerrisCard` + `Pill` (status) + `ScoreRing` (completeness) + framework chips, sourced from `api.listEngagements()`. Detail page uses a two-pane layout (left ~40% chat continuation, right ~60% document viewer) that activates when the user clicks a "Run Full Review" or "Open Document" CTA. Builds `DocumentViewer` component with three mode tabs (Edit / Review / Export), rich text rendering of `api.getDocument(id).content`, inline annotation markers from `api.getDisclosureFindings(engagementId, disclosureId)`, "Apply fix" buttons that trigger inline edits, and a pending-changes action bar. Wires the `MerrisTopBar` engagement selector to `api.listEngagements()` (replacing the static "QAPCO Sustainability 2026" label) and stores the active engagement in a new Zustand `engagement-store`. Tests: contract test that the engagements list hydrates correctly; visual regression for the split-pane layout. **Depends on:** Plan 2.

### Plan 5: `remaining-pages`

Wires Knowledge, Workflow Agents, Compliance, Firm Library, History, AI Config, and Settings, in that order of priority. Knowledge: `api.listKnowledgeCollections()` populates a 7-card grid (K1 Disclosures … K7 Research) with click-through to a per-collection search using `api.searchKnowledge()`. Workflow Agents: tabbed Library/Builder; Library hydrates from `api.listWorkflows()` and renders prebuilt + custom agent cards with rating, runs, run-button → `api.executeWorkflow()` → `api.getWorkflowStatus()` polling shown via the same `ThinkingState`-style timeline from Plan 3. Compliance, History, Firm Library, AI Config, Settings: thinner pages mostly composed of `MerrisCard` lists; Compliance hydrates from `api.listFrameworks()`, History from a new `/api/v1/assistant/history` route (add to backend if absent), Firm Library from `/documents` cross-engagement query (add backend route), AI Config and Settings persist to `localStorage` only initially. **Depends on:** Plans 2, 3 (for the timeline component reuse).
