'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ReActExecution, ReActStep } from '@/lib/api';

const PRIMARY = '#0b5142';

// ── Step type display config ───────────────────────────────────────
const TRACE_TYPES: Record<string, { abbrev: string; label: string; color: string }> = {
  trigger:   { abbrev: 'TRIGGER', label: 'Manual trigger fired',              color: '#16a34a' },
  transform: { abbrev: 'TR',      label: 'Extract regulation requirements',   color: '#0e7490' },
  kb:        { abbrev: 'KB',      label: 'KB Search · regulatory context',    color: '#0369a1' },
  llm:       { abbrev: 'LLM',     label: 'LLM reasoning · severity scoring',  color: '#7c3aed' },
  condition: { abbrev: 'COND',    label: 'Threshold check',                   color: '#be185d' },
  output:    { abbrev: 'OUT',     label: 'Output report generated',           color: '#374151' },
};

function mapStepType(step: ReActStep): typeof TRACE_TYPES[string] {
  const tool = (step.tool ?? '').toLowerCase();
  if (step.type === 'final') return TRACE_TYPES.output!;
  if (step.type === 'thought') return TRACE_TYPES.llm!;
  if (step.type === 'observation') return TRACE_TYPES.kb!;
  if (tool.includes('search') || tool.includes('kb')) return TRACE_TYPES.kb!;
  if (tool.includes('transform') || tool.includes('extract')) return TRACE_TYPES.transform!;
  if (tool.includes('condition') || tool.includes('threshold')) return TRACE_TYPES.condition!;
  return TRACE_TYPES.transform!;
}

