'use client';

import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';

export function EngagementDetailFindings() {
  return (
    <>
      <SectionLabel>Critical Findings</SectionLabel>
      <MerrisCard className="mb-5 text-center" style={{ padding: '24px' }}>
        <p className="font-body text-[12px] text-merris-text-tertiary">
          No findings yet. Upload documents and run an AI review to generate findings.
        </p>
      </MerrisCard>
    </>
  );
}
