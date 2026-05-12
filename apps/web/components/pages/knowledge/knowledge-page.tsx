'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { useVaultKBStore } from '@/lib/store';
import { merrisTokens } from '@/lib/design-tokens';
import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { api } from '@/lib/api';
import { MarkdownText } from '@/components/intelligence/markdown-text';
import type { VaultDocument } from '@/lib/api';

// ── helpers ──────────────────────────────────────────────────────────────────

const ACCEPTED = '.pdf,.docx,.xlsx,.xls,.pptx,.png,.jpg,.jpeg,.eml,.msg,.csv,.tsv,.txt,.md';

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued', parsing: 'Parsing', chunking: 'Chunking',
  embedding: 'Embedding', indexed: 'Verified', failed: 'Failed',
};
const STATUS_VARIANT: Record<string, 'completed' | 'draft' | 'default' | 'in-progress'> = {
  indexed: 'completed', failed: 'draft', queued: 'default',
  parsing: 'in-progress', chunking: 'in-progress', embedding: 'in-progress',
};
const FORMAT_COLOR: Record<string, string> = {
  pdf: '#ef4444', docx: '#3b82f6', xlsx: '#22c55e', xls: '#22c55e',
  pptx: '#f97316', csv: '#8b5cf6', tsv: '#8b5cf6', txt: '#6b7280',
  md: '#6b7280', png: '#ec4899', jpg: '#ec4899', jpeg: '#ec4899',
  eml: '#f59e0b', msg: '#f59e0b',
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex min-w-[110px] flex-col rounded-merris border border-merris-border bg-merris-surface px-4 py-3">
      <span className="font-display text-[22px] font-bold" style={{ color }}>{value}</span>
      <span className="font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary">{label}</span>
    </div>
  );
}

// ── format badge ──────────────────────────────────────────────────────────────

function FormatBadge({ ext }: { ext: string }) {
  const color = FORMAT_COLOR[ext.toLowerCase()] ?? merrisTokens.primary;
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-white" style={{ background: color }}>
      {ext}
    </span>
  );
}

// ── upload modal ──────────────────────────────────────────────────────────────

