'use client';

import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { merrisTokens } from '@/lib/design-tokens';
import { KNOWLEDGE_COLLECTIONS, TOTAL_ENTRIES } from './knowledge-data';

export function KnowledgePage() {
  return (
    <div className="p-6">
      <h1 className="mb-1 font-display text-[24px] font-bold text-merris-text">Knowledge Base</h1>
      <p className="mb-4 font-body text-[12px] text-merris-text-secondary">
        {TOTAL_ENTRIES.toLocaleString()} entries — 7 internal collections
      </p>

      <div
        className="mb-5 flex items-center gap-2 rounded-merris-sm bg-merris-surface-low px-3 py-2.5"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <span className="font-body text-[12px] text-merris-text-tertiary">Search repository... ⌘K</span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {KNOWLEDGE_COLLECTIONS.map((k) => (
          <MerrisCard key={k.id} hover>
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-merris-sm bg-merris-primary-bg"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                  </svg>
                </div>
                <Pill size="sm">{k.id}</Pill>
              </div>
              <div className="text-right">
                <div className="font-display text-[22px] font-bold text-merris-text">{k.count}</div>
                <div className="font-body text-[8px] uppercase text-merris-text-tertiary">Entries</div>
              </div>
            </div>
            <div className="mb-2 font-display text-[14px] font-semibold text-merris-text">{k.name}</div>
            {k.items.map((it) => (
              <div key={it} className="py-0.5 font-body text-[11px] text-merris-text-secondary">● {it}</div>
            ))}
            <div className="mt-2.5 border-t border-merris-border pt-2">
              <span className="font-display text-[10px] font-semibold text-merris-primary">Browse →</span>
            </div>
          </MerrisCard>
        ))}
      </div>
    </div>
  );
}
