'use client';

import { MerrisCard } from '@/components/merris/card';
import { ScoreRing } from '@/components/merris/score-ring';

export function EngagementDetailReadiness({ score }: { score: number }) {
  return (
    <MerrisCard className="mb-5">
      <div className="flex items-center gap-6">
        <ScoreRing score={score} variant="donut" />
        <div>
          <div className="mb-1 font-display text-[18px] font-bold text-merris-text">Report Readiness</div>
          <p className="font-body text-[12px] leading-relaxed text-merris-text-secondary">
            Critical gaps in Scope 2 and Water stewardship.
          </p>
        </div>
      </div>
    </MerrisCard>
  );
}
