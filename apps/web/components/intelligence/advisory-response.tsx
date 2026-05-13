'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Pill } from '@/components/merris/pill';
import { ScoreRing } from '@/components/merris/score-ring';
import { useChatStore } from '@/lib/chat-store';
import { CitationsList } from './citations-list';
import { MarkdownText } from './markdown-text';

function generateFollowUps(question: string): string[] {
  const q = question.toLowerCase();
  const banking = q.includes('bank') || q.includes('financ') || q.includes('credit') || q.includes('loan');
  const esg = q.includes('esg') || q.includes('sustainab') || q.includes('carbon') || q.includes('climate');
  const reg = q.includes('regulat') || q.includes('compliance') || q.includes('cbq') || q.includes('qcb') || q.includes('cbuae');
  const risk = q.includes('risk') || q.includes('capital') || q.includes('basel') || q.includes('provisio');
  const compare = q.includes('compar') || q.includes('vs') || q.includes('differ') || q.includes('benchmark');

  if (banking && reg) return [
    'How does QCB guidance differ from CBUAE on this topic?',
    'Build a comparison table of requirements across GCC regulators',
    'What are the enforcement timelines and penalties for non-compliance?',
    'Which peer banks have disclosed similar approaches?',
  ];
  if (esg) return [
    'Compare Scope 3 methodologies across regional peers',
    'What TCFD disclosures are required for this jurisdiction?',
    'Generate a gap analysis against CSRD requirements',
    'Which frameworks mandate third-party assurance for these metrics?',
  ];
  if (risk) return [
    'What Basel IV changes affect this capital treatment?',
    'How should provisioning be staged under IFRS 9?',
    'Show stress-test scenarios relevant to this exposure',
    'Compare credit risk approaches across GCC banking frameworks',
  ];
  if (compare) return [
    'Expand this into a full peer comparison matrix',
    'Which peer has the strongest position and why?',
    'What are the key divergence points at the paragraph level?',
    'Export these findings as a structured advisory memo',
  ];
  return [
    'Expand this analysis with supporting regulatory citations',
    'What are the key risks and mitigants in this area?',
    'How do peers in the GCC approach this differently?',
    'Generate a structured memo summarising these findings',
  ];
}

function fmtTime(ms: number): string {
  return (ms / 1000).toFixed(1) + 's';
}

const OUTPUT_LABEL: Record<string, string> = {
  'Advisory memo':       'Advisory note',
  'Regulatory summary':  'Regulatory summary',
  'Peer comparison':     'Peer comparison',
  'Risk briefing':       'Risk briefing',
  'Gap analysis':        'Gap analysis',
};

export function AdvisoryResponse() {
  const tokenText = useChatStore((s) => s.tokenText);
  const citations = useChatStore((s) => s.citations);
  const evaluation = useChatStore((s) => s.evaluation);
  const phase = useChatStore((s) => s.phase);
  const jurisdiction = useChatStore((s) => s.jurisdiction);
  const question = useChatStore((s) => s.question);
  const startQuery = useChatStore((s) => s.startQuery);

  const isStreaming = phase === 'thinking';
  const followUps = useMemo(() => generateFollowUps(question), [question]);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const startRef = useRef(Date.now());
  const startedRef = useRef(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tokenText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([`# Merris Advisory Response\n\n**Question:** ${question}\n\n---\n\n${tokenText}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merris-response-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = () => {
    void startQuery(question);
  };

  useEffect(() => {
    if (tokenText.length > 0 && !startedRef.current) {
      startedRef.current = true;
      startRef.current = Date.now();
    }
    if (!isStreaming) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => clearInterval(t);
  }, [tokenText, isStreaming]);

  const confidenceVariant: 'completed' | 'in-progress' | 'draft' =
    evaluation?.confidence === 'high'
      ? 'completed'
      : evaluation?.confidence === 'medium'
        ? 'in-progress'
        : 'draft';

  const now = new Date();
  const timeLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const jCodes = jurisdiction.map(j => ({ Qatar: 'QA', Oman: 'OM', UAE: 'AE', Saudi: 'SA', EU: 'EU', UK: 'UK' }[j] ?? j));

  return (
    <div className="animate-slide-in">
      <div className="overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
        {/* ── Response card header ── */}
        <div className="flex items-center gap-3 border-b border-merris-border px-5 py-3.5">
          {/* M avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-merris-primary font-display text-[12px] font-bold text-white">
            M
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-[14px] font-bold text-merris-text">Merris</span>
              {evaluation && (
                <Pill variant={confidenceVariant} size="sm">
                  {evaluation.confidence} confidence
                </Pill>
              )}
            </div>
            <div className="flex items-center gap-1.5 font-body text-[10px] text-merris-text-tertiary">
              <span>Advisory note</span>
              {jCodes.map(j => (
                <span key={j}>· {j}</span>
              ))}
              {!isStreaming && <span>· generated {timeLabel}</span>}
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-4">
            {citations.length > 0 && (
              <span className="font-body text-[11px] text-merris-text-secondary">
                <span className="font-semibold text-merris-text">{citations.length}</span> source{citations.length !== 1 ? 's' : ''}
              </span>
            )}
            {!isStreaming && elapsed > 0 && (
              <span className="font-mono text-[11px] text-merris-text-tertiary">{fmtTime(elapsed)}</span>
            )}
            {evaluation && <ScoreRing score={evaluation.score} size={36} />}
          </div>
        </div>

        {/* ── Response body ── */}
        <div className="border-l-4 border-merris-primary px-6 py-6">
          <MarkdownText text={tokenText} streaming={isStreaming} />

          {/* Citations */}
          {citations.length > 0 && (
            <CitationsList citations={citations} />
          )}
        </div>

        {/* ── Action bar ── */}
        {!isStreaming && (
          <div className="flex items-center gap-1 border-t border-merris-border px-5 py-2.5">
            <button
              onClick={() => void handleCopy()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-[11px] text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text"
            >
              {copied
                ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              }
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-[11px] text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            <button
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-[11px] text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Insert into memo
            </button>
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-[11px] text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
              Regenerate
            </button>

            <div className="mx-2 h-4 w-px bg-merris-border" />

            <button className="flex h-7 w-7 items-center justify-center rounded-lg text-merris-text-tertiary hover:bg-merris-surface-low hover:text-emerald-600">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg text-merris-text-tertiary hover:bg-merris-surface-low hover:text-red-500">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
            </button>

            <div className="ml-auto font-body text-[9px] text-merris-text-tertiary">
              Claude Sonnet 4 · 200k · {elapsed > 0 ? fmtTime(elapsed) : '—'} · auditable
            </div>
          </div>
        )}
      </div>

      {/* ── Follow-up suggestions ── */}
      {!isStreaming && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Follow up</span>
          {followUps.map((fup) => (
            <button
              key={fup}
              type="button"
              onClick={() => void startQuery(fup)}
              className="inline-flex items-center gap-1.5 rounded-full border border-merris-border bg-white px-3 py-1 font-body text-[11px] text-merris-text-secondary shadow-sm transition-all hover:border-merris-primary hover:bg-merris-primary-bg hover:text-merris-primary"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              {fup}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
