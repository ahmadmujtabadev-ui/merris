'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Pill } from './pill';
import { merrisTokens } from '@/lib/design-tokens';
import { useEngagementStore } from '@/lib/store';
import { useChatStore } from '@/lib/chat-store';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

const PAGE_LABELS: Record<string, string> = {
  '/intelligence':    'Intelligence',
  '/portfolio':       'Portfolio',
  '/compliance':      'Compliance',
  '/knowledge':       'Knowledge',
  '/firm-library':    'Firm Library',
  '/workflow-agents': 'Workflow Agents',
  '/history':         'History',
  '/config':          'AI Config',
  '/settings':        'Settings',
};

export function MerrisTopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [corpusChunks, setCorpusChunks] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const engagements = useEngagementStore((s) => s.engagements);
  const current = useEngagementStore((s) => s.currentEngagement);
  const setCurrent = useEngagementStore((s) => s.setCurrentEngagement);
  const setChatEngagementId = useChatStore((s) => s.setEngagementId);
  const user = useAuthStore((s) => s.user);

  const pageName = Object.entries(PAGE_LABELS).find(([k]) => pathname === k || pathname.startsWith(k + '/'))?.[1] ?? '';

  // Fetch corpus stats for the Intelligence topbar chip
  const fetchStats = useCallback(async () => {
    if (!user?.orgId) return;
    try {
      const stats = await api.getVaultStats(user.orgId);
      setCorpusChunks(stats.totalChunks ?? stats.indexed ?? null);
      setLastSync(Date.now());
    } catch { /* ignore */ }
  }, [user?.orgId]);

  useEffect(() => {
    if (pathname === '/intelligence') {
      void fetchStats();
    }
  }, [pathname, fetchStats]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // ⌘K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const label = current?.name ?? 'No engagement';

  const syncLabel = (() => {
    const d = Date.now() - lastSync;
    if (d < 60000) return 'just now';
    return `${Math.floor(d / 60000)}m`;
  })();

  return (
    <header
      className="sticky top-0 z-50 flex h-[44px] items-center bg-merris-surface px-5"
      style={{ borderBottom: `1px solid ${merrisTokens.border}` }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-merris-text-tertiary">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3"/></svg>
        <span className="font-body text-[11px]">Workspace</span>
        {pageName && (
          <>
            <span className="font-body text-[11px]">/</span>
            <span className="font-body text-[11px] font-semibold text-merris-text">{pageName}</span>
          </>
        )}
      </div>

      {/* Corpus stats — only on Intelligence */}
      {pathname === '/intelligence' && (
        <div className="ml-5 flex items-center gap-3" style={{ borderLeft: `1px solid ${merrisTokens.border}`, paddingLeft: '20px' }}>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono text-[11px] font-semibold text-merris-text">
              {corpusChunks != null ? corpusChunks.toLocaleString() : '—'}
            </span>
            <span className="font-body text-[10px] text-merris-text-tertiary">chunks indexed</span>
          </div>
          <div className="h-3 w-px bg-merris-border" />
          <span className="font-body text-[10px] text-merris-text-tertiary">Index <span className="font-semibold text-emerald-600">OK</span></span>
          <div className="h-3 w-px bg-merris-border" />
          <span className="font-body text-[10px] text-merris-text-tertiary">Last sync <span className="font-medium text-merris-text">{syncLabel}</span></span>
        </div>
      )}

      {/* Search */}
      <div className="ml-auto flex items-center gap-2">
        <div
          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5"
          style={{ border: `1px solid ${merrisTokens.border}`, background: merrisTokens.surfaceLow }}
          onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          {searchOpen ? (
            <input
              ref={searchRef}
              autoFocus
              type="text"
              placeholder="Jump to engagement, entity, or chunk…"
              onBlur={() => setSearchOpen(false)}
              className="w-52 bg-transparent font-body text-[11px] text-merris-text outline-none placeholder:text-merris-text-tertiary"
            />
          ) : (
            <span className="font-body text-[11px] text-merris-text-tertiary">Jump to engagement, entity, or chunk…</span>
          )}
          <kbd className="rounded border border-merris-border px-1 py-0.5 font-mono text-[9px] text-merris-text-tertiary">⌘K</kbd>
        </div>

        {/* Bookmark */}
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-merris-text-tertiary hover:bg-merris-surface-low hover:text-merris-text">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
        </button>

        {/* Engagement selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-[11px] transition-colors hover:bg-merris-surface-low"
            style={{ border: `1px solid ${merrisTokens.borderMedium}` }}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${current ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span className="font-medium text-merris-text">{label}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.5">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {open && (
            <div
              className="absolute right-0 top-full z-[100] mt-1 max-h-64 w-56 overflow-y-auto rounded-lg bg-merris-surface shadow-lg"
              style={{ border: `1px solid ${merrisTokens.borderMedium}` }}
            >
              {engagements.length === 0 && (
                <div className="px-3 py-3 font-body text-[11px] text-merris-text-tertiary">No engagements yet</div>
              )}
              {engagements.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { setCurrent(e); setChatEngagementId(e.id); setOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[12px] text-merris-text hover:bg-merris-surface-low"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-merris-primary" />
                  {e.name}
                  {current?.id === e.id && <span className="ml-auto rounded-full bg-merris-primary-bg px-1.5 py-0.5 font-body text-[9px] font-semibold text-merris-primary">Active</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
