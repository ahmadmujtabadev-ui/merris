'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { merrisTokens } from '@/lib/design-tokens';
import { useKnowledgeStore } from '@/lib/store';
import { useChatStore } from '@/lib/chat-store';
import { KNOWLEDGE_COLLECTIONS } from './knowledge-data';

export function KnowledgePage() {
  const { collections: apiCollections, fetchCollections, loadingCollections,
          seeded, searchResults, search, searching, clearSearch } = useKnowledgeStore();
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const setPendingQuestion = useChatStore((s) => s.setPendingQuestion);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Merge live counts with local item descriptions
  const collections = apiCollections.length > 0
    ? apiCollections.map((c) => {
        const local = KNOWLEDGE_COLLECTIONS.find((k) => k.id === c.id);
        return { ...c, items: local?.items ?? [] };
      })
    : KNOWLEDGE_COLLECTIONS;

  const totalEntries = collections.reduce((sum, k) => sum + k.count, 0);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) search(query.trim());
    else clearSearch();
  }

  function askInIntelligence(title: string) {
    setPendingQuestion(`Tell me about: ${title}`);
    router.push('/intelligence');
  }

  return (
    <div className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <h1 className="font-display text-[24px] font-bold text-merris-text">Knowledge Base</h1>
        {seeded ? (
          <Pill variant="completed" size="sm">📡 Live</Pill>
        ) : (
          <Pill variant="draft" size="sm">📋 Placeholder</Pill>
        )}
      </div>
      <p className="mb-4 font-body text-[12px] text-merris-text-secondary">
        {totalEntries.toLocaleString()} entries — {collections.length} internal collections
      </p>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-5">
        <div className="flex items-center gap-2 rounded-merris-sm bg-merris-surface-low px-3 py-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search knowledge base... (press Enter)"
            className="flex-1 bg-transparent font-body text-[12px] text-merris-text outline-none placeholder:text-merris-text-tertiary"
          />
          {searching && <span className="font-body text-[10px] text-merris-text-tertiary">Searching…</span>}
          {query && (
            <button type="button" onClick={() => { setQuery(''); clearSearch(); }}
              className="font-body text-[10px] text-merris-text-tertiary hover:text-merris-text">✕</button>
          )}
        </div>
      </form>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 font-display text-[12px] font-semibold text-merris-text-secondary">
            {searchResults.length} results for &ldquo;{query}&rdquo;
          </div>
          <div className="space-y-2">
            {searchResults.map((r) => {
              const isExpanded = expandedId === r.id;
              return (
                <MerrisCard
                  key={r.id}
                  style={{ padding: '10px 14px', cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[13px] font-semibold text-merris-text">{r.title}</div>
                      <div className={`mt-0.5 font-body text-[11px] text-merris-text-secondary ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {r.description}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Pill size="sm">{r.domain}</Pill>
                      <div className="mt-1 font-body text-[9px] text-merris-text-tertiary">{Math.round(r.score * 100)}%</div>
                    </div>
                  </div>
                  <div className="mt-1 font-body text-[9px] text-merris-text-tertiary">{r.source} · {r.year}</div>
                  {isExpanded && (
                    <div className="mt-2 border-t border-merris-border pt-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => askInIntelligence(r.title)}
                        className="font-display text-[10px] font-semibold text-merris-primary hover:underline"
                      >
                        Ask in Intelligence →
                      </button>
                    </div>
                  )}
                </MerrisCard>
              );
            })}
          </div>
        </div>
      )}

      {/* Collection grid */}
      {searchResults.length === 0 && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {collections.map((k) => (
            <MerrisCard key={k.id} hover>
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-merris-sm bg-merris-primary-bg">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                    </svg>
                  </div>
                  <Pill size="sm">{k.id}</Pill>
                </div>
                <div className="text-right">
                  <div className="font-display text-[22px] font-bold text-merris-text">
                    {loadingCollections ? '…' : k.count}
                  </div>
                  <div className="font-body text-[8px] uppercase text-merris-text-tertiary">Entries</div>
                </div>
              </div>
              <div className="mb-2 font-display text-[14px] font-semibold text-merris-text">{k.name}</div>
              {k.items?.map((it: string) => (
                <div key={it} className="py-0.5 font-body text-[11px] text-merris-text-secondary">● {it}</div>
              ))}
              <div className="mt-2.5 border-t border-merris-border pt-2">
                <button
                  onClick={() => { setQuery(k.name); search(k.name, [k.id]); }}
                  className="font-display text-[10px] font-semibold text-merris-primary hover:underline"
                >
                  Browse →
                </button>
              </div>
            </MerrisCard>
          ))}
        </div>
      )}
    </div>
  );
}
