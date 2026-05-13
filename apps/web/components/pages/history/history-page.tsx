'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore, loadSavedConversations } from '@/lib/chat-store';
import type { SavedConversation } from '@/lib/chat-store';

function relTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  if (d < 172800000) return 'Yesterday';
  return `${Math.floor(d / 86400000)} days ago`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function groupByDate(convs: SavedConversation[]): Record<string, SavedConversation[]> {
  const groups: Record<string, SavedConversation[]> = {};
  for (const c of convs) {
    const key = fmtDate(c.savedAt);
    (groups[key] ??= []).push(c);
  }
  return groups;
}

const K_COLORS: Record<string, string> = {
  K1: 'bg-[#e0f2fe] text-[#0369a1]',
  K2: 'bg-[#f0fdf4] text-[#15803d]',
  K3: 'bg-[#f5f3ff] text-[#7c3aed]',
  K4: 'bg-[#fef3c7] text-[#b45309]',
  K5: 'bg-[#f0fdfa] text-[#0f766e]',
  K6: 'bg-[#dcfce7] text-[#15803d]',
  K7: 'bg-[#fdf2f8] text-[#be185d]',
};

const FLAG: Record<string, string> = {
  Qatar: '🇶🇦', Oman: '🇴🇲', UAE: '🇦🇪', Saudi: '🇸🇦', EU: '🇪🇺', UK: '🇬🇧',
};

