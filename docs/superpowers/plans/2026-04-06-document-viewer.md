# Document Viewer Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Ship a standalone document viewer module accessible at `/portfolio/[engagementId]/documents/[documentId]`, plus a documents section on the engagement detail page that links to it. Reads document content from the existing `GET /api/v1/documents/:id` endpoint.

**Architecture:** A new dynamic route `app/(dashboard)/portfolio/[id]/documents/[docId]/page.tsx` renders a `<DocumentViewer documentId={...} />` client component. The viewer fetches via `api.getDocument(documentId)`, displays a header with name + version + Edit/Review/Export tab toggle, renders the document's `extractedText` as styled prose, and shows a hardcoded annotations sidebar matching the prototype's findings concept. Apply-fix updates local state (no backend persistence yet). The engagement detail page gets a new "Documents" section that hydrates from `api.listEngagementDocuments(engagementId)` and lists each document as a link to the viewer.

**Out of scope:**
- Rich-text editing (the viewer is read-only; Edit tab is a visual marker only)
- Real annotation persistence (annotations are hardcoded; Apply fix is local state)
- Track changes (insertions/deletions) — visual only via inline annotation list
- Inline highlighting of annotated spans (annotations sit in a sidebar list with line refs)
- Export action (Export tab is a marker; click is a no-op)
- Document upload from the viewer (Plan 4's NewEngagementModal already creates engagements; document upload is its own follow-up)

---

## File Structure

```
apps/web/
├── app/(dashboard)/portfolio/[id]/documents/[docId]/page.tsx     (NEW)
└── components/document-viewer/
    ├── document-viewer.tsx                  (NEW — orchestrator)
    ├── document-viewer-header.tsx           (NEW — name + version + mode tabs + back link)
    ├── document-viewer-content.tsx          (NEW — renders extractedText as paragraphs)
    ├── document-annotations-sidebar.tsx     (NEW — annotation list with Apply fix)
    ├── document-empty-state.tsx             (NEW — fallback when document not found)
    └── document-viewer-data.ts              (NEW — hardcoded ANNOTATIONS_FIXTURE)

apps/web/components/portfolio/
└── engagement-documents-section.tsx         (NEW — documents list on engagement detail)

apps/web/components/portfolio/engagement-detail.tsx   (modified — adds <EngagementDocumentsSection />)
```

8 new files, 1 modification.

---

## Constants and shared data

`apps/web/components/document-viewer/document-viewer-data.ts`:

```ts
export type AnnotationSeverity = 'CRITICAL' | 'IMPORTANT' | 'MINOR';
export type AnnotationStatus = 'pending' | 'applied' | 'dismissed';

export interface DocumentAnnotation {
  id: string;
  severity: AnnotationSeverity;
  ref: string;            // e.g. 'GRI 305-1'
  title: string;
  description: string;
  suggestedFix?: string;  // text to apply
  status: AnnotationStatus;
}

// Hardcoded annotations matching the prototype FINDS spirit. Real annotations
// will eventually come from the assurance pack endpoint. The viewer's apply-fix
// button mutates these in local state only.
export const ANNOTATIONS_FIXTURE: DocumentAnnotation[] = [
  {
    id: 'a1',
    severity: 'CRITICAL',
    ref: 'GRI 305-1',
    title: 'Mismatched Direct Emissions',
    description: 'Reported Scope 1 (14,200 tCO2e) does not match facility-level sum (15,840 tCO2e).',
    suggestedFix: 'Reconcile facility emissions or restate the headline Scope 1 figure to 15,840 tCO2e.',
    status: 'pending',
  },
  {
    id: 'a2',
    severity: 'IMPORTANT',
    ref: 'G2.1',
    title: 'Vague Board Oversight',
    description: 'No mention of a Climate Risk Subcommittee or named board sponsor.',
    suggestedFix: 'Add a sentence naming the board sponsor for climate risk and the cadence of reviews.',
    status: 'pending',
  },
  {
    id: 'a3',
    severity: 'MINOR',
    ref: 'Format',
    title: 'Missing Appendix Link',
    description: 'Reference to Appendix D is broken.',
    status: 'pending',
  },
];
```

---

## Task 1: Document viewer header

`apps/web/components/document-viewer/document-viewer-header.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Pill } from '@/components/merris/pill';

type Mode = 'edit' | 'review' | 'export';

interface Props {
  documentName: string;
  version?: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  backHref: string;
  pendingChanges: number;
}

const MODES: Array<{ key: Mode; label: string }> = [
  { key: 'edit',   label: 'Edit' },
  { key: 'review', label: 'Review' },
  { key: 'export', label: 'Export' },
];

export function DocumentViewerHeader({
  documentName,
  version,
  mode,
  onModeChange,
  backHref,
  pendingChanges,
}: Props) {
  return (
    <header className="mb-5 flex items-center gap-3">
      <Link href={backHref} className="text-merris-text-secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </Link>
      <div className="flex flex-1 items-baseline gap-2">
        <h1 className="font-display text-[18px] font-bold text-merris-text">{documentName}</h1>
        {version && (
          <Pill variant="draft" size="sm">{version}</Pill>
        )}
      </div>
      <div className="inline-flex rounded-merris-sm bg-merris-surface-low p-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onModeChange(m.key)}
            className={
              mode === m.key
                ? 'rounded-[6px] bg-merris-primary px-3 py-1 font-display text-[12px] font-semibold text-white'
                : 'px-3 py-1 font-display text-[12px] text-merris-text-secondary'
            }
          >
            {m.label}
          </button>
        ))}
      </div>
      {pendingChanges > 0 && (
        <Pill variant="important" size="sm">
          {pendingChanges} pending
        </Pill>
      )}
    </header>
  );
}
```

Commit: `feat(docviewer): add DocumentViewerHeader with mode tabs`

---

## Task 2: Document content renderer

`apps/web/components/document-viewer/document-viewer-content.tsx`:

```tsx
'use client';

import { MerrisCard } from '@/components/merris/card';

interface Props {
  text: string | null | undefined;
}

export function DocumentViewerContent({ text }: Props) {
  if (!text) {
    return (
      <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">
        This document has no extracted text yet. Trigger processing from the engagement view.
      </MerrisCard>
    );
  }

  // Split on double-newline for paragraphs; preserve single newlines as line breaks
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <MerrisCard className="font-body text-[13px] leading-[1.7] text-merris-text">
      <article className="prose-merris">
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-4 last:mb-0 whitespace-pre-line">
            {p}
          </p>
        ))}
      </article>
    </MerrisCard>
  );
}
```

Commit: `feat(docviewer): add DocumentViewerContent paragraph renderer`

---

## Task 3: Annotations sidebar with apply-fix

`apps/web/components/document-viewer/document-annotations-sidebar.tsx`:

```tsx
'use client';

import clsx from 'clsx';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { SectionLabel } from '@/components/merris/label';
import { Pill } from '@/components/merris/pill';
import type { DocumentAnnotation, AnnotationSeverity } from './document-viewer-data';

interface Props {
  annotations: DocumentAnnotation[];
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
}

const BORDER_BY_SEVERITY: Record<AnnotationSeverity, string> = {
  CRITICAL: 'border-l-merris-error',
  IMPORTANT: 'border-l-merris-warning',
  MINOR: 'border-l-merris-text-tertiary',
};

const PILL_VARIANT: Record<AnnotationSeverity, 'critical' | 'important' | 'minor'> = {
  CRITICAL: 'critical',
  IMPORTANT: 'important',
  MINOR: 'minor',
};

export function DocumentAnnotationsSidebar({ annotations, onApply, onDismiss }: Props) {
  const pending = annotations.filter((a) => a.status === 'pending');
  const applied = annotations.filter((a) => a.status === 'applied');
  const dismissed = annotations.filter((a) => a.status === 'dismissed');

  return (
    <div className="space-y-4">
      <SectionLabel>Findings</SectionLabel>

      <div className="font-body text-[11px] text-merris-text-secondary">
        {pending.length} pending · {applied.length} applied · {dismissed.length} dismissed
      </div>

      {pending.length === 0 && (
        <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">
          All findings resolved.
        </MerrisCard>
      )}

      {pending.map((a) => (
        <MerrisCard
          key={a.id}
          className={clsx('border-l-[3px] p-4', BORDER_BY_SEVERITY[a.severity])}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <Pill variant={PILL_VARIANT[a.severity]} size="sm">{a.severity}</Pill>
            <span className="font-body text-[10px] uppercase text-merris-text-tertiary">{a.ref}</span>
          </div>
          <div className="mb-1 font-display text-[13px] font-semibold text-merris-text">{a.title}</div>
          <div className="mb-2 font-body text-[11px] leading-relaxed text-merris-text-secondary">
            {a.description}
          </div>
          {a.suggestedFix && (
            <div className="mb-2.5 rounded-merris-sm bg-merris-primary-bg p-2 font-body text-[11px] italic text-merris-text">
              <span className="font-semibold uppercase text-merris-primary">Suggested:</span>{' '}
              {a.suggestedFix}
            </div>
          )}
          <div className="flex gap-2">
            <MerrisButton variant="primary" onClick={() => onApply(a.id)}>
              ✓ Apply fix
            </MerrisButton>
            <MerrisButton variant="secondary" onClick={() => onDismiss(a.id)}>
              Dismiss
            </MerrisButton>
          </div>
        </MerrisCard>
      ))}

      {applied.length > 0 && (
        <details className="font-body text-[11px]">
          <summary className="cursor-pointer text-merris-text-tertiary">Applied ({applied.length})</summary>
          <div className="mt-2 space-y-1.5">
            {applied.map((a) => (
              <div key={a.id} className="rounded-merris-sm bg-merris-success-bg px-2 py-1 text-merris-success">
                ✓ {a.title}
              </div>
            ))}
          </div>
        </details>
      )}

      {dismissed.length > 0 && (
        <details className="font-body text-[11px]">
          <summary className="cursor-pointer text-merris-text-tertiary">Dismissed ({dismissed.length})</summary>
          <div className="mt-2 space-y-1.5">
            {dismissed.map((a) => (
              <div key={a.id} className="rounded-merris-sm bg-merris-surface-low px-2 py-1 text-merris-text-tertiary">
                ✕ {a.title}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
```

Commit: `feat(docviewer): add DocumentAnnotationsSidebar with apply/dismiss actions`

---

## Task 4: Empty state

`apps/web/components/document-viewer/document-empty-state.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';

export function DocumentEmptyState({ backHref, error }: { backHref: string; error?: string }) {
  return (
    <div className="p-6">
      <MerrisCard className="border-2 border-dashed border-merris-border-medium bg-transparent text-center shadow-none" style={{ padding: '48px 32px' }}>
        <div className="mb-3 text-[28px]">📄</div>
        <div className="mb-1 font-display text-[16px] font-bold text-merris-text">
          {error ?? 'Document not found'}
        </div>
        <p className="mb-4 font-body text-[12px] text-merris-text-secondary">
          {error
            ? 'The viewer could not load this document.'
            : 'This document may have been deleted or never finished processing.'}
        </p>
        <Link href={backHref}>
          <MerrisButton variant="primary">← Back to engagement</MerrisButton>
        </Link>
      </MerrisCard>
    </div>
  );
}
```

Commit: `feat(docviewer): add DocumentEmptyState fallback`

---

## Task 5: DocumentViewer orchestrator

`apps/web/components/document-viewer/document-viewer.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MerrisCard } from '@/components/merris/card';
import { DocumentViewerHeader } from './document-viewer-header';
import { DocumentViewerContent } from './document-viewer-content';
import { DocumentAnnotationsSidebar } from './document-annotations-sidebar';
import { DocumentEmptyState } from './document-empty-state';
import { ANNOTATIONS_FIXTURE, type DocumentAnnotation } from './document-viewer-data';

interface DocumentDetail {
  id: string;
  filename: string;
  format?: string;
  extractedText?: string;
  version?: string;
}

interface Props {
  engagementId: string;
  documentId: string;
}

type Mode = 'edit' | 'review' | 'export';

export function DocumentViewer({ engagementId, documentId }: Props) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('review');
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>(ANNOTATIONS_FIXTURE);

  const backHref = `/portfolio/${engagementId}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getDocument(documentId)
      .then((res) => {
        if (cancelled) return;
        // Backend response shape: { document: { ... } }
        const d = (res as { document: DocumentDetail }).document;
        if (!d) {
          setError('Document not found');
        } else {
          setDoc(d);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load document');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const apply = (id: string) =>
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'applied' } : a)));
  const dismiss = (id: string) =>
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'dismissed' } : a)));

  if (loading) {
    return (
      <div className="p-6">
        <MerrisCard className="text-center font-body text-[12px] text-merris-text-tertiary">
          Loading document…
        </MerrisCard>
      </div>
    );
  }
  if (error || !doc) {
    return <DocumentEmptyState backHref={backHref} error={error ?? undefined} />;
  }

  const pending = annotations.filter((a) => a.status === 'pending').length;

  return (
    <div className="p-6">
      <DocumentViewerHeader
        documentName={doc.filename}
        version={doc.version ?? 'v1'}
        mode={mode}
        onModeChange={setMode}
        backHref={backHref}
        pendingChanges={pending}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <DocumentViewerContent text={doc.extractedText} />
        <DocumentAnnotationsSidebar
          annotations={annotations}
          onApply={apply}
          onDismiss={dismiss}
        />
      </div>
    </div>
  );
}
```

Commit: `feat(docviewer): add DocumentViewer orchestrator with loading/error/content states`

---

## Task 6: Wire the viewer route

`apps/web/app/(dashboard)/portfolio/[id]/documents/[docId]/page.tsx`:

```tsx
import { DocumentViewer } from '@/components/document-viewer/document-viewer';

