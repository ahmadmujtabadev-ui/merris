'use client';

import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { ScoreRing } from '@/components/merris/score-ring';
import { CitationsList } from './citations-list';
import { merrisTokens } from '@/lib/design-tokens';
import type { ChatMessage } from '@/lib/chat-store';

export function ConversationMessage({ message }: { message: ChatMessage }) {
  const confidenceVariant: 'completed' | 'in-progress' | 'draft' =
    message.evaluation?.confidence === 'high'
      ? 'completed'
      : message.evaluation?.confidence === 'medium'
        ? 'in-progress'
        : 'draft';

  return (
    <div className="mb-6">
      <MerrisCard className="mb-3 bg-merris-surface-low px-4 py-3">
        <div className="font-body text-[13px] text-merris-text">{message.question}</div>
      </MerrisCard>

      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-merris-primary font-display text-[11px] font-bold text-white">
          M
        </div>
        {message.evaluation && (
          <Pill variant={confidenceVariant} size="sm">
            {message.evaluation.confidence} Confidence
          </Pill>
        )}
        {message.evaluation && (
          <span className="ml-auto">
            <ScoreRing score={message.evaluation.score} size={34} />
          </span>
        )}
      </div>

      <MerrisCard
        className="p-5"
        style={{ borderLeft: `3px solid ${merrisTokens.primaryLight}` }}
      >
        <p className="whitespace-pre-wrap font-body text-[13px] leading-[1.7] text-merris-text">
          {message.answer}
        </p>
        <div className="mt-3 font-body text-[11px] text-merris-text-secondary">
          {message.citations.length} source{message.citations.length === 1 ? '' : 's'} cited
        </div>
        <CitationsList citations={message.citations} />
      </MerrisCard>
    </div>
  );
}
