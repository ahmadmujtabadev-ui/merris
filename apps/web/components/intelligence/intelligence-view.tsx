'use client';

import { useChatStore } from '@/lib/chat-store';
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
  const reset = useChatStore((s) => s.reset);
  const clearConversation = useChatStore((s) => s.clearConversation);

  if (phase === 'home' && messages.length === 0) {
    return <IntelligenceHero />;
  }

  const firstMsg = messages[0];
  const msgCount = messages.length + (phase !== 'home' ? 1 : 0);
  const startTime = firstMsg?.timestamp ?? Date.now();

  const jCodes = jurisdiction.map(j => ({ Qatar: 'QA', Oman: 'OM', UAE: 'AE', Saudi: 'SA', EU: 'EU', UK: 'UK' }[j] ?? j));
  const kScope = knowledgeSources.join('+K').replace('K', '').startsWith('+') ? knowledgeSources.join('+') : knowledgeSources.join('+');

  return (
    <div className="min-h-screen bg-[#f5f3ef] pb-28">
      {/* ── Conversation meta bar ── */}
      <div
        className="sticky top-[44px] z-10 flex items-center gap-4 bg-[#f5f3ef] px-8 py-3"
        style={{ borderBottom: '1px solid rgba(0,107,95,0.08)' }}
      >
        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-merris-border bg-white">
          <div className="h-1.5 w-1.5 rounded-full bg-merris-text-tertiary" />
        </div>
        <span className="font-display text-[13px] font-semibold text-merris-text truncate max-w-xs">
          {firstMsg?.question?.slice(0, 50) ?? question.slice(0, 50) ?? 'New conversation'}
          {((firstMsg?.question ?? question)?.length ?? 0) > 50 ? '…' : ''}
        </span>
        <div className="h-3 w-px bg-merris-border" />
        <span className="font-body text-[11px] text-merris-text-tertiary">
          · {msgCount} of {msgCount} messages
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

      <div className="mx-auto max-w-[1100px] px-8 py-8">
        {/* Past conversation messages */}
        {messages.map((m) => (
          <ConversationMessage key={m.id} message={m} />
        ))}

        {/* Active query — while thinking or streaming */}
        {phase === 'thinking' && (
          <>
            {/* Current user question card */}
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

            {/* Thinking steps panel */}
            <ThinkingState />

            {/* Streaming answer — appears as first token arrives */}
            {tokenText.length > 0 && (
              <div className="mt-5">
                <AdvisoryResponse />
              </div>
            )}
          </>
        )}

        {/* Error / refusal state */}
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

        {/* Completed response — shown after last message when no more thinking */}
        {phase === 'response' && messages.length === 0 && !errorMessage && (
          <div className="mt-5">
            <AdvisoryResponse />
          </div>
        )}

        {/* Back to home (edge case) */}
        {phase === 'response' && messages.length === 0 && !errorMessage && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl border border-merris-border bg-white px-5 py-2.5 font-display text-[12px] font-semibold text-merris-text-secondary shadow-sm hover:border-merris-primary hover:text-merris-primary"
            >
              ← New analysis
            </button>
          </div>
        )}
      </div>

      {/* Sticky follow-up input */}
      <FollowUpInput />
    </div>
  );
}
