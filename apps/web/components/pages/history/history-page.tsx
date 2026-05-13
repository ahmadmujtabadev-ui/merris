'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/chat-store';
import { useHistoryStore } from '@/lib/store';
import type { HistoryEntry } from '@/lib/store';

function relTime(ts?: string): string {
  if (!ts) return '';
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  if (d < 172800000) return 'Yesterday';
  return `${Math.floor(d / 86400000)} days ago`;
}

function fmtDate(ts?: string): string {
  if (!ts) return 'Unknown date';
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function groupByDate(entries: HistoryEntry[]): Record<string, HistoryEntry[]> {
  const groups: Record<string, HistoryEntry[]> = {};
  for (const e of entries) {
    const key = fmtDate(e.timestamp);
    (groups[key] ??= []).push(e);
  }
  return groups;
}

export function HistoryPage() {
  const { entries, loading, fetchHistory } = useHistoryStore();
  const setPendingQuestion = useChatStore((s) => s.setPendingQuestion);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (selected) {
      const refreshed = entries.find((e) => e.id === selected.id);
      if (refreshed) setSelected(refreshed);
    }
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editMode && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [editMode]);

  const filtered = search.trim()
    ? entries.filter(
        (e) =>
          e.text.toLowerCase().includes(search.toLowerCase()) ||
          (e.answer ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  const grouped = groupByDate(filtered);

  function handleSelect(entry: HistoryEntry) {
    setSelected(entry);
    setEditMode(false);
    setEditText(entry.text);
  }

  function handleAskOriginal() {
    if (!selected) return;
    setPendingQuestion(selected.text);
    router.push('/intelligence');
  }

  function handleStartEdit() {
    if (!selected) return;
    setEditText(selected.text);
    setEditMode(true);
  }

  function handleCancelEdit() {
    setEditMode(false);
    setEditText(selected?.text ?? '');
  }

  function handleSubmitEdit() {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setPendingQuestion(trimmed);
    router.push('/intelligence');
  }

  return (
    <div className="flex h-[calc(100vh-44px)] bg-[#f5f3ef]">
      {/* ── Left panel: conversation list ── */}
      <div className="flex w-[340px] shrink-0 flex-col border-r border-merris-border bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-merris-border px-5 py-4">
          <div>
            <h1 className="font-display text-[16px] font-bold text-merris-text">History</h1>
            <p className="font-body text-[11px] text-merris-text-tertiary">
              {loading ? 'Loading…' : `${entries.length} conversation${entries.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchHistory()}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-merris-border text-merris-text-tertiary hover:border-merris-primary hover:text-merris-primary"
            title="Refresh"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-merris-border px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-merris-border bg-[#f5f3ef] px-3 py-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-merris-text-tertiary">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent font-body text-[12px] text-merris-text outline-none placeholder:text-merris-text-tertiary"
            />
            {search && (
              <button onClick={() => setSearch('')} className="shrink-0 text-merris-text-tertiary hover:text-merris-text">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-merris-surface-low text-merris-text-tertiary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              </div>
              <p className="font-body text-[12px] text-merris-text-secondary">
                {search ? 'No conversations match your search.' : 'No conversations yet. Ask a question in Intelligence to get started.'}
              </p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-merris-text-tertiary">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/></svg>
              <span className="font-body text-[12px]">Loading…</span>
            </div>
          )}

          {Object.entries(grouped).map(([date, convs]) => (
            <div key={date}>
              <div className="sticky top-0 z-10 border-b border-merris-border bg-white px-5 py-2">
                <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">{date}</span>
              </div>
              {convs.map((entry) => {
                const isActive = selected?.id === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleSelect(entry)}
                    className={`group w-full border-b border-merris-border px-5 py-4 text-left transition-colors ${
                      isActive ? 'bg-merris-primary-bg' : 'hover:bg-[#f5f3ef]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-merris-primary text-white' : 'bg-merris-surface-low text-merris-text-tertiary'}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`line-clamp-2 font-display text-[12px] font-semibold ${isActive ? 'text-merris-primary' : 'text-merris-text'}`}>
                          {entry.text}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {entry.engagement && (
                            <span className="rounded-full bg-merris-surface-low px-1.5 py-0.5 font-body text-[9px] text-merris-text-secondary">
                              {entry.engagement}
                            </span>
                          )}
                          <span className="font-body text-[10px] text-merris-text-tertiary">
                            {relTime(entry.timestamp)}
                          </span>
                          {entry.toolsUsed && entry.toolsUsed.length > 0 && (
                            <span className="font-body text-[10px] text-merris-text-tertiary">
                              · {entry.toolsUsed.length} tool{entry.toolsUsed.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: detail / edit ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-merris-border bg-white shadow-sm">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-merris-text-tertiary">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <div>
              <p className="font-display text-[14px] font-semibold text-merris-text">Select a conversation</p>
              <p className="mt-1 font-body text-[12px] text-merris-text-tertiary">Click any entry on the left to view or edit it</p>
            </div>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div className="flex items-center gap-4 border-b border-merris-border bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => { setSelected(null); setEditMode(false); }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-merris-border bg-white text-merris-text-tertiary hover:border-merris-primary hover:text-merris-primary"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="line-clamp-1 font-display text-[14px] font-bold text-merris-text">{selected.text}</h2>
                <p className="font-body text-[11px] text-merris-text-tertiary">
                  {fmtDate(selected.timestamp)} · {relTime(selected.timestamp)}
                  {selected.engagement && ` · ${selected.engagement}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!editMode ? (
                  <>
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="flex items-center gap-1.5 rounded-lg border border-merris-border bg-white px-4 py-2 font-display text-[12px] font-bold text-merris-text shadow-sm hover:border-merris-primary hover:text-merris-primary"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit & Ask
                    </button>
                    <button
                      type="button"
                      onClick={handleAskOriginal}
                      className="flex items-center gap-1.5 rounded-lg bg-merris-primary px-4 py-2 font-display text-[12px] font-bold text-white shadow-sm hover:opacity-90"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      Ask Again
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1.5 rounded-lg border border-merris-border bg-white px-4 py-2 font-display text-[12px] font-bold text-merris-text shadow-sm hover:border-merris-border"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitEdit}
                      disabled={!editText.trim()}
                      className="flex items-center gap-1.5 rounded-lg bg-merris-primary px-4 py-2 font-display text-[12px] font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      Ask in Intelligence
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mx-auto max-w-[800px] space-y-5">

                {/* Question — editable or static */}
                <div className="overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-merris-border px-5 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-merris-primary font-display text-[10px] font-bold text-white">
                      MU
                    </div>
                    <span className="font-body text-[11px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
                      {editMode ? 'Edit your question' : `Your question · ${relTime(selected.timestamp)}`}
                    </span>
                    {!editMode && (
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        className="ml-auto flex items-center gap-1 rounded-md border border-merris-border px-2 py-1 font-body text-[10px] text-merris-text-tertiary hover:border-merris-primary hover:text-merris-primary"
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                    )}
                  </div>

                  {editMode ? (
                    <div className="px-6 py-5">
                      <textarea
                        ref={editRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSubmitEdit();
                          }
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        rows={4}
                        className="w-full resize-none rounded-xl border border-merris-primary bg-merris-primary-bg px-4 py-3 font-display text-[15px] font-semibold leading-snug text-merris-text outline-none"
                        style={{ minHeight: 100 }}
                      />
                      <p className="mt-2 font-body text-[10px] text-merris-text-tertiary">
                        <kbd className="rounded border border-merris-border px-1 py-0.5 font-mono text-[9px]">⌘</kbd>
                        <kbd className="ml-0.5 rounded border border-merris-border px-1 py-0.5 font-mono text-[9px]">↵</kbd>
                        <span className="ml-1">to send · </span>
                        <kbd className="rounded border border-merris-border px-1 py-0.5 font-mono text-[9px]">Esc</kbd>
                        <span className="ml-1">to cancel</span>
                      </p>
                    </div>
                  ) : (
                    <div className="px-6 py-5">
                      <p className="font-display text-[16px] font-semibold leading-snug text-merris-text">
                        {selected.text}
                      </p>
                    </div>
                  )}

                  {selected.toolsUsed && selected.toolsUsed.length > 0 && !editMode && (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-merris-border px-5 py-2.5">
                      <span className="font-body text-[10px] text-merris-text-tertiary">Tools used:</span>
                      {selected.toolsUsed.map((t) => (
                        <span key={t} className="rounded-full bg-merris-surface-low px-2 py-0.5 font-mono text-[9px] text-merris-text-secondary">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Merris response — full text, no truncation */}
                {!editMode && (
                  selected.answer ? (
                    <div className="overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
                      <div className="flex items-center gap-3 border-b border-merris-border px-5 py-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-merris-primary font-display text-[12px] font-bold text-white">
                          M
                        </div>
                        <div>
                          <span className="font-display text-[13px] font-bold text-merris-text">Merris</span>
                          <div className="font-body text-[10px] text-merris-text-tertiary">Advisory note · {fmtDate(selected.timestamp)}</div>
                        </div>
                        {selected.confidence && (
                          <span className={`ml-auto rounded-full px-2.5 py-1 font-body text-[10px] font-semibold ${
                            selected.confidence === 'High' ? 'bg-emerald-50 text-emerald-700' :
                            selected.confidence === 'Medium' ? 'bg-amber-50 text-amber-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {selected.confidence} confidence
                          </span>
                        )}
                      </div>
                      <div className="border-l-4 border-merris-primary px-6 py-5">
                        <p className="font-body text-[13px] leading-relaxed text-merris-text whitespace-pre-line">
                          {selected.answer}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-merris-border bg-white px-6 py-4">
                      <p className="font-body text-[12px] text-merris-text-tertiary">Response not available for this entry.</p>
                    </div>
                  )
                )}

                {/* CTA row */}
                {!editMode && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="inline-flex items-center gap-2 rounded-xl border border-merris-border bg-white px-6 py-3 font-display text-[13px] font-bold text-merris-text shadow-sm hover:border-merris-primary hover:text-merris-primary"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit & Ask
                    </button>
                    <button
                      type="button"
                      onClick={handleAskOriginal}
                      className="inline-flex items-center gap-2 rounded-xl bg-merris-primary px-6 py-3 font-display text-[13px] font-bold text-white shadow-sm hover:opacity-90"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      Ask Again in Intelligence
                    </button>
                  </div>
                )}

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
