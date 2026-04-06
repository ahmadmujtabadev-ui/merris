'use client';

import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { ScoreRing } from '@/components/merris/score-ring';
import { useChatStore } from '@/lib/chat-store';
import { CitationsList } from './citations-list';
import { merrisTokens } from '@/lib/design-tokens';

export function AdvisoryResponse() {
  const tokenText = useChatStore((s) => s.tokenText);
  const citations = useChatStore((s) => s.citations);
  const evaluation = useChatStore((s) => s.evaluation);

  const confidenceVariant: 'completed' | 'in-progress' | 'draft' =
    evaluation?.confidence === 'high'
      ? 'completed'
      : evaluation?.confidence === 'medium'
        ? 'in-progress'
        : 'draft';

  return (
    <>
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-merris-primary font-display text-[11px] font-bold text-white">
          M
        </div>
        {evaluation && (
          <Pill variant={confidenceVariant} size="sm">
            {evaluation.confidence} Confidence
          </Pill>
        )}
        {evaluation && (
          <span className="ml-auto">
            <ScoreRing score={evaluation.score} size={34} />
          </span>
        )}
      </div>

      <MerrisCard
        className="mb-3.5 p-5"
        style={{ borderLeft: `3px solid ${merrisTokens.primaryLight}` }}
      >
        <p className="whitespace-pre-wrap font-body text-[13px] leading-[1.7] text-merris-text">
          {tokenText}
        </p>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <div className="rounded-merris-sm bg-merris-surface-low px-3 py-2">
            <div className="font-body text-[9px] uppercase text-merris-text-tertiary">SASB Alignment</div>
            <div className="font-display text-[13px] font-semibold text-merris-text">Compliant ✓</div>
          </div>
          <div className="rounded-merris-sm bg-merris-surface-low px-3 py-2">
            <div className="font-body text-[9px] uppercase text-merris-text-tertiary">Materiality Gap</div>
            <div className="font-display text-[13px] font-semibold text-merris-warning">Minimal Risk</div>
          </div>
        </div>

        <div className="mt-3.5 font-body text-[11px] text-merris-text-secondary">
          {citations.length} source{citations.length === 1 ? '' : 's'} cited
        </div>

        <CitationsList citations={citations} />
      </MerrisCard>
    </>
  );
}