export default function Page({ params }: { params: { id: string; docId: string } }) {
  return <DocumentViewer engagementId={params.id} documentId={params.docId} />;
}
```

Build clean. Confirm the new route appears in the build output. Commit: `feat(docviewer): wire DocumentViewer at /portfolio/[id]/documents/[docId]`

---

## Task 7: Documents section on engagement detail

`apps/web/components/portfolio/engagement-documents-section.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';
import { api, type IngestedDocument } from '@/lib/api';

export function EngagementDocumentsSection({ engagementId }: { engagementId: string }) {
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listEngagementDocuments(engagementId)
      .then((res) => {
        if (cancelled) return;
        setDocuments(res.documents ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  return (
    <div className="mt-5">
      <SectionLabel>Documents</SectionLabel>
      {loading && (
        <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">Loading documents…</MerrisCard>
      )}
      {!loading && error && (
        <MerrisCard className="border-l-[3px] border-merris-error font-body text-[12px] text-merris-error">
          {error}
        </MerrisCard>
      )}
      {!loading && !error && documents.length === 0 && (
        <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">
          No documents uploaded yet. Use the Word add-in or the upload endpoint to add reports.
        </MerrisCard>
      )}
      {!loading && !error && documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((d) => (
            <Link key={d.id} href={`/portfolio/${engagementId}/documents/${d.id}`} className="block">
              <MerrisCard hover style={{ padding: '12px 16px' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[16px]">📄</span>
                  <div className="flex-1 font-display text-[13px] font-semibold text-merris-text">{d.filename}</div>
                  <span className="font-body text-[10px] uppercase text-merris-text-tertiary">{d.format}</span>
                </div>
              </MerrisCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

Commit: `feat(portfolio): add EngagementDocumentsSection`

---

## Task 8: Wire documents section into engagement detail

Modify `apps/web/components/portfolio/engagement-detail.tsx`. After the `<EngagementDetailFindings />` element inside the left column, insert:

```tsx
<EngagementDocumentsSection engagementId={engagement.id} />
```

And add the import:

```tsx
import { EngagementDocumentsSection } from './engagement-documents-section';
```

Build clean. Commit: `feat(portfolio): show documents section on engagement detail`

---

## Task 9: End-to-end smoke test

1. Build: `pnpm --filter @merris/web build` — clean
2. Confirm both new routes appear:
   - `/portfolio/[id]/documents/[docId]` (dynamic)
   - `/portfolio/[id]` bundle slightly larger (now imports the documents section)
3. Optionally start dev server and curl `/portfolio/test-eng/documents/test-doc` — should return 200 (will show "Document not found" empty state without a real backend)

No commit unless a bug is found.

---

## Constraints (apply to every task)

1. EXACT code in every file. No improvements.
2. ONE commit per task in order.
3. The new code lives entirely under `apps/web/components/document-viewer/` plus `apps/web/components/portfolio/engagement-documents-section.tsx` and the modification to `engagement-detail.tsx`. Do NOT touch any other files.
4. The viewer is read-only. Edit / Review / Export tabs are visual only — no actual editing.
5. Annotations are hardcoded in `ANNOTATIONS_FIXTURE`. Apply-fix mutates local state, not the backend.
6. The `api.getDocument(documentId)` method already exists from Plan 2.
7. The `api.listEngagementDocuments(engagementId)` method already exists from Plan 2.
8. After every commit, the build must be green.

---

## Known Limitations / Follow-ups

- **No rich-text editing** — the Edit tab is visual only
- **No annotation persistence** — Apply fix is local state only; refresh resets
- **No inline highlighting** — annotations live in a sidebar list, not inline in the document body
- **No scroll-to-line** — clicking an annotation doesn't navigate to a span in the document
- **No track changes** — insertions/deletions aren't visualized
- **No real findings** — `ANNOTATIONS_FIXTURE` is hardcoded; real annotations should come from the assurance pack endpoint
- **No file upload** — viewer can only display existing documents; upload is the Word add-in's job today
- **Version is hardcoded** to `'v1'` — backend doesn't track document versions yet
- **Export tab is a no-op** — eventually should call `api.runAssurancePack(engagementId)` and download the result
