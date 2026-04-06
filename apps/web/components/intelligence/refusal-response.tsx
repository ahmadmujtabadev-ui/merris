'use client';

import { MerrisCard } from '@/components/merris/card';
import { useChatStore } from '@/lib/chat-store';

export function RefusalResponse() {
  const tokenText = useChatStore((s) => s.tokenText);

  return (
    <MerrisCard
      className="border-l-[3px] border-merris-error p-5"
    >
      <div className="mb-2 flex items-center gap-2 font-display text-[14px] font-bold text-merris-error">
        🛡️ Cannot Comply
      </div>
      <p className="mb-3 whitespace-pre-wrap font-body text-[13px] leading-[1.7] text-merris-text">
        {tokenText}
      </p>
      <div className="mt-3 border-t border-merris-border pt-3 font-body text-[11px] text-merris-text-secondary">
        This response was suppressed by Merris's evaluator because it would have produced an indefensible claim. Try rephrasing your question.
      </div>
    </MerrisCard>
  );
}