export function HistoryPage() {
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SavedConversation | null>(null);
  const restoreConversation = useChatStore((s) => s.restoreConversation);
  const router = useRouter();

  const reload = useCallback(() => {
    setConversations(loadSavedConversations());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.messages.some((m) => m.question.toLowerCase().includes(search.toLowerCase()))
      )
    : conversations;

  const grouped = groupByDate(filtered);

  function handleOpen(conv: SavedConversation) {
    restoreConversation(conv);
    router.push('/intelligence');
  }

  function handleDelete(id: string) {
    const updated = conversations.filter((c) => c.id !== id);
    try { localStorage.setItem('merris_saved_conversations', JSON.stringify(updated)); } catch { /* ignore */ }
    setConversations(updated);
    if (selected?.id === id) setSelected(null);
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
              {conversations.length} saved session{conversations.length !== 1 ? 's' : ''}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-body text-[10px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Local
          </span>
        </div>

        {/* Search */}
        <div className="border-b border-merris-border px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-merris-border bg-[#f5f3ef] px-3 py-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-merris-text-tertiary">
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
              <button onClick={() => setSearch('')} className="text-merris-text-tertiary hover:text-merris-text">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-merris-surface-low text-merris-text-tertiary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              </div>
              <p className="font-body text-[12px] text-merris-text-secondary">
                {search ? 'No conversations match your search.' : 'No saved conversations yet. Clear a conversation in Intelligence to save it here.'}
              </p>
            </div>
          )}

          {Object.entries(grouped).map(([date, convs]) => (
            <div key={date}>
              <div className="sticky top-0 z-10 border-b border-merris-border bg-white px-5 py-2">
                <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">{date}</span>
              </div>
              {convs.map((conv) => {
                const isActive = selected?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelected(conv)}
                    className={`group w-full border-b border-merris-border px-5 py-4 text-left transition-colors ${
                      isActive ? 'bg-merris-primary-bg' : 'hover:bg-[#f5f3ef]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-merris-primary text-white' : 'bg-merris-surface-low text-merris-text-tertiary'}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate font-display text-[12px] font-semibold ${isActive ? 'text-merris-primary' : 'text-merris-text'}`}>
                          {conv.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-body text-[10px] text-merris-text-tertiary">
                            {conv.messages.length} message{conv.messages.length !== 1 ? 's' : ''} · {relTime(conv.savedAt)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {conv.jurisdiction.slice(0, 3).map((j) => (
                            <span key={j} className="inline-flex items-center gap-0.5 rounded-full bg-merris-surface-low px-1.5 py-0.5 font-body text-[9px] text-merris-text-secondary">
                              {FLAG[j] ?? ''} {j}
                            </span>
                          ))}
                          {conv.knowledgeSources.slice(0, 2).map((k) => (
                            <span key={k} className={`rounded-full px-1.5 py-0.5 font-body text-[9px] font-semibold ${K_COLORS[k] ?? 'bg-merris-surface-low text-merris-text-secondary'}`}>
                              {k}
                            </span>
                          ))}
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

      {/* ── Right panel: preview / detail ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-merris-text-tertiary">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <div>
              <p className="font-display text-[14px] font-semibold text-merris-text">Select a conversation</p>
              <p className="mt-1 font-body text-[12px] text-merris-text-tertiary">Click any session on the left to preview it</p>
            </div>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div className="flex items-center gap-4 border-b border-merris-border bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-merris-border bg-white text-merris-text-tertiary hover:border-merris-primary hover:text-merris-primary"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="truncate font-display text-[14px] font-bold text-merris-text">{selected.title}</h2>
                <p className="font-body text-[11px] text-merris-text-tertiary">
                  Saved {fmtDate(selected.savedAt)} · {selected.messages.length} messages
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(selected.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 font-body text-[11px] font-semibold text-red-600 hover:bg-red-100"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => handleOpen(selected)}
                  className="flex items-center gap-1.5 rounded-lg bg-merris-primary px-4 py-1.5 font-display text-[12px] font-bold text-white shadow-sm hover:opacity-90"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  Resume conversation
                </button>
              </div>
            </div>

            {/* Conversation preview */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mx-auto max-w-[800px] space-y-6">
                {/* Scope chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Scope</span>
                  {selected.jurisdiction.map((j) => (
                    <span key={j} className="inline-flex items-center gap-1 rounded-full border border-merris-border bg-white px-2 py-0.5 font-body text-[10px] text-merris-text-secondary">
                      {FLAG[j] ?? ''} {j}
                    </span>
                  ))}
                  {selected.knowledgeSources.map((k) => (
                    <span key={k} className={`rounded-full px-2 py-0.5 font-body text-[10px] font-semibold ${K_COLORS[k] ?? 'bg-merris-surface-low text-merris-text-secondary'}`}>
                      {k}
                    </span>
                  ))}
                </div>

                {/* Messages */}
                {selected.messages.map((msg, i) => (
                  <div key={msg.id} className="space-y-3">
                    {/* User question */}
                    <div className="overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
                      <div className="flex items-center gap-3 border-b border-merris-border px-5 py-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-merris-primary font-display text-[10px] font-bold text-white">
                          MU
                        </div>
                        <span className="font-body text-[11px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
                          Message {i + 1} of {selected.messages.length}
                        </span>
                      </div>
                      <div className="px-6 py-5">
                        <p className="font-display text-[15px] font-semibold leading-snug text-merris-text">{msg.question}</p>
                      </div>
                    </div>

                    {/* Merris response */}
                    <div className="overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
                      <div className="flex items-center gap-3 border-b border-merris-border px-5 py-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-merris-primary font-display text-[12px] font-bold text-white">
                          M
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-[13px] font-bold text-merris-text">Merris</span>
                            {msg.evaluation && (
                              <span className={`rounded-full px-2 py-0.5 font-body text-[9px] font-semibold ${
                                msg.evaluation.confidence === 'high'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : msg.evaluation.confidence === 'medium'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {msg.evaluation.confidence} confidence
                              </span>
                            )}
                          </div>
                          <span className="font-body text-[10px] text-merris-text-tertiary">
                            {msg.citations.length > 0 && `${msg.citations.length} source${msg.citations.length !== 1 ? 's' : ''} · `}
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {msg.evaluation && (
                          <div className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-merris-primary">
                            <span className="font-display text-[11px] font-bold text-merris-primary">{msg.evaluation.score}</span>
                          </div>
                        )}
                      </div>
                      <div className="border-l-4 border-merris-primary px-6 py-5">
                        <p className="font-body text-[13px] leading-relaxed text-merris-text">
                          {msg.answer.slice(0, 400)}{msg.answer.length > 400 ? '…' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Resume CTA */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleOpen(selected)}
                    className="inline-flex items-center gap-2 rounded-xl bg-merris-primary px-6 py-3 font-display text-[13px] font-bold text-white shadow-sm hover:opacity-90"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    Resume this conversation in Intelligence
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
