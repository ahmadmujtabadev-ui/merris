'use client';

import { useState, KeyboardEvent, useRef } from 'react';
import { useChatStore } from '@/lib/chat-store';

const PROMPT_TYPES = ['Advisory memo', 'Regulatory summary', 'Peer comparison', 'Risk briefing', 'Gap analysis'] as const;
const OUTPUT_TYPES = ['Structured', 'Narrative', 'Table', 'Bullet points'] as const;

export function ChatInput() {
  const [text, setText] = useState('');
  const [promptType, setPromptType] = useState<string>('Advisory memo');
  const [outputType, setOutputType] = useState<string>('Structured');
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [showOutputMenu, setShowOutputMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-expand
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
      {/* Top meta row */}
      <div className="flex items-center gap-4 border-b border-merris-border px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Engagement</span>
          <button className="flex items-center gap-1 font-body text-[11px] font-medium text-merris-text hover:text-merris-primary">
            Not selected
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <div className="h-3 w-px bg-merris-border" />
        <div className="relative flex items-center gap-1.5">
          <span className="font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Prompt</span>
          <button
            onClick={() => { setShowPromptMenu(v => !v); setShowOutputMenu(false); }}
            className="flex items-center gap-1 font-body text-[11px] font-medium text-merris-text hover:text-merris-primary"
          >
            {promptType}
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {showPromptMenu && (
            <div className="absolute left-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-merris-border bg-white shadow-lg">
              {PROMPT_TYPES.map(p => (
                <button key={p} onClick={() => { setPromptType(p); setShowPromptMenu(false); }}
                  className={`block w-full px-3 py-1.5 text-left font-body text-[11px] hover:bg-merris-surface-low ${p === promptType ? 'text-merris-primary font-semibold' : 'text-merris-text'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="h-3 w-px bg-merris-border" />
        <div className="relative flex items-center gap-1.5">
          <span className="font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Output</span>
          <button
            onClick={() => { setShowOutputMenu(v => !v); setShowPromptMenu(false); }}
            className="flex items-center gap-1 font-body text-[11px] font-medium text-merris-text hover:text-merris-primary"
          >
            {outputType}
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {showOutputMenu && (
            <div className="absolute left-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-merris-border bg-white shadow-lg">
              {OUTPUT_TYPES.map(o => (
                <button key={o} onClick={() => { setOutputType(o); setShowOutputMenu(false); }}
                  className={`block w-full px-3 py-1.5 text-left font-body text-[11px] hover:bg-merris-surface-low ${o === outputType ? 'text-merris-primary font-semibold' : 'text-merris-text'}`}>
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Textarea */}
      <div className="px-4 py-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={onKey}
          placeholder="Ask Merris anything. Type @ to add a source, # to add an entity, or paste a passage to extract…"
          rows={3}
          className="w-full resize-none bg-transparent font-body text-[13px] leading-relaxed text-merris-text outline-none placeholder:text-merris-text-tertiary"
          style={{ minHeight: 72 }}
        />
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center gap-2 border-t border-merris-border px-4 py-2.5">
        {/* Toolbar actions */}
        {[
          { label: 'Attach', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg> },
          { label: 'Quote-only', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg> },
          { label: 'Table', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg> },
          { label: 'Frameworks', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
        ].map(({ label, icon }) => (
          <button
            key={label}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-[11px] text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text"
          >
            {icon}
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <span className="font-body text-[10px] text-merris-text-tertiary">
            <kbd className="rounded border border-merris-border px-1 py-0.5 font-mono text-[9px]">⌘</kbd>
            <kbd className="ml-0.5 rounded border border-merris-border px-1 py-0.5 font-mono text-[9px]">↵</kbd>
            <span className="ml-1">to send</span>
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            className="flex items-center gap-2 rounded-xl bg-merris-primary px-4 py-2 font-display text-[12px] font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-40"
          >
            Ask Merris
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
