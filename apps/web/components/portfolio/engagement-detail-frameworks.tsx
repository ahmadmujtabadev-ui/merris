'use client';

import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';

export function EngagementDetailFrameworks({ frameworks }: { frameworks: string[] }) {
  if (!frameworks || frameworks.length === 0) {
    return (
      <>
        <SectionLabel>Framework Compliance</SectionLabel>
        <MerrisCard className="mb-5 text-center" style={{ padding: '20px' }}>
          <p className="font-body text-[12px] text-merris-text-tertiary">
            No frameworks selected. Edit this engagement to add frameworks.
          </p>
        </MerrisCard>
      </>
    );
  }

  return (
    <>
      <SectionLabel>Frameworks</SectionLabel>
      <div className="mb-5 flex flex-wrap gap-2">
        {frameworks.map((f) => (
          <span
            key={f}
            className="rounded-merris-sm bg-merris-surface-low px-3 py-1 font-body text-[12px] font-medium text-merris-text"
          >
            {f}
          </span>
        ))}
      </div>
    </>
  );
}
