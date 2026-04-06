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
