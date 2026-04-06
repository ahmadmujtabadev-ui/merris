'use client';

import { useState, KeyboardEvent } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { useChatStore } from '@/lib/chat-store';
import { merrisTokens } from '@/lib/design-tokens';

export function FollowUpInput() {
  const [text, setText] = useState('');
  const startQuery = useChatStore((s) => s.startQuery);
  const phase = useChatStore((s) => s.phase);
  const disabled = phase === 'thinking';

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText('');
    void startQuery(trimmed);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <MerrisCard className="mt-6 p-0">
      <div className="px-4 py-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={disabled ? 'Working…' : 'Ask a follow-up question'}
          disabled={disabled}
          className="min-h-[44px] w-full resize-none bg-transparent font-body text-[13px] text-merris-text outline-none disabled:opacity-50"
        />
      </div>
      <div
        className="flex items-center justify-end px-4 py-2"
        style={{ borderTop: `1px solid ${merrisTokens.border}` }}
      >
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || disabled}
          className="flex h-8 w-8 items-center justify-center rounded-merris-sm bg-merris-primary text-white disabled:opacity-40"
          aria-label="Send"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4z" />
          </svg>
        </button>
      </div>
    </MerrisCard>
  );
}
