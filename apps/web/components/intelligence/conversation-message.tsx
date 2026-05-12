'use client';

import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { ScoreRing } from '@/components/merris/score-ring';
import { CitationsList } from './citations-list';
import { MarkdownText } from './markdown-text';
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
      {/* Question bubble */}
      <MerrisCard className="mb-3 bg-merris-surface-low px-4 py-3">
        <div className="font-body text-[13px] text-merris-text">{message.question}</div>
      </MerrisCard>

      {/* Merris header row */}
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-merris-primary font-display text-[11px] font-bold text-white">
          M
        </div>
        <span className="font-display text-[13px] font-semibold text-merris-text">Merris</span>
        {message.evaluation && (
          <Pill variant={confidenceVariant} size="sm">
            {message.evaluation.confidence} confidence
          </Pill>
        )}
        {message.evaluation && (
          <span className="ml-auto">
            <ScoreRing score={message.evaluation.score} size={32} />
          </span>
        )}
      </div>

      {/* Response card */}
      <MerrisCard
        className="p-5"
        style={{ borderLeft: `3px solid ${merrisTokens.primaryLight}` }}
      >
        <MarkdownText text={message.answer} />

        {message.citations.length > 0 && (
          <>
            <div className="mt-3 font-body text-[11px] text-merris-text-tertiary">
              {message.citations.length} source{message.citations.length === 1 ? '' : 's'} cited
            </div>
            <CitationsList citations={message.citations} />
          </>
        )}
      </MerrisCard>
    </div>
  );
}
