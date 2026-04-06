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