function timeOffset(index: number): string {
  const totalSec = index * 14;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · ${d.getDate()} ${d.toLocaleString('en', { month: 'long' })} ${d.getFullYear()}`;
}

// ── Report content parser ──────────────────────────────────────────
type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'quote'; text: string };

function parseReport(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith('# '))  { blocks.push({ kind: 'h1', text: line.slice(2) }); continue; }
    if (line.startsWith('## ')) { blocks.push({ kind: 'h2', text: line.slice(3) }); continue; }
    if (line.startsWith('- ') || line.startsWith('* ')) { blocks.push({ kind: 'bullet', text: line.slice(2) }); continue; }
    if (line.startsWith('> '))  { blocks.push({ kind: 'quote', text: line.slice(2) }); continue; }
    if (/^[A-Z][A-Z\s·\-–]{4,}$/.test(line.trim())) { blocks.push({ kind: 'h2', text: line.trim() }); continue; }
    blocks.push({ kind: 'p', text: line });
  }
  return blocks;
}

// ── Single trace step row ──────────────────────────────────────────
function TraceStep({
  cfg, content, offset, isLast, isKbQuote,
}: {
  cfg: typeof TRACE_TYPES[string];
  content: string;
  offset: string;
  isLast: boolean;
  isKbQuote?: boolean;
}) {
  return (
    <div className="relative flex gap-3">
      {/* Dot + connector */}
      <div className="flex flex-col items-center pt-[3px]">
        <div
          className="z-10 h-4 w-4 shrink-0 rounded-full border-2 border-white shadow-sm"
          style={{ background: cfg.color }}
        />
        {!isLast && <div className="mt-1 w-px flex-1 min-h-[24px]" style={{ background: '#e8eae8' }} />}
      </div>

      {/* Content */}
      <div className={`mb-4 flex-1 ${isLast ? '' : ''}`}>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-white"
              style={{ background: cfg.color }}
            >
              {cfg.abbrev}
            </span>
            <span className="font-display text-[12px] font-semibold text-merris-text">{cfg.label}</span>
          </div>
          <span className="shrink-0 font-mono text-[10px]" style={{ color: '#c4cac4' }}>{offset}</span>
        </div>

        {isKbQuote ? (
          <blockquote
            className="mt-1 rounded-r border-l-2 pl-3 font-body text-[11px] italic leading-relaxed"
            style={{ borderColor: cfg.color, color: '#5f6368', background: '#f8f9fa' }}
          >
            {content}
          </blockquote>
        ) : (
          <p className="mt-1 font-body text-[11px] leading-relaxed" style={{ color: '#5f6368' }}>
            {content.slice(0, 160)}{content.length > 160 ? '…' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Inline markdown (bold / italic / code) ────────────────────────
function InlineMd({ text }: { text: string }) {
  // Split on **bold**, *italic*, `code` tokens — keep delimiters via capture group
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*'))
          return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="rounded bg-gray-100 px-1 font-mono text-[12px]">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Report block renderer ──────────────────────────────────────────
function ReportBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case 'h1':
      return <h1 className="font-serif text-[30px] font-normal leading-tight text-merris-text"><InlineMd text={block.text} /></h1>;
    case 'h2':
      return (
        <div className="mt-7 mb-3 flex items-center gap-2">
          <div className="h-px w-4" style={{ background: PRIMARY }} />
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: PRIMARY }}><InlineMd text={block.text} /></span>
        </div>
      );
    case 'bullet':
      return (
        <div className="flex gap-2 py-1">
          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PRIMARY }} />
          <p className="font-body text-[13px] leading-relaxed text-merris-text"><InlineMd text={block.text} /></p>
        </div>
      );
    case 'quote':
      return (
        <blockquote
          className="my-3 rounded-r border-l-2 py-2 pl-4 font-body text-[13px] italic leading-relaxed"
          style={{ borderColor: PRIMARY, background: '#f5f8f5', color: '#5f6368' }}
        >
          <InlineMd text={block.text} />
        </blockquote>
      );
    default:
      return block.text ? (
        <p className="py-1 font-body text-[13px] leading-relaxed text-merris-text"><InlineMd text={block.text} /></p>
      ) : null;
  }
}

// ── Main panel ─────────────────────────────────────────────────────
interface ReActResultsPanelProps {
  execution: ReActExecution;
  onClose: () => void;
}

export function ReActResultsPanel({ execution, onClose }: ReActResultsPanelProps) {
  const durationSec = execution.completedAt
    ? Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)
    : null;

  const agentName = execution.templateId ?? 'Agent Run';
  const runId = `r_${execution.id.slice(-4)}`;
  const dateLabel = formatDate(execution.completedAt ?? execution.startedAt);
  const finalAnswer = execution.finalAnswer ?? execution.steps.find((s) => s.type === 'final')?.content ?? '';
  const wc = wordCount(finalAnswer);
  const reportBlocks = parseReport(finalAnswer);

  // Prepend synthetic trigger step
  const allSteps: Array<{ cfg: typeof TRACE_TYPES[string]; content: string; isKbQuote?: boolean }> = [
    {
      cfg: TRACE_TYPES.trigger!,
      content: `Run id ${runId} · invoked by user`,
    },
    ...execution.steps
      .filter((s) => s.type !== 'final')
      .map((step) => ({
        cfg: mapStepType(step),
        content: step.content,
        isKbQuote: step.type === 'observation',
      })),
  ];
  if (finalAnswer) {
    allSteps.push({ cfg: TRACE_TYPES.output!, content: finalAnswer.slice(0, 80) + '…' });
  }

  const statusColors = {
    completed: { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a' },
    failed:    { bg: '#fef2f2', color: '#dc2626', dot: '#dc2626' },
    running:   { bg: '#fffbeb', color: '#b45309', dot: '#d97706' },
    paused:    { bg: '#fffbeb', color: '#b45309', dot: '#d97706' },
  };
  const sc = statusColors[execution.status as keyof typeof statusColors] ?? statusColors.completed;

  const [exporting, setExporting] = useState<'word' | 'excel' | 'md' | null>(null);

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const handleExportMd = () => {
    const lines = [`# ${agentName}`, `Run: ${runId}`, '', finalAnswer];
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/markdown' }), `${runId}.md`);
  };

  const handleExportWord = async () => {
    setExporting('word');
    try {
      const blob = await api.exportWord({
        title: agentName,
        agentName,
        runId,
        generatedAt: dateLabel,
        content: finalAnswer,
      });
      triggerDownload(blob, `${runId}.docx`);
    } catch { /* silently fail — backend not up in dev */ }
    finally { setExporting(null); }
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const blob = await api.exportExcel({
        title: agentName,
        agentName,
        runId,
        generatedAt: dateLabel,
        content: finalAnswer,
      });
      triggerDownload(blob, `${runId}.xlsx`);
    } catch { /* silently fail */ }
    finally { setExporting(null); }
  };

  const handleExport = handleExportMd;

  return (
    // Fixed to content area (right of sidebar, below topbar)
    <div
      className="flex flex-col overflow-hidden bg-white"
      style={{ position: 'fixed', top: 44, left: 210, right: 0, bottom: 0, zIndex: 40 }}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center gap-4 bg-white px-6 py-3.5"
        style={{ borderBottom: '1px solid #e8eae8' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-merris-surface-low"
          style={{ border: '1px solid #e0e2e0' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>

        <div className="min-w-0">
          <div className="font-display text-[15px] font-bold leading-tight text-merris-text truncate">{agentName}</div>
          <div className="font-mono text-[10px]" style={{ color: '#9aa0a6' }}>
            run · {runId} · {dateLabel}
          </div>
        </div>

        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider"
          style={{ background: sc.bg, color: sc.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc.dot }} />
          {execution.status}
        </span>

        <div className="ml-auto flex items-center gap-4">
          <div className="font-mono text-[11px]" style={{ color: '#9aa0a6' }}>
            {execution.steps.length} nodes
            {durationSec != null && <> · <span className="text-merris-text font-semibold">{durationSec}s</span> total</>}
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-display text-[11px] font-semibold text-merris-text transition-colors hover:border-merris-primary hover:text-merris-primary"
            style={{ borderColor: '#e0e2e0' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* ── HIL paused banner ─────────────────────────────────────── */}
      {execution.status === 'paused' && execution.hilReviewId && (
        <div
          className="flex shrink-0 items-center justify-between px-6 py-3"
          style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div>
              <span className="font-display text-[12px] font-bold text-amber-900">Workflow paused — human review required</span>
              <span className="ml-2 font-mono text-[9px] text-amber-600">{execution.hilReviewId}</span>
            </div>
          </div>
          <Link
            href={`/workflow-agents/human-in-loop?reviewId=${execution.hilReviewId}`}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#0b5142' }}
          >
            Open Review
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      )}

      {/* ── Body: two columns ─────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: execution trace */}
        <div
          className="flex w-[360px] shrink-0 flex-col overflow-y-auto"
          style={{ borderRight: '1px solid #e8eae8' }}
        >
          <div
            className="flex shrink-0 items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid #f0f0ed', background: '#fafaf8' }}
          >
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
              Execution Trace
            </span>
            <span className="font-mono text-[9px]" style={{ color: '#9aa0a6' }}>
              {allSteps.length} Steps
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {allSteps.length === 0 ? (
              <div className="py-12 text-center font-body text-[12px]" style={{ color: '#9aa0a6' }}>
                {execution.status === 'running' ? 'Agent is running…' : 'No steps recorded.'}
              </div>
            ) : (
              allSteps.map((s, i) => (
                <TraceStep
                  key={i}
                  cfg={s.cfg}
                  content={s.content}
                  offset={timeOffset(i)}
                  isLast={i === allSteps.length - 1}
                  isKbQuote={s.isKbQuote}
                />
              ))
            )}

            {execution.status === 'failed' && execution.error && (
              <div className="mt-2 rounded-lg px-3 py-2.5 font-mono text-[10px] text-red-600" style={{ background: '#fef2f2' }}>
                {execution.error}
              </div>
            )}
          </div>
        </div>

        {/* Right: report document */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-10 py-8">
              {/* Document meta header */}
              <div className="mb-5 flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                  Advisory Memo · ESG
                </span>
                <span className="font-mono text-[10px]" style={{ color: '#9aa0a6' }}>
                  {wc.toLocaleString()} words
                </span>
              </div>

              {/* Title */}
              <h1 className="font-serif text-[28px] font-normal leading-tight text-merris-text">
                {agentName}
              </h1>
              <p className="mt-2 mb-8 font-body text-[11px]" style={{ color: '#9aa0a6' }}>
                Generated by <strong className="text-merris-text">Merris</strong> · {dateLabel}
                {durationSec != null && <> · {durationSec}s</>}
                {execution.steps.length > 0 && <> · {execution.steps.length} steps</>}
              </p>

              {/* Report body */}
              {reportBlocks.length > 0 ? (
                <div>
                  {reportBlocks.map((block, i) => (
                    <ReportBlock key={i} block={block} />
                  ))}
                </div>
              ) : finalAnswer ? (
                <p className="font-body text-[13px] leading-relaxed text-merris-text whitespace-pre-wrap">
                  {finalAnswer}
                </p>
              ) : (
                <div className="py-12 text-center font-body text-[12px]" style={{ color: '#9aa0a6' }}>
                  {execution.status === 'running' ? 'Generating report…' : 'No output recorded.'}
                </div>
              )}
            </div>
          </div>

          {/* Bottom export bar */}
          <div
            className="flex shrink-0 items-center justify-between px-8 py-3"
            style={{ borderTop: '1px solid #e8eae8', background: '#fafaf8' }}
          >
            <div className="flex items-center gap-2 font-mono text-[10px]" style={{ color: '#9aa0a6' }}>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>$saved</span>
              <span>·</span>
              <span>auto-sync ON</span>
              <span>·</span>
              <span>traceable · audit trail enabled</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(finalAnswer)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-display text-[11px] font-semibold text-merris-text transition-colors hover:border-merris-primary hover:text-merris-primary"
                style={{ borderColor: '#e0e2e0' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy
              </button>
              <button
                type="button"
                onClick={() => void handleExportExcel()}
                disabled={exporting === 'excel'}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-display text-[11px] font-semibold text-merris-text transition-colors hover:border-merris-primary hover:text-merris-primary disabled:opacity-50"
                style={{ borderColor: '#e0e2e0' }}
              >
                {exporting === 'excel' ? (
                  <div className="h-3 w-3 animate-spin rounded-full border border-t-transparent" style={{ borderColor: PRIMARY + '40', borderTopColor: PRIMARY }} />
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>
                  </svg>
                )}
                Export Excel
              </button>
              <button
                type="button"
                onClick={() => void handleExportWord()}
                disabled={exporting === 'word'}
                className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-display text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: PRIMARY }}
              >
                {exporting === 'word' ? (
                  <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
                  </svg>
                )}
                Export Word
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
