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

  // Add a new useEffect to fetch annotations after the document loads
  useEffect(() => {
    let cancelled = false;
    api
      .listDocumentAnnotations(documentId)
      .then((res) => {
        if (cancelled) return;
        // The API returns a richer shape (id, documentId, createdAt, updatedAt). Map down
        // to the local DocumentAnnotation shape used by the sidebar.
        setAnnotations(
          res.annotations.map((a) => ({
            id: a.id,
            severity: a.severity,
            ref: a.ref,
            title: a.title,
            description: a.description,
            suggestedFix: a.suggestedFix,
            status: a.status,
          })),
        );
      })
      .catch(() => {
        // Keep the fixture as a fallback
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const apply = async (id: string) => {
    // Optimistic update first
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'applied' } : a)));
    try {
      await api.updateDocumentAnnotation(documentId, id, 'applied');
    } catch {
      // Revert on failure
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'pending' } : a)));
    }
  };

  const dismiss = async (id: string) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'dismissed' } : a)));
    try {
      await api.updateDocumentAnnotation(documentId, id, 'dismissed');
    } catch {
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'pending' } : a)));
    }
  };

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
