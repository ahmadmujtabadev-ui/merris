'use client';

import { useEffect } from 'react';
import { JurisdictionChips } from './jurisdiction-chips';
import { SourceToggles } from './source-toggles';
import { ChatInput } from './chat-input';
import { useChatStore } from '@/lib/chat-store';

export function IntelligenceHero() {
  const pendingQuestion = useChatStore((s) => s.pendingQuestion);
  const setPendingQuestion = useChatStore((s) => s.setPendingQuestion);
  const startQuery = useChatStore((s) => s.startQuery);

  useEffect(() => {
    if (pendingQuestion) {
      setPendingQuestion(null);
      void startQuery(pendingQuestion);
    }
  }, [pendingQuestion, setPendingQuestion, startQuery]);

  return (
    <div className="w-full px-8 py-11">
      <h1 className="font-display text-[34px] font-extrabold leading-[1.15] text-merris-text">
        Where sustainability meets <span className="text-merris-primary">precision</span>
      </h1>
      <p className="mt-2 mb-8 font-body text-[14px] text-merris-text-secondary">
        Analyze, validate, and report with institutional-grade ESG intelligence.
      </p>

      <div className="mb-2">
        <JurisdictionChips />
      </div>
      <div className="mb-6">
        <SourceToggles />
      </div>

      <ChatInput />

      <div className="mt-7 flex gap-5 font-body text-[10px] text-merris-text-tertiary">
        <span>● High Performance</span>
        <span className="text-merris-primary">● Private Cloud</span>
        <span className="text-merris-primary">● ESG Validated</span>
      </div>
    </div>
  );
}
