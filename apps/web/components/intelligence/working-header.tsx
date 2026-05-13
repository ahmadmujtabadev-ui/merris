'use client';

import { useChatStore } from '@/lib/chat-store';

export function WorkingHeader() {
  const tokenText = useChatStore((s) => s.tokenText);
  const isStreaming = tokenText.length > 0;

  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-merris-primary font-display text-[12px] font-bold text-white">
        M
        {!isStreaming && (
          <span className="absolute -right-[3px] -top-[3px] h-2 w-2 rounded-full border-2 border-[#f5f3ef] bg-emerald-400 animate-pulse" />
        )}
      </div>
      <div>
        <span className="font-display text-[14px] font-bold text-merris-text">
          {isStreaming ? 'Merris' : 'Merris is working…'}
        </span>
        {!isStreaming && (
          <div className="mt-0.5 font-body text-[10px] text-merris-text-tertiary">
            Reasoning through your question
          </div>
        )}
      </div>
    </div>
  );
}
