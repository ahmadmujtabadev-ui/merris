'use client';

import { useState, KeyboardEvent } from 'react';
import { useChatStore } from '@/lib/chat-store';

export function FollowUpInput() {
  const [text, setText] = useState('');
  const startQuery = useChatStore((s) => s.startQuery);
  const phase = useChatStore((s) => s.phase);
  const messages = useChatStore((s) => s.messages);
  const jurisdiction = useChatStore((s) => s.jurisdiction);
  const knowledgeSources = useChatStore((s) => s.knowledgeSources);
  const disabled = phase === 'thinking';

  if (phase === 'home' && messages.length === 0) return null;

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

  const jCodes = jurisdiction.map(j => ({ Qatar: 'QA', Oman: 'OM', UAE: 'AE', Saudi: 'SA', EU: 'EU', UK: 'UK' }[j] ?? j));
  const kCodes = knowledgeSources.join('+');
  const scopeLabel = [...jCodes, ...(kCodes ? [kCodes] : [])].join(' · ');

  return (
    <div className="sticky bottom-0 z-20 border-t border-merris-border bg-[#f5f3ef] px-8 py-4">
      <div className="mx-auto max-w-[1100px]">
        {/* Follow-up suggestions (shown above the input when we have them) */}
        <div className="overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Scope context */}
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-merris-primary-bg px-2.5 py-1 font-body text-[10px] font-semibold text-merris-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-merris-primary" />
                {scopeLabel || 'No filters'}
              </span>
            </div>

            {/* Textarea */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              placeholder={disabled ? 'Merris is working…' : 'Ask a follow-up. Type @ to pin a source, # to add an entity…'}
              disabled={disabled}
              rows={1}
              className="min-h-[28px] flex-1 resize-none bg-transparent font-body text-[13px] leading-relaxed text-merris-text outline-none placeholder:text-merris-text-tertiary disabled:opacity-50"
              style={{ maxHeight: 100 }}
            />

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                title="Attach source"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              </button>
              <button
                type="button"
                title="Browse prompts"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!text.trim() || disabled}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-merris-primary text-white shadow-sm disabled:opacity-40 hover:opacity-90"
                aria-label="Send"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
