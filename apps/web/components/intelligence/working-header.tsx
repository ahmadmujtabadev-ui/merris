'use client';

import { useChatStore } from '@/lib/chat-store';

export function WorkingHeader() {
  const tokenText = useChatStore((s) => s.tokenText);
  const isStreaming = tokenText.length > 0;

  return (
    <div className="mb-4 flex items-center gap-2.5">
      <div className="relative flex h-[28px] w-[28px] items-center justify-center rounded-full bg-merris-primary font-display text-[11px] font-bold text-white">
        M
        {!isStreaming && (
          <span className="absolute -right-[3px] -top-[3px] h-[8px] w-[8px] rounded-full border-2 border-merris-bg bg-merris-primary-light animate-pulse-soft" />
        )}
      </div>
      <span className="font-display text-[13px] font-semibold text-merris-text">
        {isStreaming ? 'Merris' : 'Merris is working…'}
      </span>
    </div>
  );
}
