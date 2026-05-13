'use client';

import { Pill } from '@/components/merris/pill';
import { ScoreRing } from '@/components/merris/score-ring';
import { CitationsList } from './citations-list';
import { MarkdownText } from './markdown-text';
import type { ChatMessage } from '@/lib/chat-store';

const K_COLORS: Record<string, string> = {
  K1: 'bg-[#e0f2fe] text-[#0369a1]',
  K2: 'bg-[#f0fdf4] text-[#15803d]',
  K3: 'bg-[#f5f3ff] text-[#7c3aed]',
  K4: 'bg-[#fef3c7] text-[#b45309]',
  K5: 'bg-[#f0fdfa] text-[#0f766e]',
  K6: 'bg-[#dcfce7] text-[#15803d]',
  K7: 'bg-[#fdf2f8] text-[#be185d]',
};

function TagChip({ label }: { label: string }) {
  const kMatch = label.match(/^(K\d)/)?.[1];
  const cls = kMatch ? (K_COLORS[kMatch] ?? '') : 'bg-merris-surface-low text-merris-text-secondary';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[9px] font-semibold ${cls}`}>
      <span className="h-1 w-1 rounded-full bg-current opacity-60" />
      {label}
    </span>
  );
}

export function ConversationMessage({ message }: { message: ChatMessage }) {
  const confidenceVariant: 'completed' | 'in-progress' | 'draft' =
    message.evaluation?.confidence === 'high'
      ? 'completed'
      : message.evaluation?.confidence === 'medium'
        ? 'in-progress'
        : 'draft';

  const ts = new Date(message.timestamp);
  const timeLabel = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="mb-8">
      {/* ── User question card ── */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-merris-border px-5 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-merris-primary font-display text-[10px] font-bold text-white">
            MU
          </div>
          <span className="font-body text-[11px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
            Mujtaba · {timeLabel}
          </span>
        </div>

        {/* Question text */}
        <div className="px-6 py-5">
          <p className="font-display text-[16px] font-semibold leading-snug text-merris-text">
            {message.question}
          </p>
        </div>

        {/* Tags + meta */}
        <div className="flex items-center gap-2 border-t border-merris-border px-5 py-2.5">
          {['QA', 'AE', 'SA', 'Banking', 'K1 · K3 · K6'].map(tag => (
            <TagChip key={tag} label={tag} />
          ))}
          <span className="ml-auto font-body text-[10px] text-merris-text-tertiary">
            {message.question.split(' ').length * 1.3 | 0} tokens · scope ≈ 4,318 chunks
          </span>
        </div>
      </div>

      {/* ── Merris response card ── */}
      <div className="overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
        {/* Card header */}
        <div className="flex items-center gap-3 border-b border-merris-border px-5 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-merris-primary font-display text-[12px] font-bold text-white">
            M
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-[14px] font-bold text-merris-text">Merris</span>
              {message.evaluation && (
                <Pill variant={confidenceVariant} size="sm">
                  {message.evaluation.confidence} confidence
                </Pill>
              )}
            </div>
            <div className="font-body text-[10px] text-merris-text-tertiary">
              Advisory note · generated {timeLabel}
            </div>
          </div>
          {message.citations.length > 0 && (
            <span className="font-body text-[11px] text-merris-text-tertiary">
              <span className="font-semibold text-merris-text">{message.citations.length}</span> sources
            </span>
          )}
          {message.evaluation && (
            <ScoreRing score={message.evaluation.score} size={36} />
          )}
        </div>

        {/* Body */}
        <div className="border-l-4 border-merris-primary px-6 py-6">
          <MarkdownText text={message.answer} />
          {message.citations.length > 0 && (
            <CitationsList citations={message.citations} />
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-1 border-t border-merris-border px-5 py-2.5">
          {[
            { label: 'Copy', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> },
            { label: 'Export', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
            { label: 'Insert into memo', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
            { label: 'Regenerate', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> },
          ].map(({ label, icon }) => (
            <button key={label} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-[11px] text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text">
              {icon} {label}
            </button>
          ))}
          <div className="mx-2 h-4 w-px bg-merris-border" />
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-merris-text-tertiary hover:bg-merris-surface-low hover:text-emerald-600">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-merris-text-tertiary hover:bg-merris-surface-low hover:text-red-500">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
          </button>
          <div className="ml-auto font-body text-[9px] text-merris-text-tertiary">
            Claude Sonnet 4 · 200k · auditable
          </div>
        </div>
      </div>
    </div>
  );
}
