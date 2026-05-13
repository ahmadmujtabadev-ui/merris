'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore, useVaultKBStore } from '@/lib/store';
import { merrisTokens } from '@/lib/design-tokens';
import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { MarkdownText } from '@/components/intelligence/markdown-text';
import { api } from '@/lib/api';
import type { VaultDocument } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SourceItem {
  chunkId: string; documentId: string; documentName: string;
  content: string; page: number | null; section: string; score: number;
}
interface ChatMessage {
  id: string; role: 'user' | 'assistant'; content: string; timestamp: number;
  sources?: SourceItem[]; followUps?: string[]; lowConfidence?: boolean;
  answeredInMs?: number; passageCount?: number;
}
interface Conversation {
  id: string; title: string; createdAt: number; messages: ChatMessage[];
  documentIds?: string[];
}
interface ComparisonRun {
  id: string; docAName: string; docBName: string; angles: string[]; runAt: number;
  label: 'YoY' | 'Cross' | 'Reg';
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACCEPTED = '.pdf,.docx,.xlsx,.xls,.pptx,.png,.jpg,.jpeg,.eml,.msg,.csv,.tsv,.txt,.md';
const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued', parsing: 'Parsing', chunking: 'Chunking',
  embedding: 'Embedding', indexed: 'Verified', failed: 'Failed',
};
const FORMAT_COLOR: Record<string, string> = {
  pdf: '#ef4444', docx: '#3b82f6', xlsx: '#22c55e', xls: '#22c55e',
  pptx: '#f97316', csv: '#8b5cf6', tsv: '#8b5cf6', txt: '#6b7280',
  md: '#6b7280', png: '#ec4899', jpg: '#ec4899', jpeg: '#ec4899',
  eml: '#f59e0b', msg: '#f59e0b',
};
const COMPARISON_ANGLES = [
  { id: 'auto',      label: 'Auto-detect differences',  dim: '' },
  { id: 'scope3',    label: 'Scope 3 methodology',      dim: 'Scope 3 emissions methodology and calculation' },
  { id: 'netzero',   label: 'Net-zero targets',         dim: 'Net-zero targets and decarbonisation commitments' },
  { id: 'framework', label: 'Framework alignment',      dim: 'Framework alignment (GHG Protocol, TCFD, CSRD)' },
  { id: 'governance',label: 'Governance',               dim: 'Governance and oversight structures' },
  { id: 'material',  label: 'Material topics',          dim: 'Material ESG topics and priority areas' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function relTime(ts: number) {
  const d = Date.now() - ts;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  if (d < 172800000) return 'Yesterday';
  if (d < 604800000) return `${Math.floor(d / 86400000)} days ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Small components
// ─────────────────────────────────────────────────────────────────────────────

function FormatBadge({ ext }: { ext: string }) {
  const color = FORMAT_COLOR[ext.toLowerCase()] ?? merrisTokens.primary;
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-white" style={{ background: color }}>
      {ext}
    </span>
  );
}

function DocMiniThumb({ ext }: { ext: string }) {
  const color = FORMAT_COLOR[ext.toLowerCase()] ?? '#94a3b8';
  return (
    <div className="flex h-[52px] w-[40px] shrink-0 flex-col items-center justify-center gap-1 rounded-sm" style={{ background: color + '22', border: `1px solid ${color}44` }}>
      <div className="h-1 w-6 rounded-full" style={{ background: color + '88' }} />
      <div className="h-1 w-5 rounded-full" style={{ background: color + '66' }} />
      <div className="h-1 w-4 rounded-full" style={{ background: color + '44' }} />
      <span className="mt-0.5 font-mono text-[7px] font-bold uppercase" style={{ color }}>{ext}</span>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="flex min-w-[140px] flex-1 flex-col rounded-xl border border-merris-border bg-white px-5 py-4">
      <span className="font-display text-[28px] font-bold leading-none" style={{ color }}>{value}</span>
      <span className="mt-1 font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">{label}</span>
      <span className="mt-1 font-body text-[10px] text-merris-text-tertiary">{sub}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Modal
// ─────────────────────────────────────────────────────────────────────────────

function UploadModal({ onClose, onUpload }: { onClose: () => void; onUpload: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const addFiles = (fl: FileList | null) => { if (fl) setSelected(p => [...p, ...Array.from(fl)]); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-merris-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-merris-border px-5 py-4">
          <span className="font-display text-[14px] font-semibold text-merris-text">Upload Documents</span>
          <button onClick={onClose} className="text-merris-text-tertiary hover:text-merris-text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 transition-colors ${dragging ? 'border-merris-primary bg-merris-primary-bg' : 'border-merris-border hover:border-merris-primary'}`}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span className="font-body text-[12px] text-merris-text-secondary">Drag files here or <span className="text-merris-primary">browse</span></span>
            <span className="font-body text-[10px] text-merris-text-tertiary">PDF · DOCX · XLSX · PPTX · CSV · PNG · EML · TXT</span>
            <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={e => addFiles(e.target.files)} />
          </div>
          {selected.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {selected.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-merris-surface-low px-3 py-1.5">
                  <span className="truncate font-body text-[11px] text-merris-text">{f.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-body text-[10px] text-merris-text-tertiary">{fmtSize(f.size)}</span>
                    <button onClick={() => setSelected(p => p.filter((_, j) => j !== i))} className="text-merris-text-tertiary hover:text-red-500">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-merris-border px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 font-body text-[12px] text-merris-text-secondary hover:text-merris-text">Cancel</button>
          <button disabled={selected.length === 0} onClick={() => { onUpload(selected); onClose(); }}
            className="rounded-lg bg-merris-primary px-4 py-1.5 font-display text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-40">
            Upload {selected.length > 0 ? `(${selected.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Documents tab
// ─────────────────────────────────────────────────────────────────────────────

function DocRow({ doc, onDelete, onRetry }: { doc: VaultDocument; onDelete: (id: string) => void; onRetry: (id: string) => void }) {
  const statusDot: Record<string, string> = {
    indexed: '#22c55e', failed: '#ef4444', queued: '#94a3b8',
    parsing: merrisTokens.primary, chunking: merrisTokens.primary, embedding: merrisTokens.primary,
  };
  return (
    <div className="flex items-center gap-3 border-b border-merris-border px-4 py-3 last:border-0 hover:bg-merris-surface-low">
      <div className="w-12 shrink-0"><FormatBadge ext={doc.format} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-body text-[12px] font-medium text-merris-text">{doc.filename}</span>
          {doc.ocrUsed && <span title="Claude Vision OCR" className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 font-mono text-[8px] font-bold text-violet-700">OCR</span>}
          {doc.isScanned && !doc.ocrUsed && <span title="Scanned document" className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 font-mono text-[8px] font-bold text-amber-700">SCAN</span>}
        </div>
        <div className="font-body text-[10px] text-merris-text-tertiary">
          {fmtSize(doc.size)}{doc.pageCount != null ? ` · ${doc.pageCount} pages` : ''}{doc.chunkCount > 0 ? ` · ${doc.chunkCount} chunks` : ''}{` · v${doc.version}`}
        </div>
      </div>
      <div className="hidden w-32 shrink-0 sm:block">
        <span className="inline-flex items-center rounded-full border border-merris-border px-2 py-0.5 font-body text-[10px] capitalize text-merris-text-secondary">{doc.classification}</span>
      </div>
      <div className="hidden w-24 shrink-0 text-right sm:block">
        <span className="font-body text-[10px] text-merris-text-tertiary">{fmtDate(doc.uploadedAt)}</span>
      </div>
      <div className="flex w-24 shrink-0 items-center justify-end gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusDot[doc.status] ?? '#94a3b8' }} />
        <span className="font-body text-[11px] font-medium" style={{ color: statusDot[doc.status] ?? '#94a3b8' }}>{STATUS_LABEL[doc.status] ?? doc.status}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {doc.status === 'failed' && (
          <button onClick={() => onRetry(doc.id)} title="Retry processing" className="rounded p-1 text-merris-text-tertiary hover:text-merris-primary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          </button>
        )}
        <button onClick={() => onDelete(doc.id)} title="Delete" className="rounded p-1 text-merris-text-tertiary hover:text-red-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Panel (Ask AI)
// ─────────────────────────────────────────────────────────────────────────────

function CitationCard({ num, source }: { num: number; source: SourceItem }) {
  return (
    <div className="rounded-lg border border-merris-border bg-merris-surface-low px-3 py-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-merris-primary font-mono text-[9px] font-bold text-white">{num}</span>
        <span className="min-w-0 flex-1 truncate font-body text-[10px] font-semibold text-merris-text">{source.documentName}</span>
        {source.page != null && <span className="shrink-0 font-body text-[10px] text-merris-text-tertiary">p.{source.page}</span>}
        <span className={`shrink-0 font-mono text-[9px] font-bold ${source.score < 0.1 ? 'text-amber-600' : 'text-merris-primary'}`}>{Math.round(source.score * 100)}%</span>
      </div>
      <p className="font-body text-[11px] italic leading-relaxed text-merris-text-secondary line-clamp-2">&ldquo;{source.content}&rdquo;</p>
    </div>
  );
}

function AssistantMessage({ msg, onFollowUp }: { msg: ChatMessage; onFollowUp: (q: string) => void }) {
  const [showSources, setShowSources] = useState(false);
  return (
    <div className="flex gap-3">
      {/* avatar */}
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-merris-primary">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      </div>
      <div className="min-w-0 flex-1">
        {/* meta */}
        <div className="mb-2 flex items-center gap-2">
          <span className="font-display text-[12px] font-semibold text-merris-text">Merris</span>
          <span className="font-body text-[10px] text-merris-text-tertiary">·</span>
          {msg.answeredInMs != null && <span className="font-body text-[10px] text-merris-text-tertiary">Answered in {(msg.answeredInMs / 1000).toFixed(1)}s</span>}
          {msg.passageCount != null && <span className="font-body text-[10px] text-merris-text-tertiary">· {msg.passageCount} passages reviewed</span>}
        </div>

        {/* low confidence warning */}
        {msg.lowConfidence && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" className="shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span className="font-display text-[11px] font-semibold text-amber-700">Low confidence — document may be image-heavy</span>
            </div>
            <p className="mb-2 font-body text-[10px] leading-relaxed text-amber-600">
              This document may contain scanned pages, charts, or image-based content. The AI could not extract sufficient text. To ask about images, charts, or visual data inside this document, retry processing with OCR enabled.
            </p>
            <div className="flex gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-body text-[9px] font-semibold text-amber-700">→ Delete &amp; re-upload to trigger OCR</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-body text-[9px] font-semibold text-amber-700">→ Try rephrasing your question</span>
            </div>
          </div>
        )}

        {/* answer */}
        <div className="mb-3">
          <MarkdownText text={msg.content} />
        </div>

        {/* citation cards */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="mb-3">
            <button onClick={() => setShowSources(v => !v)} className="mb-2 flex items-center gap-1 font-body text-[11px] text-merris-text-secondary hover:text-merris-primary">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{showSources ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}</svg>
              {showSources ? 'Hide' : 'Show'} {msg.sources.length} source{msg.sources.length !== 1 ? 's' : ''}
            </button>
            {showSources && (
              <div className="grid grid-cols-2 gap-2">
                {msg.sources.map((s, i) => <CitationCard key={s.chunkId} num={i + 1} source={s} />)}
              </div>
            )}
          </div>
        )}

        {/* action bar */}
        <div className="mb-3 flex items-center gap-3 border-t border-merris-border pt-2">
          {[
            { label: 'Copy', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> },
            { label: 'Regenerate', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> },
            { label: 'Helpful', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg> },
            { label: 'Not quite', icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg> },
          ].map(a => (
            <button key={a.label} className="flex items-center gap-1 font-body text-[10px] text-merris-text-tertiary hover:text-merris-text">
              {a.icon} {a.label}
            </button>
          ))}
          <button className="ml-auto flex items-center gap-1 rounded-lg border border-merris-border px-2.5 py-1 font-body text-[10px] text-merris-text-secondary hover:border-merris-primary hover:text-merris-primary">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Insert into memo
          </button>
        </div>

        {/* follow-up suggestions */}
        {msg.followUps && msg.followUps.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Follow up</span>
            {msg.followUps.map((q, i) => (
              <button key={i} onClick={() => onFollowUp(q)}
                className="rounded-full border border-merris-border bg-white px-3 py-1 font-body text-[11px] text-merris-text-secondary hover:border-merris-primary hover:text-merris-primary">
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#e8f5f0] px-4 py-3">
        <p className="font-body text-[13px] leading-relaxed text-merris-text">{content}</p>
      </div>
    </div>
  );
}

function ChatPanel({ workspaceId, documents }: { workspaceId: string; documents: VaultDocument[] }) {
  const indexed = documents.filter(d => d.status === 'indexed');
  const storageKey = `merris_convs_${workspaceId}`;

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]'); } catch { return []; }
  });
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as Conversation[];
      return stored[0]?.id ?? null;
    } catch { return null; }
  });
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [filterDocIds, setFilterDocIds] = useState<Set<string>>(new Set());
  const [showDocPicker, setShowDocPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find(c => c.id === activeId) ?? null;

  function saveConversations(convs: Conversation[]) {
    setConversations(convs);
    localStorage.setItem(storageKey, JSON.stringify(convs.slice(0, 30)));
  }

  function addMessage(convId: string, msg: ChatMessage) {
    setConversations(prev => {
      const next = prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, msg] } : c);
      localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 30)));
      return next;
    });
  }

  function newConversation() {
    setActiveId(null);
    setInputText('');
    inputRef.current?.focus();
  }

  async function sendMessage(text: string) {
    const q = text.trim();
    if (!q || sending) return;

    let convId = activeId;

    if (!convId || !conversations.find(c => c.id === convId)) {
      const newConv: Conversation = { id: rid(), title: q.slice(0, 55), createdAt: Date.now(), messages: [] };
      convId = newConv.id;
      const updated = [newConv, ...conversations];
      saveConversations(updated);
      setActiveId(convId);
    }

    const userMsg: ChatMessage = { id: rid(), role: 'user', content: q, timestamp: Date.now() };
    addMessage(convId, userMsg);
    setSending(true);
    setInputText('');

    try {
      const conv = conversations.find(c => c.id === convId);
      const prevMsgs = (conv?.messages ?? []).slice(-6).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const docIds = filterDocIds.size > 0 ? Array.from(filterDocIds) : undefined;

      const result = await api.askVault(workspaceId, q, docIds, 15, prevMsgs);

      const aMsg: ChatMessage = {
        id: rid(), role: 'assistant', content: result.answer, timestamp: Date.now(),
        sources: result.sources, followUps: result.followUpSuggestions,
        lowConfidence: result.lowConfidence, answeredInMs: result.answeredInMs,
        passageCount: result.passageCount,
      };
      addMessage(convId, aMsg);
    } catch {
      addMessage(convId, { id: rid(), role: 'assistant', content: 'Failed to get an answer. Please try again.', timestamp: Date.now() });
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeId]);

  const totalChunks = indexed.reduce((s, d) => s + d.chunkCount, 0);
  const scopeLabel = filterDocIds.size === 0
    ? `${indexed.length} document${indexed.length !== 1 ? 's' : ''} · ${totalChunks} chunks`
    : `${filterDocIds.size} document${filterDocIds.size !== 1 ? 's' : ''} selected`;

  return (
    <div className="flex" style={{ height: 'calc(100vh - 380px)', minHeight: 580 }}>
      {/* ── Sidebar ── */}
      <div className="flex w-56 shrink-0 flex-col border-r border-merris-border bg-merris-surface-low">
        <div className="p-3">
          <button onClick={newConversation}
            className="flex w-full items-center gap-2 rounded-lg border border-merris-border bg-white px-3 py-2 font-body text-[12px] text-merris-text-secondary hover:border-merris-primary hover:text-merris-primary">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New conversation
          </button>
        </div>

        {conversations.length > 0 && (
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            <p className="mb-2 px-1 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Recent</p>
            {conversations.map(c => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className={`mb-0.5 w-full rounded-lg px-3 py-2 text-left transition-colors ${c.id === activeId ? 'bg-merris-primary-bg' : 'hover:bg-white'}`}>
                <p className={`truncate font-body text-[11px] font-medium ${c.id === activeId ? 'text-merris-primary' : 'text-merris-text'}`}>{c.title}</p>
                <p className="font-body text-[9px] text-merris-text-tertiary">{relTime(c.createdAt)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Main conversation area ── */}
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        {!activeConv ? (
          // Empty state
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-merris-primary-bg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <p className="font-display text-[16px] font-semibold text-merris-text">Ask Merris anything</p>
              <p className="mt-1 font-body text-[12px] text-merris-text-secondary">Answers are grounded in your indexed documents with inline citations.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {['What are the key ESG metrics in these reports?', 'How do the two documents differ on Scope 3?', 'What are the net-zero targets mentioned?'].map(q => (
                <button key={q} onClick={() => { setInputText(q); inputRef.current?.focus(); }}
                  className="rounded-full border border-merris-border bg-merris-surface-low px-3 py-1.5 font-body text-[11px] text-merris-text-secondary hover:border-merris-primary hover:text-merris-primary">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div className="flex items-center gap-3 border-b border-merris-border px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[14px] font-semibold text-merris-text">{activeConv.title}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded-full bg-merris-surface-low px-2 py-0.5 font-body text-[10px] text-merris-text-secondary">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    {scopeLabel}
                  </span>
                  <span className="font-body text-[10px] text-merris-text-tertiary">Powered by Claude · cited verbatim</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {[
                  <svg key="b" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>,
                  <svg key="s" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
                  <svg key="d" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
                ].map((icon, i) => (
                  <button key={i} className="rounded-lg p-1.5 text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text">{icon}</button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
              {activeConv.messages.map(msg => (
                <div key={msg.id}>
                  {msg.role === 'user'
                    ? <UserBubble content={msg.content} />
                    : <AssistantMessage msg={msg} onFollowUp={q => sendMessage(q)} />}
                </div>
              ))}
              {sending && (
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-merris-primary">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-merris-primary [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-merris-primary [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-merris-primary [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}

        {/* ── Input area ── */}
        <div className="border-t border-merris-border bg-white px-5 py-4">
          {/* Document scope chips */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Searching in</span>
            {indexed.map(doc => {
              const active = filterDocIds.size === 0 || filterDocIds.has(doc.id);
              return (
                <button key={doc.id}
                  onClick={() => setFilterDocIds(prev => {
                    const next = new Set(prev);
                    if (filterDocIds.size === 0) {
                      indexed.forEach(d => { if (d.id !== doc.id) next.add(d.id); });
                    } else if (next.has(doc.id)) {
                      next.delete(doc.id);
                      if (next.size === 0) return new Set();
                    } else {
                      next.add(doc.id);
                    }
                    return next;
                  })}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-[10px] transition-colors ${active ? 'border-merris-primary bg-merris-primary-bg text-merris-primary' : 'border-merris-border text-merris-text-tertiary hover:border-merris-primary'}`}>
                  <FormatBadge ext={doc.format} />
                  <span className="max-w-[120px] truncate">{doc.filename.replace(/\.[^.]+$/, '')}</span>
                  {active && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              );
            })}
          </div>

          {/* Text input */}
          <div className="relative flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); } }}
              placeholder={activeConv ? 'Ask a follow-up…' : 'Ask a question about your documents…'}
              rows={1}
              style={{ resize: 'none', minHeight: 40 }}
              className="flex-1 overflow-hidden rounded-xl border border-merris-border bg-merris-surface-low px-4 py-2.5 font-body text-[13px] text-merris-text outline-none placeholder:text-merris-text-tertiary focus:border-merris-primary"
            />
            <button
              disabled={sending || !inputText.trim()}
              onClick={() => sendMessage(inputText)}
              className="flex items-center gap-1.5 rounded-xl bg-merris-primary px-4 py-2.5 font-display text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-40">
              {sending
                ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
              Ask Merris
            </button>
          </div>
          <p className="mt-1.5 font-body text-[10px] text-merris-text-tertiary">Answers are grounded in your selected documents only. Citations link back to the source page.</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compare Interface
// ─────────────────────────────────────────────────────────────────────────────

function CompareInterface({ workspaceId, documents }: { workspaceId: string; documents: VaultDocument[] }) {
  const indexed = documents.filter(d => d.status === 'indexed');
  const histKey = `merris_comps_${workspaceId}`;

  const [docA, setDocA] = useState<VaultDocument | null>(null);
  const [docB, setDocB] = useState<VaultDocument | null>(null);
  const [angles, setAngles] = useState<Set<string>>(new Set(['auto']));
  const [focusTopic, setFocusTopic] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<{
    dimensions: Array<{ name: string; comparisons: Array<{ documentId: string; documentName: string; summary: string }> }>;
    overallAnalysis: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ComparisonRun[]>(() => {
    try { return JSON.parse(localStorage.getItem(histKey) ?? '[]'); } catch { return []; }
  });

  function toggleAngle(id: string) {
    setAngles(prev => {
      const next = new Set(prev);
      if (id === 'auto') return new Set(['auto']);
      next.delete('auto');
      next.has(id) ? next.delete(id) : next.add(id);
      return next.size === 0 ? new Set(['auto']) : next;
    });
  }

  function swapDocs() { const t = docA; setDocA(docB); setDocB(t); }

  const filterTabs = ['all', 'advisory', 'audit', 'regulatory', 'internal'];
  const filteredDocs = filterTab === 'all' ? indexed : indexed.filter(d => d.classification.toLowerCase().includes(filterTab));

  async function runComparison() {
    if (!docA || !docB) return;
    setComparing(true); setResult(null); setError(null);

    const selectedDims = Array.from(angles)
      .filter(a => a !== 'auto')
      .map(id => COMPARISON_ANGLES.find(a => a.id === id)?.dim ?? '')
      .filter(Boolean);

    try {
      const res = await api.compareVaultDocuments(
        workspaceId, [docA.id, docB.id],
        selectedDims.length > 0 ? selectedDims : undefined,
        focusTopic || undefined
      );
      setResult(res);

      const run: ComparisonRun = {
        id: rid(), docAName: docA.filename.replace(/\.[^.]+$/, ''),
        docBName: docB.filename.replace(/\.[^.]+$/, ''),
        angles: Array.from(angles), runAt: Date.now(), label: 'Cross',
      };
      const updated = [run, ...history].slice(0, 10);
      setHistory(updated);
      localStorage.setItem(histKey, JSON.stringify(updated));
    } catch {
      setError('Comparison failed. Please try again.');
    } finally {
      setComparing(false);
    }
  }

  const canRun = docA !== null && docB !== null && docA.id !== docB.id;

  return (
    <div className="relative flex gap-5">
      {/* ── Main content ── */}
      <div className="min-w-0 flex-1 pb-20">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-[16px] font-semibold text-merris-text">Compare documents</h3>
            <p className="font-body text-[12px] text-merris-text-secondary">Drop two documents into the slots below. Merris will surface differences in methodology, language and figures — cited, side-by-side, and exportable.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setHistory([])} className="flex items-center gap-1.5 rounded-lg border border-merris-border px-3 py-1.5 font-body text-[11px] text-merris-text-secondary hover:border-merris-primary hover:text-merris-primary">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Past runs
            </button>
            <button onClick={swapDocs} disabled={!docA && !docB}
              className="flex items-center gap-1.5 rounded-lg border border-merris-border px-3 py-1.5 font-body text-[11px] text-merris-text-secondary hover:border-merris-primary hover:text-merris-primary disabled:opacity-40">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
              Swap A→B
            </button>
          </div>
        </div>

        {/* Document slots */}
        <div className="mb-5 grid grid-cols-[1fr_48px_1fr] items-center gap-0">
          {/* Slot A */}
          <DocumentSlot label="DOCUMENT A" doc={docA} onRemove={() => setDocA(null)} />
          <div className="flex items-center justify-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-merris-border bg-white font-display text-[12px] font-bold text-merris-text-tertiary">VS</span>
          </div>
          {/* Slot B */}
          <DocumentSlot label="DOCUMENT B" doc={docB} onRemove={() => setDocB(null)} />
        </div>

        {/* Comparison angles */}
        <div className="mb-4 rounded-xl border border-merris-border bg-white p-4">
          <p className="mb-3 font-body text-[11px] text-merris-text-secondary">Comparison angles <span className="text-merris-text-tertiary">· optional, choose any</span></p>
          <div className="flex flex-wrap gap-2">
            {COMPARISON_ANGLES.map(a => {
              const sel = angles.has(a.id);
              return (
                <button key={a.id} onClick={() => toggleAngle(a.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-body text-[11px] transition-colors ${sel ? 'border-merris-primary bg-merris-primary text-white' : 'border-merris-border text-merris-text-secondary hover:border-merris-primary hover:text-merris-primary'}`}>
                  {sel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  {a.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-merris-border px-3 py-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              value={focusTopic}
              onChange={e => setFocusTopic(e.target.value)}
              placeholder='Or focus on a topic — e.g. "supplier engagement" or "double materiality"'
              className="flex-1 bg-transparent font-body text-[12px] text-merris-text outline-none placeholder:text-merris-text-tertiary"
            />
          </div>
        </div>

        {/* Document picker */}
        <div className="rounded-xl border border-merris-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-[13px] font-semibold text-merris-text">
              Pick documents <span className="font-body font-normal text-merris-text-tertiary">· {indexed.length} in scope</span>
            </p>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 rounded-lg border border-merris-border px-2.5 py-1 font-body text-[10px] text-merris-text-secondary hover:border-merris-primary">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Filter
              </button>
              <button className="flex items-center gap-1 rounded-lg border border-merris-border px-2.5 py-1 font-body text-[10px] text-merris-text-secondary hover:border-merris-primary">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                Search
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="mb-3 flex gap-1.5">
            {filterTabs.map(t => (
              <button key={t} onClick={() => setFilterTab(t)}
                className={`rounded-full px-3 py-1 font-body text-[11px] capitalize transition-colors ${filterTab === t ? 'bg-merris-primary text-white' : 'border border-merris-border text-merris-text-secondary hover:border-merris-primary'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Document grid */}
          {filteredDocs.length === 0 ? (
            <p className="py-6 text-center font-body text-[12px] text-merris-text-tertiary">No verified documents in this category.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredDocs.map(doc => (
                <DocumentPickerCard key={doc.id} doc={doc}
                  isA={docA?.id === doc.id} isB={docB?.id === doc.id}
                  onSetA={() => { if (docB?.id === doc.id) setDocB(null); setDocA(doc); }}
                  onSetB={() => { if (docA?.id === doc.id) setDocA(null); setDocB(doc); }} />
              ))}
            </div>
          )}
        </div>

        {/* Comparison results */}
        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-body text-[12px] text-red-700">{error}</div>}
        {result && (
          <div className="mt-4 rounded-xl border border-merris-border bg-white">
            <div className="border-b border-merris-border px-5 py-4">
              <p className="font-display text-[14px] font-semibold text-merris-text">Comparison Results</p>
              <p className="mt-1 font-body text-[12px] leading-relaxed text-merris-text-secondary">{result.overallAnalysis}</p>
            </div>
            {result.dimensions.map(dim => (
              <div key={dim.name} className="border-b border-merris-border px-5 py-4 last:border-0">
                <p className="mb-3 font-display text-[12px] font-semibold capitalize text-merris-text">{dim.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  {dim.comparisons.map(c => (
                    <div key={c.documentId} className="rounded-lg bg-merris-surface-low px-3 py-2.5">
                      <p className="mb-1 truncate font-body text-[10px] font-semibold text-merris-primary">{c.documentName}</p>
                      <p className="font-body text-[11px] leading-relaxed text-merris-text-secondary">{c.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right sidebar ── */}
      <div className="hidden w-[260px] shrink-0 space-y-4 lg:block">
        {/* Recent comparisons */}
        <div className="rounded-xl border border-merris-border bg-white p-4">
          <p className="mb-3 font-display text-[13px] font-semibold text-merris-text">Recent comparisons</p>
          {history.length === 0 ? (
            <p className="font-body text-[11px] text-merris-text-tertiary">No comparisons yet. Run one to see results here.</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 5).map(h => (
                <div key={h.id} className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase ${h.label === 'YoY' ? 'bg-blue-100 text-blue-700' : h.label === 'Cross' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>{h.label}</span>
                  <div className="min-w-0">
                    <p className="truncate font-body text-[11px] font-medium text-merris-text">{h.docAName} vs. {h.docBName}</p>
                    <p className="font-body text-[9px] text-merris-text-tertiary">{relTime(h.runAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* What you'll get back */}
        <div className="rounded-xl border border-merris-border bg-white p-4">
          <p className="mb-2 font-display text-[13px] font-semibold text-merris-text">What you&apos;ll get back</p>
          <p className="font-body text-[11px] leading-relaxed text-merris-text-secondary">
            A passage-level diff: figures aligned in a single view, conflicting claims highlighted with citations, and a short executive summary you can drop straight into a client memo.
          </p>
        </div>

        {/* Sample output shape */}
        <div className="rounded-xl border border-merris-border bg-white p-4">
          <p className="mb-3 font-body text-[10px] font-semibold text-merris-text-tertiary">Sample output shape</p>
          {[['Material topic alignment', 80], ['Disclosure depth (pp)', 70], ['Citations / claim', 55]].map(([label, pct]) => (
            <div key={label as string} className="mb-2">
              <p className="mb-1 font-body text-[10px] text-merris-text-secondary">{label as string}</p>
              <div className="h-1.5 w-full rounded-full bg-merris-surface-low">
                <div className="h-1.5 rounded-full bg-merris-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sticky run CTA ── */}
      {canRun && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-merris-border bg-merris-primary px-6 py-3 lg:left-[var(--sidebar-w,256px)]">
          <div>
            <p className="font-display text-[13px] font-semibold text-white">Ready to compare</p>
            <p className="font-body text-[11px] text-white/80">
              {docA!.filename.replace(/\.[^.]+$/, '')} vs. {docB!.filename.replace(/\.[^.]+$/, '')} · {angles.size} angle{angles.size !== 1 ? 's' : ''} · est. {10 + angles.size * 4}s
            </p>
          </div>
          <button onClick={runComparison} disabled={comparing}
            className="flex items-center gap-2 rounded-xl border-2 border-white/30 bg-white/10 px-5 py-2.5 font-display text-[13px] font-semibold text-white hover:bg-white/20 disabled:opacity-60">
            {comparing ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>}
            {comparing ? 'Comparing…' : 'Run comparison'}
          </button>
        </div>
      )}
    </div>
  );
}

function DocumentSlot({ label, doc, onRemove }: { label: string; doc: VaultDocument | null; onRemove: () => void }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${doc ? 'border-merris-primary bg-white' : 'border-dashed border-merris-border bg-merris-surface-low'}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">{label}</span>
        {doc && <button onClick={onRemove} className="text-merris-text-tertiary hover:text-red-500"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>}
      </div>
      {doc ? (
        <>
          <div className="flex items-start gap-3">
            <DocMiniThumb ext={doc.format} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] font-semibold leading-tight text-merris-text">{doc.filename.replace(/\.[^.]+$/, '')}</p>
              <p className="mt-0.5 truncate font-body text-[10px] text-merris-text-tertiary">{doc.filename}</p>
              <p className="mt-0.5 font-body text-[10px] text-merris-text-tertiary">{doc.pageCount} pages · {doc.chunkCount} chunks · v{doc.version}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 font-body text-[9px] text-green-700"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Verified</span>
                <span className="rounded-full bg-merris-surface-low px-2 py-0.5 font-body text-[9px] capitalize text-merris-text-secondary">{doc.classification}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[['Pages', doc.pageCount ?? 0], ['Chunks', doc.chunkCount]].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-merris-surface-low px-2 py-1.5 text-center">
                <p className="font-display text-[16px] font-bold text-merris-text">{v}</p>
                <p className="font-body text-[8px] uppercase tracking-wider text-merris-text-tertiary">{k}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex h-[100px] flex-col items-center justify-center gap-2 text-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p className="font-body text-[11px] text-merris-text-tertiary">Pick a document below</p>
        </div>
      )}
    </div>
  );
}

function DocumentPickerCard({ doc, isA, isB, onSetA, onSetB }: { doc: VaultDocument; isA: boolean; isB: boolean; onSetA: () => void; onSetB: () => void }) {
  return (
    <div className={`rounded-xl border-2 p-3 ${isA || isB ? 'border-merris-primary' : 'border-merris-border'}`}>
      <div className="mb-2.5 flex items-start gap-2.5">
        {isA || isB ? (
          <div className="relative">
            <DocMiniThumb ext={doc.format} />
            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-merris-primary">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        ) : <DocMiniThumb ext={doc.format} />}
        <div className="min-w-0 flex-1">
          <p className="font-display text-[12px] font-semibold leading-tight text-merris-text">{doc.filename.replace(/\.[^.]+$/, '')}</p>
          <p className="mt-0.5 truncate font-body text-[9px] text-merris-text-tertiary">{doc.filename}</p>
          <p className="mt-0.5 font-body text-[9px] text-merris-text-tertiary">{doc.pageCount} pages · {doc.chunkCount} chunks · {fmtSize(doc.size)}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 font-body text-[8px] text-green-700"><svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Verified</span>
            <span className="rounded-full bg-merris-surface-low px-1.5 py-0.5 font-body text-[8px] capitalize text-merris-text-secondary">{doc.classification}</span>
          </div>
          <p className="mt-1 font-body text-[9px] text-merris-text-tertiary">{fmtDate(doc.uploadedAt)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={onSetA}
          className={`rounded-lg py-1.5 font-display text-[10px] font-semibold transition-colors ${isA ? 'bg-merris-primary text-white' : 'border border-merris-border text-merris-text-secondary hover:border-merris-primary hover:text-merris-primary'}`}>
          {isA ? '✓ SLOT A' : 'USE AS A'}
        </button>
        <button onClick={onSetB}
          className={`rounded-lg py-1.5 font-display text-[10px] font-semibold transition-colors ${isB ? 'bg-merris-primary text-white' : 'border border-merris-border text-merris-text-secondary hover:border-merris-primary hover:text-merris-primary'}`}>
          {isB ? '✓ SLOT B' : 'USE AS B'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Jobs Panel
// ─────────────────────────────────────────────────────────────────────────────

function JobsPanel({ workspaceId }: { workspaceId: string }) {
  const [jobs, setJobs] = useState<Array<{ jobId: string; filename: string; format: string; status: string; startedAt: string; updatedAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!workspaceId) return;
    try { const d = await api.listVaultJobs(workspaceId); setJobs(d.jobs); }
    catch { /* non-critical */ } finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => {
    fetchJobs();
    pollRef.current = setInterval(fetchJobs, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchJobs]);

  const STATUS_COLOR: Record<string, string> = { queued: '#94a3b8', parsing: merrisTokens.primary, chunking: merrisTokens.primary, embedding: merrisTokens.primary };
  const STATUS_LABEL2: Record<string, string> = { queued: 'Queued', parsing: 'Parsing', chunking: 'Chunking', embedding: 'Embedding' };

  return (
    <div className="rounded-xl border border-merris-border bg-white">
      <div className="flex items-center gap-2 border-b border-merris-border px-4 py-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span className="font-display text-[13px] font-semibold text-merris-text">Processing Jobs</span>
        <span className="ml-auto font-body text-[10px] text-merris-text-tertiary">Refreshes every 5s</span>
        <button onClick={fetchJobs} className="text-merris-text-tertiary hover:text-merris-primary">
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
          <div className="flex items-center gap-3 border-b border-merris-border bg-merris-surface-low px-4 py-2">
            {['Type', 'File', 'Stage', 'Last update'].map((h, i) => (
              <div key={h} className={`font-body text-[10px] uppercase tracking-wider text-merris-text-tertiary ${i === 0 ? 'w-12 shrink-0' : i === 1 ? 'min-w-0 flex-1' : i === 2 ? 'w-24 shrink-0' : 'w-32 shrink-0 text-right'}`}>{h}</div>
            ))}
          </div>
          {jobs.map(job => (
            <div key={job.jobId} className="flex items-center gap-3 border-b border-merris-border px-4 py-3 last:border-0">
              <div className="w-12 shrink-0"><FormatBadge ext={job.format} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-body text-[12px] font-medium text-merris-text">{job.filename}</div>
                <div className="font-body text-[10px] text-merris-text-tertiary">Started {fmtTime(job.startedAt)}</div>
              </div>
              <div className="flex w-24 shrink-0 items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[job.status] ?? '#94a3b8' }} />
                <span className="font-body text-[11px]" style={{ color: STATUS_COLOR[job.status] ?? '#94a3b8' }}>{STATUS_LABEL2[job.status] ?? job.status}</span>
              </div>
              <div className="w-32 shrink-0 text-right font-body text-[10px] text-merris-text-tertiary">{fmtTime(job.updatedAt)}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'documents' | 'ask' | 'compare' | 'jobs';

export function KnowledgePage() {
  const user = useAuthStore(s => s.user);
  const workspaceId = user?.orgId ?? '';

  const { documents, stats, loading, uploading, searchResults, searching, fetchDocuments, fetchStats, uploadDocument, deleteDocument, retryDocument, search, clearSearch } = useVaultKBStore();

  const [tab, setTab] = useState<Tab>('documents');
  const [showUpload, setShowUpload] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number>(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(() => {
    if (!workspaceId) return;
    fetchDocuments(workspaceId);
    fetchStats(workspaceId);
    setLastSynced(Date.now());
  }, [workspaceId, fetchDocuments, fetchStats]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => {
      const hasInFlight = useVaultKBStore.getState().documents.some(d => !['indexed', 'failed'].includes(d.status));
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

  async function handleDelete(id: string) {
    if (!confirm('Delete this document and all its indexed data?')) return;
    await deleteDocument(workspaceId, id); showToast('Document deleted');
  }

  async function handleRetry(id: string) {
    await retryDocument(workspaceId, id); showToast('Document queued for reprocessing');
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) search(workspaceId, query.trim()); else clearSearch();
  }

  const displayDocs = searchResults.length > 0
    ? documents.filter(d => searchResults.some(r => r.documentId === d.id))
    : documents;

  const syncLabel = (() => {
    const d = Date.now() - lastSynced;
    if (d < 60000) return 'Synced just now';
    return `Synced ${Math.floor(d / 60000)}m ago`;
  })();

  const TABS: { id: Tab; label: string }[] = [
    { id: 'documents', label: 'Documents' },
    { id: 'ask',       label: 'Ask AI' },
    { id: 'compare',   label: 'Compare' },
    { id: 'jobs',      label: 'Jobs' },
  ];

  const TAB_ICONS: Record<Tab, React.ReactNode> = {
    documents: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    ask:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 110 20"/><path d="M12 8a4 4 0 010 8"/><circle cx="12" cy="12" r="1"/></svg>,
    compare:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>,
    jobs:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4] p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-[24px] font-bold text-merris-text">Knowledge Base</h1>
          <p className="mt-1 font-body text-[12px] text-merris-text-secondary">
            Upload documents your firm uses internally. Ask Merris questions, run cross-document<br />comparisons, and build firm-grade ESG intelligence from your own sources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-xl border border-merris-border bg-white px-4 py-2 font-display text-[12px] font-semibold text-merris-text-secondary hover:border-merris-primary hover:text-merris-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            Connect source
          </button>
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-xl bg-merris-primary px-4 py-2 font-display text-[12px] font-semibold text-white hover:opacity-90">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Upload
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 flex gap-4">
        <StatCard label="Total"      value={stats.total}      sub={syncLabel}            color={merrisTokens.text} />
        <StatCard label="Verified"   value={stats.indexed}    sub={stats.total > 0 ? `${Math.round(stats.indexed / stats.total * 100)}% coverage` : '—'} color="#22c55e" />
        <StatCard label="Processing" value={stats.processing} sub={stats.processing === 0 ? 'Idle queue' : 'In progress…'} color={merrisTokens.primary} />
        <StatCard label="Failed"     value={stats.failed}     sub={stats.failed === 0 ? 'No retries needed' : 'Needs attention'} color="#ef4444" />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-0 rounded-xl border border-merris-border bg-white p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-display text-[12px] font-semibold transition-all ${tab === t.id ? 'bg-merris-primary text-white shadow-sm' : 'text-merris-text-tertiary hover:text-merris-text'}`}>
            <span className={tab === t.id ? 'text-white' : 'text-merris-text-tertiary'}>{TAB_ICONS[t.id]}</span>
            {t.label}
            {t.id === 'documents' && stats.total > 0 && (
              <span className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] font-bold ${tab === t.id ? 'bg-white/20 text-white' : 'bg-merris-primary text-white'}`}>{stats.total}</span>
            )}
            {t.id === 'jobs' && stats.processing > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 font-mono text-[10px] font-bold text-white">{stats.processing}</span>
            )}
          </button>
        ))}
      </div>

      {/* Documents tab */}
      {tab === 'documents' && (
        <>
          <form onSubmit={handleSearch} className="mb-5">
            <div className="flex items-center gap-2 rounded-xl border border-merris-border bg-white px-4 py-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search your documents… try 'Scope 3' or 'net zero' (press Enter)"
                className="flex-1 bg-transparent font-body text-[12px] text-merris-text outline-none placeholder:text-merris-text-tertiary" />
              {searching && <span className="font-body text-[10px] text-merris-text-tertiary">Searching…</span>}
              {query && <button type="button" onClick={() => { setQuery(''); clearSearch(); }} className="text-merris-text-tertiary hover:text-merris-text"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>}
              <kbd className="rounded border border-merris-border px-1.5 py-0.5 font-mono text-[9px] text-merris-text-tertiary">⌘K</kbd>
            </div>
          </form>

          {searchResults.length > 0 && (
            <div className="mb-5 space-y-2">
              <div className="font-body text-[11px] text-merris-text-secondary">{searchResults.length} matching chunks for &ldquo;{query}&rdquo;</div>
              {searchResults.slice(0, 5).map(r => (
                <div key={r.chunkId} className="rounded-xl border border-merris-border bg-white px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-body text-[11px] italic leading-relaxed text-merris-text-secondary line-clamp-2">&ldquo;{r.content}&rdquo;</div>
                      <div className="mt-1 font-body text-[10px] text-merris-text-tertiary">{r.section} · page {r.page}</div>
                    </div>
                    <div className="shrink-0 font-body text-[10px] text-merris-primary">{Math.round(r.score * 100)}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-merris-border bg-white">
            <div className="flex items-center gap-3 border-b border-merris-border bg-merris-surface-low px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
              <div className="w-12 shrink-0">Type</div>
              <div className="min-w-0 flex-1">Document</div>
              <div className="hidden w-32 shrink-0 sm:block">Class</div>
              <div className="hidden w-24 shrink-0 text-right sm:block">Uploaded</div>
              <div className="w-24 shrink-0 text-right">Status</div>
              <div className="w-16 shrink-0" />
            </div>
            {loading && documents.length === 0 ? (
              <div className="px-4 py-10 text-center font-body text-[12px] text-merris-text-tertiary">Loading…</div>
            ) : displayDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.2" className="mb-3"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                <p className="font-body text-[12px] text-merris-text-secondary">No documents yet</p>
                <p className="mt-1 font-body text-[11px] text-merris-text-tertiary">Upload your first document to get started</p>
                <button onClick={() => setShowUpload(true)} className="mt-4 rounded-xl bg-merris-primary px-4 py-2 font-display text-[11px] font-semibold text-white hover:opacity-90">Upload Document</button>
              </div>
            ) : (
              displayDocs.map(doc => <DocRow key={doc.id} doc={doc} onDelete={handleDelete} onRetry={handleRetry} />)
            )}
          </div>
        </>
      )}

      {/* Ask AI tab */}
      {tab === 'ask' && (
        stats.indexed > 0
          ? <ChatPanel workspaceId={workspaceId} documents={documents} />
          : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-merris-border bg-white py-16 text-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <p className="font-body text-[12px] text-merris-text-secondary">No verified documents yet.</p>
              <p className="font-body text-[11px] text-merris-text-tertiary">Upload a document and wait for it to be indexed before asking questions.</p>
            </div>
          )
      )}

      {/* Compare tab */}
      {tab === 'compare' && (
        documents.filter(d => d.status === 'indexed').length < 2
          ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-merris-border bg-white py-16 text-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.2"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
              <p className="font-body text-[12px] text-merris-text-secondary">You need at least 2 verified documents to compare.</p>
            </div>
          )
          : <CompareInterface workspaceId={workspaceId} documents={documents} />
      )}

      {/* Jobs tab */}
      {tab === 'jobs' && <JobsPanel workspaceId={workspaceId} />}

      {/* Upload modal */}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUpload={handleUpload} />}

      {/* Uploading indicator */}
      {uploading && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-xl border border-merris-border bg-white px-4 py-2.5 shadow-lg">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-merris-primary border-t-transparent" />
          <span className="font-body text-[12px] text-merris-text">Uploading…</span>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl border border-merris-border bg-white px-5 py-2.5 shadow-lg">
          <span className="font-body text-[12px] text-merris-text">{toast}</span>
        </div>
      )}
    </div>
  );
}
