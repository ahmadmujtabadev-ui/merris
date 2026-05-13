'use client';

import { useState, KeyboardEvent, useRef } from 'react';
import { useChatStore } from '@/lib/chat-store';

export function ChatInput() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startQuery = useChatStore((s) => s.startQuery);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    void startQuery(trimmed);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 300) + 'px';
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
      {/* Textarea */}
      <div className="px-5 pt-5 pb-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={onKey}
          placeholder="Ask Merris anything. Type @ to add a source, # to add an entity, or paste a passage to extract…"
          rows={5}
          className="w-full resize-none bg-transparent font-body text-[14px] leading-relaxed text-merris-text outline-none placeholder:text-merris-text-tertiary"
          style={{ minHeight: 120 }}
        />
      </div>

      {/* Bottom bar — send only */}
      <div className="flex items-center justify-end gap-3 border-t border-merris-border px-5 py-3">
        <span className="font-body text-[10px] text-merris-text-tertiary">
          <kbd className="rounded border border-merris-border px-1 py-0.5 font-mono text-[9px]">⌘</kbd>
          <kbd className="ml-0.5 rounded border border-merris-border px-1 py-0.5 font-mono text-[9px]">↵</kbd>
          <span className="ml-1">to send</span>
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          className="flex items-center gap-2 rounded-xl bg-merris-primary px-5 py-2.5 font-display text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-40"
        >
          Ask Merris
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>
      </div>
    </div>
  );
}
