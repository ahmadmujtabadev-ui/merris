'use client';

import { MerrisCard } from '@/components/merris/card';
import { ScoreRing } from '@/components/merris/score-ring';

export function EngagementDetailReadiness({ score }: { score: number }) {
  const message = score === 0
    ? 'Upload documents and process them to extract data points.'
    : score < 50
    ? 'Data extracted — review and confirm metrics to increase readiness.'
    : score < 80
    ? 'Good progress. Confirm remaining data points to finalize the report.'
    : 'Report is nearly ready. Confirm any remaining auto-extracted metrics.';

  return (
    <MerrisCard className="mb-5">
      <div className="flex items-center gap-6">
        <ScoreRing score={score} variant="donut" />
        <div>
          <div className="mb-1 font-display text-[18px] font-bold text-merris-text">Report Readiness</div>
          <p className="font-body text-[12px] leading-relaxed text-merris-text-secondary">{message}</p>
        </div>
      </div>
    </MerrisCard>
  );
}
