'use client';

import { useState, KeyboardEvent } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { useChatStore } from '@/lib/chat-store';
import { merrisTokens } from '@/lib/design-tokens';

export function ChatInput() {
  const [text, setText] = useState('');
  const startQuery = useChatStore((s) => s.startQuery);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
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
    <MerrisCard className="p-0 text-left">
      <div
        className="flex gap-3 px-4 py-2.5"
        style={{ borderBottom: `1px solid ${merrisTokens.border}` }}
      >
        <span className="font-body text-[11px] text-merris-text-secondary">Engagement ▾</span>
        <span className="font-body text-[11px] text-merris-text-secondary">Prompts ▾</span>
      </div>
      <div className="px-4 py-3.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask Merris anything. Type @ to add sources."
          className="min-h-[60px] w-full resize-none bg-transparent font-body text-[13px] text-merris-text outline-none"
        />
      </div>
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderTop: `1px solid ${merrisTokens.border}` }}
      >
        <div className="flex gap-2 text-merris-text-tertiary">
          <span className="text-[14px]">📎</span>
          <span className="text-[14px]">🔖</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-merris-text-tertiary">🎤</span>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-merris-sm bg-merris-primary text-white disabled:opacity-40"
            aria-label="Send"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4z" />
            </svg>
          </button>
        </div>
      </div>
    </MerrisCard>
  );
}
