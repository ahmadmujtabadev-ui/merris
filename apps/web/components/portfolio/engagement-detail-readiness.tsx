'use client';

import { MerrisCard } from '@/components/merris/card';
import { ScoreRing } from '@/components/merris/score-ring';

export function EngagementDetailReadiness({ score }: { score: number }) {
  const message = score === 0
    ? 'Upload documents and run a review to calculate readiness.'
    : score < 50
    ? 'Significant gaps remain. Upload more evidence and run a full review.'
    : score < 80
    ? 'Good progress. Some gaps still need addressing before submission.'
    : 'Report is nearly ready for submission.';

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
