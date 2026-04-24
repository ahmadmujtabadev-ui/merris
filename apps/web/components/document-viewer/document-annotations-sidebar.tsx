'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { SectionLabel } from '@/components/merris/label';
import { Pill } from '@/components/merris/pill';
import { api } from '@/lib/api';
import type { DocumentAnnotation, AnnotationSeverity } from './document-viewer-data';

interface Props {
  annotations: DocumentAnnotation[];
  mode: 'edit' | 'review' | 'export';
  documentId: string;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
  onAnnotationAdded: (annotation: DocumentAnnotation) => void;
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

function AddFindingForm({
  documentId,
  onAdded,
}: {
  documentId: string;
  onAdded: (annotation: DocumentAnnotation) => void;
}) {
  const [severity, setSeverity] = useState<AnnotationSeverity>('IMPORTANT');
  const [ref, setRef] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [suggestedFix, setSuggestedFix] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.createDocumentAnnotation(documentId, {
        severity,
        ref: ref.trim() || 'Manual',
        title: title.trim(),
        description: description.trim(),
        suggestedFix: suggestedFix.trim() || undefined,
      });
      onAdded({
        id: res.annotation.id,
        severity: res.annotation.severity,
        ref: res.annotation.ref,
        title: res.annotation.title,
        description: res.annotation.description,
        suggestedFix: res.annotation.suggestedFix,
        status: 'pending',
      });
      setRef('');
      setTitle('');
      setDescription('');
      setSuggestedFix('');
    } catch {
      setError('Failed to save finding. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MerrisCard style={{ padding: '14px' }}>
      <div className="mb-2 font-display text-[12px] font-semibold text-merris-text">Add Finding</div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-1.5">
          {(['CRITICAL', 'IMPORTANT', 'MINOR'] as AnnotationSeverity[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={clsx(
                'rounded-full px-2 py-0.5 font-body text-[9px] font-bold uppercase',
                severity === s
                  ? s === 'CRITICAL' ? 'bg-merris-error text-white'
                    : s === 'IMPORTANT' ? 'bg-merris-warning text-white'
                    : 'bg-merris-surface-high text-merris-text'
                  : 'bg-merris-surface-low text-merris-text-tertiary'
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Ref (e.g. GRI 305-1)"
          className="w-full rounded-merris-sm bg-merris-surface-low px-2 py-1.5 font-body text-[11px] text-merris-text outline-none placeholder:text-merris-text-tertiary"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Finding title *"
          required
          className="w-full rounded-merris-sm bg-merris-surface-low px-2 py-1.5 font-body text-[11px] text-merris-text outline-none placeholder:text-merris-text-tertiary"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description *"
          required
          rows={2}
          className="w-full resize-none rounded-merris-sm bg-merris-surface-low px-2 py-1.5 font-body text-[11px] text-merris-text outline-none placeholder:text-merris-text-tertiary"
        />
        <input
          type="text"
          value={suggestedFix}
          onChange={(e) => setSuggestedFix(e.target.value)}
          placeholder="Suggested fix (optional)"
          className="w-full rounded-merris-sm bg-merris-surface-low px-2 py-1.5 font-body text-[11px] text-merris-text outline-none placeholder:text-merris-text-tertiary"
        />
        {error && <p className="font-body text-[10px] text-merris-error">{error}</p>}
        <MerrisButton variant="primary" disabled={saving || !title.trim() || !description.trim()}>
          {saving ? 'Saving…' : '+ Add Finding'}
        </MerrisButton>
      </form>
    </MerrisCard>
  );
}

export function DocumentAnnotationsSidebar({ annotations, mode, documentId, onApply, onDismiss, onAnnotationAdded }: Props) {
  const pending = annotations.filter((a) => a.status === 'pending');
  const applied = annotations.filter((a) => a.status === 'applied');
  const dismissed = annotations.filter((a) => a.status === 'dismissed');

  return (
    <div className="space-y-4">
      <SectionLabel>Findings</SectionLabel>

      {mode === 'edit' && (
        <AddFindingForm documentId={documentId} onAdded={onAnnotationAdded} />
      )}

      <div className="font-body text-[11px] text-merris-text-secondary">
        {pending.length} pending · {applied.length} applied · {dismissed.length} dismissed
      </div>

      {pending.length === 0 && (
        <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">
          {mode === 'edit' ? 'No pending findings. Add one above.' : 'All findings resolved.'}
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
