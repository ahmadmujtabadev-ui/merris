'use client';

import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';
import { PLACEHOLDER_FRAMEWORK_COMPLIANCE } from '@/lib/portfolio-constants';

export function EngagementDetailFrameworks() {
  return (
    <>
      <SectionLabel>Framework Compliance</SectionLabel>
      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
        {PLACEHOLDER_FRAMEWORK_COMPLIANCE.map(({ code, percent }) => {
          const color = percent > 50 ? 'text-merris-primary' : percent > 0 ? 'text-merris-warning' : 'text-merris-text-tertiary';
          return (
            <MerrisCard key={code} className="text-center" style={{ padding: '12px' }}>
              <div className="mb-1 font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">{code}</div>
              <div className={`font-display text-[20px] font-bold ${color}`}>{percent}%</div>
            </MerrisCard>
          );
        })}
      </div>
    </>
  );
}
