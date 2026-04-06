'use client';

import { useChatStore } from '@/lib/chat-store';
import { IntelligenceHero } from './intelligence-hero';
import { ThinkingState } from './thinking-state';
import { WorkingHeader } from './working-header';
import { AdvisoryResponse } from './advisory-response';
import { RefusalResponse } from './refusal-response';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';

export function IntelligenceView() {
  const phase = useChatStore((s) => s.phase);
  const question = useChatStore((s) => s.question);
  const evaluation = useChatStore((s) => s.evaluation);
  const errorMessage = useChatStore((s) => s.errorMessage);
  const reset = useChatStore((s) => s.reset);

  if (phase === 'home') {
    return <IntelligenceHero />;
  }

  return (
    <div className="mx-auto max-w-[760px] px-5 py-9">
      <MerrisCard className="mb-5 bg-merris-surface-low px-4 py-3">
        <div className="font-body text-[13px] text-merris-text">{question}</div>
      </MerrisCard>

      {phase === 'thinking' && (
        <>
          <WorkingHeader />
          <ThinkingState />
        </>
      )}

      {phase === 'response' && (
        <>
          {errorMessage ? (
            <MerrisCard className="border-l-[3px] border-merris-error p-5 font-body text-[13px] text-merris-error">
              <div className="mb-2 font-display font-bold">Stream error</div>
              <div>{errorMessage}</div>
            </MerrisCard>
          ) : evaluation?.decision === 'BLOCK' ? (
            <RefusalResponse />
          ) : (
            <AdvisoryResponse />
          )}

          <div className="mt-6 text-center">
            <MerrisButton variant="secondary" onClick={reset}>
              Ask another question
            </MerrisButton>
          </div>
        </>
      )}
    </div>
  );
}
