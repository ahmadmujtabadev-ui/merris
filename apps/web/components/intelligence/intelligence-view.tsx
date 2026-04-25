'use client';

import { useChatStore } from '@/lib/chat-store';
import { IntelligenceHero } from './intelligence-hero';
import { ThinkingState } from './thinking-state';
import { WorkingHeader } from './working-header';
import { AdvisoryResponse } from './advisory-response';
import { RefusalResponse } from './refusal-response';
import { ConversationMessage } from './conversation-message';
import { FollowUpInput } from './follow-up-input';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';

export function IntelligenceView() {
  const phase = useChatStore((s) => s.phase);
  const question = useChatStore((s) => s.question);
  const evaluation = useChatStore((s) => s.evaluation);
  const errorMessage = useChatStore((s) => s.errorMessage);
  const messages = useChatStore((s) => s.messages);
  const reset = useChatStore((s) => s.reset);
  const clearConversation = useChatStore((s) => s.clearConversation);

  // Empty state: hero
  if (phase === 'home' && messages.length === 0) {
    return <IntelligenceHero />;
  }

  return (
    <div className="w-full px-8 py-9">
      {messages.length > 0 && (
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </span>
          <button
            type="button"
            onClick={clearConversation}
            className="font-body text-[11px] text-merris-text-tertiary hover:text-merris-error"
          >
            Clear conversation
          </button>
        </div>
      )}

      {messages.map((m) => (
        <ConversationMessage key={m.id} message={m} />
      ))}

      {phase === 'thinking' && (
        <>
          <MerrisCard className="mb-5 bg-merris-surface-low px-4 py-3">
            <div className="font-body text-[13px] text-merris-text">{question}</div>
          </MerrisCard>
          <WorkingHeader />
          <ThinkingState />
        </>
      )}

      {phase === 'response' && (
        <>
          {/* Show the in-progress exchange if it hasn't been pushed to messages yet
              (errorMessage path doesn't push, so it shows here) */}
          {errorMessage && (
            <>
              <MerrisCard className="mb-5 bg-merris-surface-low px-4 py-3">
                <div className="font-body text-[13px] text-merris-text">{question}</div>
              </MerrisCard>
              {evaluation?.decision === 'BLOCK' ? <RefusalResponse /> : (
                <MerrisCard className="border-l-[3px] border-merris-error p-5 font-body text-[13px] text-merris-error">
                  <div className="mb-2 font-display font-bold">Stream error</div>
                  <div>{errorMessage}</div>
                </MerrisCard>
              )}
            </>
          )}
        </>
      )}

      <FollowUpInput />

      {phase === 'response' && messages.length === 0 && !errorMessage && (
        <div className="mt-6 text-center">
          <MerrisButton variant="secondary" onClick={reset}>
            Back to home
          </MerrisButton>
        </div>
      )}
    </div>
  );
}
