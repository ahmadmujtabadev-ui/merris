'use client';

import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { ScoreRing } from '@/components/merris/score-ring';
import { useChatStore } from '@/lib/chat-store';
import { CitationsList } from './citations-list';
import { MarkdownText } from './markdown-text';
import { merrisTokens } from '@/lib/design-tokens';

export function AdvisoryResponse() {
  const tokenText = useChatStore((s) => s.tokenText);
  const citations = useChatStore((s) => s.citations);
  const evaluation = useChatStore((s) => s.evaluation);
  const phase = useChatStore((s) => s.phase);

  const isStreaming = phase === 'thinking';

  const confidenceVariant: 'completed' | 'in-progress' | 'draft' =
    evaluation?.confidence === 'high'
      ? 'completed'
      : evaluation?.confidence === 'medium'
        ? 'in-progress'
        : 'draft';

  return (
    <div className="animate-slide-in">
      {/* Merris header row */}
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-merris-primary font-display text-[11px] font-bold text-white">
          M
        </div>
        <span className="font-display text-[13px] font-semibold text-merris-text">Merris</span>
        {evaluation && (
          <Pill variant={confidenceVariant} size="sm">
            {evaluation.confidence} confidence
          </Pill>
        )}
        {evaluation && (
          <span className="ml-auto">
            <ScoreRing score={evaluation.score} size={32} />
          </span>
        )}
      </div>

      {/* Response card */}
      <MerrisCard
        className="p-5"
        style={{ borderLeft: `3px solid ${merrisTokens.primaryLight}` }}
      >
        <MarkdownText text={tokenText} streaming={isStreaming} />

        {/* Citations */}
        {citations.length > 0 && (
          <div className="mt-1">
            <CitationsList citations={citations} />
          </div>
        )}

        {/* Source count — shown only after streaming completes */}
        {!isStreaming && citations.length > 0 && (
          <div className="mt-3 font-body text-[11px] text-merris-text-tertiary">
            {citations.length} source{citations.length === 1 ? '' : 's'} cited
          </div>
        )}
      </MerrisCard>
    </div>
  );
}
