'use client';

import { useState, useEffect } from 'react';
import { useChatStore } from '@/lib/chat-store';
import { useHistoryStore } from '@/lib/store';
import { IntelligenceHero } from './intelligence-hero';
import { ThinkingState } from './thinking-state';
import { AdvisoryResponse } from './advisory-response';
import { RefusalResponse } from './refusal-response';
import { ConversationMessage } from './conversation-message';
import { FollowUpInput } from './follow-up-input';

function relTime(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function relTimeStr(ts?: string): string {
  if (!ts) return '';
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

function TagChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-merris-primary-bg px-2.5 py-0.5 font-body text-[10px] font-semibold text-merris-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-merris-primary" />
      {children}
    </span>
  );
}

export function IntelligenceView() {
  const phase = useChatStore((s) => s.phase);
  const question = useChatStore((s) => s.question);
  const evaluation = useChatStore((s) => s.evaluation);
  const errorMessage = useChatStore((s) => s.errorMessage);
  const messages = useChatStore((s) => s.messages);
  const tokenText = useChatStore((s) => s.tokenText);
  const jurisdiction = useChatStore((s) => s.jurisdiction);
  const knowledgeSources = useChatStore((s) => s.knowledgeSources);
  const clearConversation = useChatStore((s) => s.clearConversation);
  const setPendingQuestion = useChatStore((s) => s.setPendingQuestion);
  const startQuery = useChatStore((s) => s.startQuery);

  const { entries, fetchHistory } = useHistoryStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historySearch, setHistorySearch] = useState('');

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  if (phase === 'home' && messages.length === 0) {
    return <IntelligenceHero />;
  }

  const firstMsg = messages[0];
  const msgCount = messages.length + (phase !== 'home' ? 1 : 0);
  const startTime = firstMsg?.timestamp ?? Date.now();

  const jCodes = jurisdiction.map(j => ({ Qatar: 'QA', Oman: 'OM', UAE: 'AE', Saudi: 'SA', EU: 'EU', UK: 'UK' }[j] ?? j));
  const kScope = knowledgeSources.join('+');

  const filteredHistory = historySearch.trim()
    ? entries.filter(e => e.text.toLowerCase().includes(historySearch.toLowerCase()))
    : entries;

  return (
    <div className="flex h-[calc(100vh-44px)] bg-[#f5f3ef]">

      {/* ── History sidebar ── */}
      {sidebarOpen ? (
        <div className="flex w-[260px] shrink-0 flex-col border-r border-merris-border bg-white">
          {/* Sidebar header */}
          <div className="flex items-center justify-between border-b border-merris-border px-4 py-3">
            <div>
              <p className="font-display text-[13px] font-bold text-merris-text">History</p>
              <p className="font-body text-[10px] text-merris-text-tertiary">{entries.length} conversation{entries.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text"
              title="Collapse"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          </div>

          {/* New analysis button */}
          <div className="border-b border-merris-border px-3 py-2.5">
            <button
              type="button"
              onClick={clearConversation}
              className="flex w-full items-center gap-2 rounded-lg bg-merris-primary px-3 py-2 font-display text-[12px] font-bold text-white hover:opacity-90"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              New analysis
            </button>
          </div>

          {/* Search */}
          <div className="border-b border-merris-border px-3 py-2">
            <div className="flex items-center gap-2 rounded-md border border-merris-border bg-[#f5f3ef] px-2.5 py-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-merris-text-tertiary">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Search…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="flex-1 bg-transparent font-body text-[11px] text-merris-text outline-none placeholder:text-merris-text-tertiary"
              />
            </div>
          </div>

          {/* History list */}
          <div className="flex-1 overflow-y-auto">
            {filteredHistory.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="font-body text-[11px] text-merris-text-tertiary">
                  {historySearch ? 'No matches' : 'No previous conversations'}
                </p>
              </div>
            )}
            {filteredHistory.map((entry) => {
              const isCurrent = entry.text === (firstMsg?.question ?? question);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => void startQuery(entry.text)}
                  className={`group w-full border-b border-merris-border px-4 py-3 text-left transition-colors ${
                    isCurrent ? 'bg-merris-primary-bg' : 'hover:bg-[#f5f3ef]'
                  }`}
                >
                  <p className={`line-clamp-2 font-body text-[11px] leading-snug ${isCurrent ? 'font-semibold text-merris-primary' : 'text-merris-text'}`}>
                    {entry.text}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="font-body text-[9px] text-merris-text-tertiary">{relTimeStr(entry.timestamp)}</span>
                    {entry.toolsUsed && entry.toolsUsed.length > 0 && (
                      <span className="font-body text-[9px] text-merris-text-tertiary">· {entry.toolsUsed.length} tools</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Collapsed sidebar toggle */
        <div className="flex w-10 shrink-0 flex-col items-center border-r border-merris-border bg-white py-3 gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text"
            title="Show history"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <button
            type="button"
            onClick={clearConversation}
            className="flex h-7 w-7 items-center justify-center rounded-md text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-primary"
            title="New analysis"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      )}

      {/* ── Main conversation area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Meta bar */}
        <div
          className="sticky top-0 z-10 flex items-center gap-3 bg-[#f5f3ef] px-6 py-3"
          style={{ borderBottom: '1px solid rgba(0,107,95,0.08)' }}
        >
          {/* Back button */}
          <button
            type="button"
            onClick={clearConversation}
            className="flex items-center gap-1.5 rounded-lg border border-merris-border bg-white px-3 py-1.5 font-body text-[11px] font-semibold text-merris-text-secondary shadow-sm hover:border-merris-primary hover:text-merris-primary"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back
          </button>

          <div className="h-3 w-px bg-merris-border" />

          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-merris-border bg-white">
            <div className="h-1.5 w-1.5 rounded-full bg-merris-text-tertiary" />
          </div>
          <span className="font-display text-[13px] font-semibold text-merris-text truncate max-w-[320px]">
            {firstMsg?.question?.slice(0, 60) ?? question.slice(0, 60) ?? 'New conversation'}
            {((firstMsg?.question ?? question)?.length ?? 0) > 60 ? '…' : ''}
          </span>
          <div className="h-3 w-px bg-merris-border" />
          <span className="font-body text-[11px] text-merris-text-tertiary">
            {msgCount} of {msgCount} messages
          </span>
          <div className="h-3 w-px bg-merris-border" />
          <span className="font-body text-[11px] text-merris-text-tertiary">
            Started {new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {relTime(startTime)}
          </span>
          <button
            type="button"
            onClick={clearConversation}
            className="ml-auto font-body text-[11px] font-semibold text-merris-error hover:underline"
          >
            Clear conversation
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-28">
          <div className="mx-auto max-w-[860px] px-6 py-6">
            {/* Past conversation messages */}
            {messages.map((m) => (
              <ConversationMessage key={m.id} message={m} />
            ))}

            {/* Active query — while thinking or streaming */}
            {phase === 'thinking' && (
              <>
                <div className="mb-5 overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-merris-border px-5 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-merris-primary font-display text-[10px] font-bold text-white">
                      MU
                    </div>
                    <span className="font-body text-[11px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
                      Mujtaba · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="px-6 py-5">
                    <p className="font-display text-[16px] font-semibold leading-snug text-merris-text">{question}</p>
                  </div>
                  <div className="flex items-center gap-2 border-t border-merris-border px-5 py-2.5">
                    {jCodes.map(j => <TagChip key={j}>{j}</TagChip>)}
                    {kScope && <TagChip>{kScope}</TagChip>}
                    <span className="ml-auto font-body text-[10px] text-merris-text-tertiary">
                      {question.split(' ').length * 1.3 | 0} tokens
                    </span>
                  </div>
                </div>

                <ThinkingState />

                {tokenText.length > 0 && (
                  <div className="mt-5">
                    <AdvisoryResponse />
                  </div>
                )}
              </>
            )}

            {/* Error / refusal */}
            {phase === 'response' && errorMessage && (
              <>
                <div className="mb-5 overflow-hidden rounded-2xl border border-merris-border bg-white px-6 py-5 shadow-sm">
                  <p className="font-display text-[16px] font-semibold text-merris-text">{question}</p>
                </div>
                {evaluation?.decision === 'BLOCK' ? (
                  <RefusalResponse />
                ) : (
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
                    <div className="mb-1 font-display text-[13px] font-bold text-merris-error">Stream error</div>
                    <div className="font-body text-[12px] text-merris-error">{errorMessage}</div>
                  </div>
                )}
              </>
            )}

            {/* Completed response */}
            {phase === 'response' && messages.length === 0 && !errorMessage && (
              <div className="mt-5">
                <AdvisoryResponse />
              </div>
            )}
          </div>
        </div>

        {/* Sticky follow-up input */}
        <FollowUpInput />
      </div>
    </div>
  );
}