function UploadModal({ onClose, onUpload }: { onClose: () => void; onUpload: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    setSelected((prev) => [...prev, ...Array.from(fl)]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-merris border border-merris-border bg-merris-surface shadow-merris">
        <div className="flex items-center justify-between border-b border-merris-border px-5 py-4">
          <span className="font-display text-[14px] font-semibold text-merris-text">Upload Documents</span>
          <button onClick={onClose} className="text-merris-text-tertiary hover:text-merris-text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-merris border-2 border-dashed py-10 transition-colors ${dragging ? 'border-merris-primary bg-merris-primary-bg' : 'border-merris-border hover:border-merris-primary'}`}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span className="font-body text-[12px] text-merris-text-secondary">Drag files here or <span className="text-merris-primary">browse</span></span>
            <span className="font-body text-[10px] text-merris-text-tertiary">PDF · DOCX · XLSX · PPTX · CSV · PNG · EML · TXT</span>
            <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </div>
          {selected.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {selected.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-merris-sm bg-merris-surface-low px-3 py-1.5">
                  <span className="truncate font-body text-[11px] text-merris-text">{f.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-body text-[10px] text-merris-text-tertiary">{fmtSize(f.size)}</span>
                    <button onClick={() => setSelected((p) => p.filter((_, j) => j !== i))} className="text-merris-text-tertiary hover:text-merris-error">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-merris-border px-5 py-3">
          <button onClick={onClose} className="rounded-merris-sm px-3 py-1.5 font-body text-[12px] text-merris-text-secondary hover:text-merris-text">Cancel</button>
          <button
            disabled={selected.length === 0}
            onClick={() => { onUpload(selected); onClose(); }}
            className="rounded-merris-sm bg-merris-primary px-4 py-1.5 font-display text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            Upload {selected.length > 0 ? `(${selected.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── document row ──────────────────────────────────────────────────────────────

function DocRow({ doc, onDelete, onRetry, selectable, selected, onSelect }: {
  doc: VaultDocument;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-3 border-b border-merris-border px-4 py-3 last:border-0 hover:bg-merris-surface-low ${selected ? 'bg-merris-primary-bg' : ''}`}>
      {selectable && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={(e) => onSelect?.(doc.id, e.target.checked)}
          className="h-3.5 w-3.5 accent-merris-primary"
        />
      )}
      <div className="w-12 shrink-0"><FormatBadge ext={doc.format} /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-body text-[12px] font-medium text-merris-text">{doc.filename}</div>
        <div className="font-body text-[10px] text-merris-text-tertiary">
          {fmtSize(doc.size)}
          {doc.pageCount != null ? ` · ${doc.pageCount} pages` : ''}
          {doc.chunkCount > 0 ? ` · ${doc.chunkCount} chunks` : ''}
          {` · v${doc.version}`}
        </div>
      </div>
      <div className="hidden w-24 shrink-0 sm:block">
        <span className="font-body text-[10px] capitalize text-merris-text-secondary">{doc.classification}</span>
      </div>
      <div className="hidden w-24 shrink-0 text-right sm:block">
        <span className="font-body text-[10px] text-merris-text-tertiary">{fmtDate(doc.uploadedAt)}</span>
      </div>
      <div className="w-20 shrink-0 text-right">
        <Pill size="sm" variant={STATUS_VARIANT[doc.status] ?? 'default'}>
          {STATUS_LABEL[doc.status] ?? doc.status}
        </Pill>
      </div>
      {!selectable && (
        <div className="flex shrink-0 items-center gap-1">
          {doc.status === 'failed' && (
            <button onClick={() => onRetry(doc.id)} title="Retry" className="rounded p-1 text-merris-text-tertiary hover:text-merris-primary">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            </button>
          )}
          <button onClick={() => onDelete(doc.id)} title="Delete" className="rounded p-1 text-merris-text-tertiary hover:text-merris-error">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── ask panel ─────────────────────────────────────────────────────────────────

function AskPanel({ workspaceId }: { workspaceId: string }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ answer: string; sources: Array<{ chunkId: string; documentId: string; content: string; page: number | null; section: string; score: number }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || !workspaceId) return;
    setLoading(true); setResult(null); setError(null); setShowSources(false);
    try {
      setResult(await api.askVault(workspaceId, q));
    } catch {
      setError('Failed to get answer. Make sure documents are indexed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-0">
      <MerrisCard style={{ padding: 0 }}>
        <div className="flex items-center gap-2 border-b border-merris-border px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span className="font-display text-[13px] font-semibold text-merris-text">Ask your documents</span>
          <span className="ml-auto font-body text-[10px] text-merris-text-tertiary">Powered by Claude · searches all indexed documents</span>
        </div>
        <form onSubmit={handleAsk} className="p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What are the key sustainability metrics in this report?"
              className="flex-1 rounded-merris-sm border border-merris-border bg-merris-surface-low px-3 py-2 font-body text-[12px] text-merris-text outline-none placeholder:text-merris-text-tertiary focus:border-merris-primary"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="flex items-center gap-1.5 rounded-merris-sm bg-merris-primary px-4 py-2 font-display text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              {loading ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
              Ask
            </button>
          </div>
        </form>

        {error && <div className="border-t border-merris-border px-4 py-3"><p className="font-body text-[12px] text-merris-error">{error}</p></div>}

        {result && (
          <div className="border-t border-merris-border">
            <div className="px-4 py-4">
              <MarkdownText text={result.answer} />
            </div>
            {result.sources.length > 0 && (
              <div className="border-t border-merris-border px-4 py-2">
                <button onClick={() => setShowSources((v) => !v)} className="flex items-center gap-1.5 font-body text-[11px] text-merris-text-secondary hover:text-merris-primary">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{showSources ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}</svg>
                  {showSources ? 'Hide' : 'Show'} {result.sources.length} source{result.sources.length !== 1 ? 's' : ''}
                </button>
                {showSources && (
                  <div className="mt-2 space-y-2 pb-2">
                    {result.sources.map((s, i) => (
                      <div key={s.chunkId} className="rounded-merris-sm bg-merris-surface-low px-3 py-2">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-mono text-[9px] font-bold text-merris-primary">[{i + 1}]</span>
                          <span className="font-body text-[10px] text-merris-text-tertiary">{s.page != null ? `p.${s.page}` : ''}{s.section ? ` · ${s.section}` : ''}</span>
                          <span className="ml-auto font-body text-[10px] text-merris-primary">{Math.round(s.score * 100)}%</span>
                        </div>
                        <p className="font-body text-[11px] italic leading-relaxed text-merris-text-secondary line-clamp-2">&ldquo;{s.content}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </MerrisCard>
    </div>
  );
}

// ── compare panel ─────────────────────────────────────────────────────────────

function ComparePanel({ workspaceId, documents }: { workspaceId: string; documents: VaultDocument[] }) {
  const indexed = documents.filter((d) => d.status === 'indexed');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    dimensions: Array<{ name: string; comparisons: Array<{ documentId: string; documentName: string; summary: string }> }>;
    overallAnalysis: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleDoc(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCompare() {
    if (selected.size < 2) return;
    setLoading(true); setResult(null); setError(null);
    try {
      setResult(await api.compareVaultDocuments(workspaceId, Array.from(selected), undefined, query || undefined));
    } catch {
      setError('Comparison failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (indexed.length < 2) {
    return (
      <MerrisCard style={{ padding: '32px 24px' }}>
        <div className="flex flex-col items-center gap-2 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.2"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
          <p className="font-body text-[12px] text-merris-text-secondary">You need at least 2 verified documents to compare.</p>
          <p className="font-body text-[11px] text-merris-text-tertiary">Upload and wait for documents to finish processing.</p>
        </div>
      </MerrisCard>
    );
  }

  return (
    <div className="space-y-4">
      <MerrisCard style={{ padding: 0 }}>
        <div className="flex items-center gap-2 border-b border-merris-border px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="2"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
          <span className="font-display text-[13px] font-semibold text-merris-text">Compare Documents</span>
          <span className="ml-auto font-body text-[10px] text-merris-text-tertiary">Select 2 or more · Claude finds differences</span>
        </div>

        {/* doc selection */}
        <div className="divide-y divide-merris-border">
          {indexed.map((doc) => (
            <label key={doc.id} className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-merris-surface-low ${selected.has(doc.id) ? 'bg-merris-primary-bg' : ''}`}>
              <input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggleDoc(doc.id)} className="h-3.5 w-3.5 accent-merris-primary" />
              <FormatBadge ext={doc.format} />
              <span className="min-w-0 flex-1 truncate font-body text-[12px] text-merris-text">{doc.filename}</span>
              <span className="font-body text-[10px] text-merris-text-tertiary">{doc.chunkCount} chunks</span>
            </label>
          ))}
        </div>

        {/* optional focus */}
        <div className="border-t border-merris-border px-4 py-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Optional: focus the comparison on a specific topic…"
            className="w-full rounded-merris-sm border border-merris-border bg-merris-surface-low px-3 py-2 font-body text-[12px] text-merris-text outline-none placeholder:text-merris-text-tertiary focus:border-merris-primary"
          />
        </div>

        <div className="flex items-center justify-between border-t border-merris-border px-4 py-3">
          <span className="font-body text-[11px] text-merris-text-tertiary">
            {selected.size < 2 ? `Select ${2 - selected.size} more document${selected.size === 1 ? '' : 's'}` : `${selected.size} documents selected`}
          </span>
          <button
            onClick={handleCompare}
            disabled={selected.size < 2 || loading}
            className="flex items-center gap-1.5 rounded-merris-sm bg-merris-primary px-4 py-1.5 font-display text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {loading ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
            {loading ? 'Comparing…' : 'Compare'}
          </button>
        </div>
      </MerrisCard>

      {error && <p className="font-body text-[12px] text-merris-error">{error}</p>}

      {result && (
        <MerrisCard style={{ padding: 0 }}>
          <div className="border-b border-merris-border px-4 py-3">
            <span className="font-display text-[13px] font-semibold text-merris-text">Comparison Results</span>
          </div>

          {/* overall */}
          <div className="border-b border-merris-border px-4 py-3">
            <p className="mb-1 font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary">Overall Analysis</p>
            <p className="font-body text-[12px] leading-relaxed text-merris-text">{result.overallAnalysis}</p>
          </div>

          {/* dimensions */}
          {result.dimensions.map((dim) => (
            <div key={dim.name} className="border-b border-merris-border px-4 py-3 last:border-0">
              <p className="mb-2 font-display text-[11px] font-semibold capitalize text-merris-text">{dim.name}</p>
              <div className="space-y-2">
                {dim.comparisons.map((c) => (
                  <div key={c.documentId} className="rounded-merris-sm bg-merris-surface-low px-3 py-2">
                    <p className="mb-0.5 truncate font-body text-[10px] font-semibold text-merris-primary">{c.documentName}</p>
                    <p className="font-body text-[11px] leading-relaxed text-merris-text-secondary">{c.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </MerrisCard>
      )}
    </div>
  );
}

// ── jobs panel ────────────────────────────────────────────────────────────────

function JobsPanel({ workspaceId }: { workspaceId: string }) {
  const [jobs, setJobs] = useState<Array<{
    jobId: string; documentId: string; filename: string; format: string;
    status: string; startedAt: string; updatedAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await api.listVaultJobs(workspaceId);
      setJobs(data.jobs);
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchJobs();
    pollRef.current = setInterval(fetchJobs, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchJobs]);

  const JOB_STATUS_VARIANT: Record<string, 'default' | 'in-progress' | 'completed' | 'draft'> = {
    queued: 'default', parsing: 'in-progress', chunking: 'in-progress', embedding: 'in-progress',
  };

  return (
    <MerrisCard style={{ padding: 0 }}>
      <div className="flex items-center gap-2 border-b border-merris-border px-4 py-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span className="font-display text-[13px] font-semibold text-merris-text">Processing Jobs</span>
        <span className="ml-auto font-body text-[10px] text-merris-text-tertiary">Refreshes every 5s</span>
        <button onClick={fetchJobs} className="text-merris-text-tertiary hover:text-merris-primary" title="Refresh">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
        </button>
      </div>

      {loading ? (
        <div className="px-4 py-10 text-center font-body text-[12px] text-merris-text-tertiary">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.2"><polyline points="20 6 9 17 4 12"/></svg>
          <p className="font-body text-[12px] text-merris-text-secondary">No active jobs</p>
          <p className="font-body text-[11px] text-merris-text-tertiary">All documents have finished processing.</p>
        </div>
      ) : (
        <>
          {/* header row */}
          <div className="flex items-center gap-3 border-b border-merris-border bg-merris-surface-low px-4 py-2">
            <div className="w-12 shrink-0 font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary">Type</div>
            <div className="min-w-0 flex-1 font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary">File</div>
            <div className="w-24 shrink-0 font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary">Stage</div>
            <div className="w-32 shrink-0 text-right font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary">Last update</div>
          </div>
          {jobs.map((job) => (
            <div key={job.jobId} className="flex items-center gap-3 border-b border-merris-border px-4 py-3 last:border-0">
              <div className="w-12 shrink-0"><FormatBadge ext={job.format} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-body text-[12px] font-medium text-merris-text">{job.filename}</div>
                <div className="font-body text-[10px] text-merris-text-tertiary">Started {fmtTime(job.startedAt)}</div>
              </div>
              <div className="w-24 shrink-0">
                <Pill size="sm" variant={JOB_STATUS_VARIANT[job.status] ?? 'default'}>
                  {STATUS_LABEL[job.status] ?? job.status}
                </Pill>
              </div>
              <div className="w-32 shrink-0 text-right font-body text-[10px] text-merris-text-tertiary">
                {fmtTime(job.updatedAt)}
              </div>
            </div>
          ))}
        </>
      )}
    </MerrisCard>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

type Tab = 'documents' | 'ask' | 'compare' | 'jobs';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'documents', label: 'Documents', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  { id: 'ask',       label: 'Ask AI',    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { id: 'compare',   label: 'Compare',   icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg> },
  { id: 'jobs',      label: 'Jobs',      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
];

export function KnowledgePage() {
  const user = useAuthStore((s) => s.user);
  const workspaceId = user?.orgId ?? '';

  const {
    documents, stats, loading, uploading,
    searchResults, searching,
    fetchDocuments, fetchStats,
    uploadDocument, deleteDocument, retryDocument,
    search, clearSearch,
  } = useVaultKBStore();

  const [tab, setTab] = useState<Tab>('documents');
  const [showUpload, setShowUpload] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(() => {
    if (!workspaceId) return;
    fetchDocuments(workspaceId);
    fetchStats(workspaceId);
  }, [workspaceId, fetchDocuments, fetchStats]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => {
      const hasInFlight = useVaultKBStore.getState().documents.some((d) => !['indexed', 'failed'].includes(d.status));
      if (hasInFlight) load();
    }, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  async function handleUpload(files: File[]) {
    for (const file of files) {
      try {
        const res = await uploadDocument(workspaceId, file);
        showToast(res.duplicate ? `"${file.name}" already exists — skipped` : `"${file.name}" queued for processing`);
      } catch { showToast(`Failed to upload "${file.name}"`); }
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Delete this document and all its indexed data?')) return;
    await deleteDocument(workspaceId, docId);
    showToast('Document deleted');
  }

  async function handleRetry(docId: string) {
    await retryDocument(workspaceId, docId);
    showToast('Document queued for reprocessing');
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) search(workspaceId, query.trim());
    else clearSearch();
  }

  const displayDocs = searchResults.length > 0
    ? documents.filter((d) => searchResults.some((r) => r.documentId === d.id))
    : documents;

  return (
    <div className="p-6">
      {/* ── header ── */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold text-merris-text">Knowledge Base</h1>
          <p className="mt-0.5 font-body text-[12px] text-merris-text-secondary">
            Upload documents your firm uses internally. Ask Merris questions from them in Intelligence.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 rounded-merris bg-merris-primary px-4 py-2 font-display text-[12px] font-semibold text-white hover:opacity-90"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Upload
        </button>
      </div>

      {/* ── stats ── */}
      <div className="mb-5 flex flex-wrap gap-3">
        <StatCard label="Total"      value={stats.total}      color={merrisTokens.text} />
        <StatCard label="Verified"   value={stats.indexed}    color="#22c55e" />
        <StatCard label="Processing" value={stats.processing} color={merrisTokens.primary} />
        <StatCard label="Failed"     value={stats.failed}     color="#ef4444" />
      </div>

      {/* ── tabs ── */}
      <div className="mb-5 flex gap-1 border-b border-merris-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 font-display text-[12px] font-semibold transition-colors ${
              tab === t.id
                ? 'border-merris-primary text-merris-primary'
                : 'border-transparent text-merris-text-tertiary hover:text-merris-text'
            }`}
          >
            {t.icon}
            {t.label}
            {t.id === 'jobs' && stats.processing > 0 && (
              <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-merris-primary font-mono text-[9px] font-bold text-white">
                {stats.processing}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── tab: documents ── */}
      {tab === 'documents' && (
        <>
          {/* search */}
          <form onSubmit={handleSearch} className="mb-5">
            <div className="flex items-center gap-2 rounded-merris-sm bg-merris-surface-low px-3 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="1.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your documents… (press Enter)"
                className="flex-1 bg-transparent font-body text-[12px] text-merris-text outline-none placeholder:text-merris-text-tertiary"
              />
              {searching && <span className="font-body text-[10px] text-merris-text-tertiary">Searching…</span>}
              {query && (
                <button type="button" onClick={() => { setQuery(''); clearSearch(); }} className="text-merris-text-tertiary hover:text-merris-text">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
          </form>

          {/* search snippets */}
          {searchResults.length > 0 && (
            <div className="mb-5 space-y-2">
              <div className="font-body text-[11px] text-merris-text-secondary">{searchResults.length} matching chunks for &ldquo;{query}&rdquo;</div>
              {searchResults.slice(0, 5).map((r) => (
                <MerrisCard key={r.chunkId} style={{ padding: '10px 14px' }}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-body text-[11px] italic leading-relaxed text-merris-text-secondary line-clamp-2">&ldquo;{r.content}&rdquo;</div>
                      <div className="mt-1 font-body text-[10px] text-merris-text-tertiary">{r.section} · page {r.page}</div>
                    </div>
                    <div className="shrink-0 font-body text-[10px] text-merris-primary">{Math.round(r.score * 100)}%</div>
                  </div>
                </MerrisCard>
              ))}
            </div>
          )}

          {/* doc list */}
          <MerrisCard style={{ padding: 0 }}>
            <div className="flex items-center gap-3 border-b border-merris-border bg-merris-surface-low px-4 py-2">
              <div className="w-12 shrink-0 font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary">Type</div>
              <div className="min-w-0 flex-1 font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary">Document</div>
              <div className="hidden w-24 shrink-0 font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary sm:block">Class</div>
              <div className="hidden w-24 shrink-0 text-right font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary sm:block">Uploaded</div>
              <div className="w-20 shrink-0 text-right font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary">Status</div>
              <div className="w-12 shrink-0" />
            </div>
            {loading && documents.length === 0 ? (
              <div className="px-4 py-10 text-center font-body text-[12px] text-merris-text-tertiary">Loading…</div>
            ) : displayDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.2" className="mb-3">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                </svg>
                <p className="font-body text-[12px] text-merris-text-secondary">No documents yet</p>
                <p className="mt-1 font-body text-[11px] text-merris-text-tertiary">Upload your first document to get started</p>
                <button onClick={() => setShowUpload(true)} className="mt-4 rounded-merris-sm bg-merris-primary px-4 py-1.5 font-display text-[11px] font-semibold text-white hover:opacity-90">
                  Upload Document
                </button>
              </div>
            ) : (
              displayDocs.map((doc) => (
                <DocRow key={doc.id} doc={doc} onDelete={handleDelete} onRetry={handleRetry} />
              ))
            )}
          </MerrisCard>
        </>
      )}

      {/* ── tab: ask ── */}
      {tab === 'ask' && (
        stats.indexed > 0
          ? <AskPanel workspaceId={workspaceId} />
          : (
            <MerrisCard style={{ padding: '40px 24px' }}>
              <div className="flex flex-col items-center gap-2 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <p className="font-body text-[12px] text-merris-text-secondary">No verified documents yet.</p>
                <p className="font-body text-[11px] text-merris-text-tertiary">Upload a document and wait for it to be indexed before asking questions.</p>
              </div>
            </MerrisCard>
          )
      )}

      {/* ── tab: compare ── */}
      {tab === 'compare' && <ComparePanel workspaceId={workspaceId} documents={documents} />}

      {/* ── tab: jobs ── */}
      {tab === 'jobs' && <JobsPanel workspaceId={workspaceId} />}

      {/* ── upload modal ── */}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUpload={handleUpload} />}

      {/* ── uploading indicator ── */}
      {uploading && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-merris border border-merris-border bg-merris-surface px-4 py-2.5 shadow-merris">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-merris-primary border-t-transparent" />
          <span className="font-body text-[12px] text-merris-text">Uploading…</span>
        </div>
      )}

      {/* ── toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-merris border border-merris-border bg-merris-surface px-4 py-2.5 shadow-merris">
          <span className="font-body text-[12px] text-merris-text">{toast}</span>
        </div>
      )}
    </div>
  );
}
