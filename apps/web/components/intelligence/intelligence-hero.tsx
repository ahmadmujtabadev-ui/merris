'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { JurisdictionChips } from './jurisdiction-chips';
import { SourceToggles } from './source-toggles';
import { ChatInput } from './chat-input';
import { useChatStore } from '@/lib/chat-store';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

// ── Static suggested prompts ─────────────────────────────────────────────────
const SUGGESTED = [
  {
    num: '01',
    category: 'REGULATORY',
    title: 'Compare IFRS S1/S2 disclosure requirements with QCB ESG circular 2024',
    sources: ['K3 Regulatory', 'K1 Disclosures'],
    badge: '12 analysts',
  },
  {
    num: '02',
    category: 'CLIMATE',
    title: 'Scope 3 emissions methodology divergence across GCC banks',
    sources: ['K6 Climate', 'K5 Peers'],
    badge: '8 analysts',
  },
  {
    num: '03',
    category: 'COMPLIANCE',
    title: 'What restatement policies do regulators require when supplier factors change?',
    sources: ['K3 Regulatory', 'K7 Research'],
    badge: 'New this week',
  },
];


export function IntelligenceHero() {
  const router = useRouter();
  const pendingQuestion = useChatStore((s) => s.pendingQuestion);
  const setPendingQuestion = useChatStore((s) => s.setPendingQuestion);
  const startQuery = useChatStore((s) => s.startQuery);
  const user = useAuthStore((s) => s.user);

  const [stats, setStats] = useState<{ totalChunks: number; indexed: number; total: number } | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user?.orgId) return;
    try {
      const s = await api.getVaultStats(user.orgId);
      setStats({ totalChunks: s.totalChunks ?? s.indexed, indexed: s.indexed, total: s.total });
    } catch { /* ignore */ }
  }, [user?.orgId]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (pendingQuestion) {
      setPendingQuestion(null);
      void startQuery(pendingQuestion);
    }
  }, [pendingQuestion, setPendingQuestion, startQuery]);

  const chunks = stats?.totalChunks ?? 0;
  const docs = stats?.total ?? 0;

  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      <div className="mx-auto max-w-[1100px] px-8 py-10">

        {/* ── Label ── */}
        <div className="mb-8 flex items-center gap-2">
          <div className="h-px w-5 bg-merris-text-tertiary" />
          <span className="font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-merris-text-tertiary">
            Global Intelligence · V2.4
          </span>
        </div>

        {/* ── Hero row ── */}
        <div className="mb-10 flex items-start justify-between gap-12">
          {/* Headline */}
          <div className="max-w-[540px]">
            <h1 className="font-display text-[52px] font-extrabold leading-[1.1] tracking-tight text-merris-text">
              Where sustainability meets{' '}
              <span className="italic text-merris-primary">precision</span>
            </h1>
            <p className="mt-5 font-body text-[14px] leading-relaxed text-merris-text-secondary">
              Ask Merris anything across{' '}
              <strong className="font-semibold text-merris-text">
                {chunks > 0 ? chunks.toLocaleString() : '—'} chunked passages
              </strong>{' '}
              from regulatory filings, disclosures, peer reports and live web — answered with citations, restated for your jurisdiction.
            </p>
          </div>

          {/* Corpus stat cards */}
          <div className="flex shrink-0 gap-4">
            {[
              { value: chunks > 0 ? chunks.toLocaleString() : '—', label: 'chunks', sub: 'INDEXED CORPUS' },
              { value: docs > 0 ? docs.toLocaleString() : '—', label: 'docs', sub: 'SOURCE DOCUMENTS' },
              { value: '7', label: '+ Web', sub: 'KNOWLEDGE VAULTS' },
            ].map(({ value, label, sub }) => (
              <div key={sub} className="rounded-xl border border-merris-border bg-white px-5 py-4 text-right shadow-sm">
                <div className="font-display text-[28px] font-bold leading-none text-merris-text">
                  {value}
                  <span className="ml-1 font-body text-[13px] font-normal text-merris-text-secondary">{label}</span>
                </div>
                <div className="mt-1.5 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filter card ── */}
        <div className="mb-4 overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
          <div className="flex items-start gap-5 border-b border-merris-border px-6 py-4">
            <span className="mt-0.5 w-20 shrink-0 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
              Jurisdiction
            </span>
            <JurisdictionChips />
          </div>
          <div className="flex items-start gap-5 px-6 py-4">
            <span className="mt-0.5 w-20 shrink-0 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
              Knowledge
            </span>
            <SourceToggles />
          </div>
        </div>

        {/* ── Chat input ── */}
        <div className="mb-5">
          <ChatInput />
        </div>

        {/* ── System specs bar ── */}
        <div className="mb-12 flex flex-wrap items-center gap-x-6 gap-y-1">
          {[
            { color: '#16a34a', text: 'High performance · p95 1.8s' },
            { color: '#16a34a', text: 'Private cloud · QA-1 region' },
            { color: '#16a34a', text: 'ESG validated · QCB / IFRS S1-S2' },
            { color: '#f59e0b', text: 'Audit trail enabled' },
            { color: 'transparent', text: 'Model · Claude Sonnet 4 · 200k ctx', plain: true },
          ].map(({ color, text, plain }) => (
            <div key={text} className="flex items-center gap-1.5">
              {!plain && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
              <span className="font-body text-[10px] text-merris-text-tertiary">{text}</span>
            </div>
          ))}
        </div>

        {/* ── Suggested intelligence ── */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-merris-primary"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
            <span className="font-display text-[14px] font-bold text-merris-text">Suggested intelligence</span>
            <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">/ Curated for your role</span>
          </div>
          <button
            type="button"
            onClick={() => router.push('/intelligence/prompts')}
            className="font-body text-[11px] font-semibold text-merris-primary hover:underline"
          >
            Browse all prompts →
          </button>
        </div>

        <div className="mb-12 grid grid-cols-3 gap-4">
          {SUGGESTED.map((s) => (
            <button
              key={s.num}
              onClick={() => void startQuery(s.title)}
              className="group rounded-2xl border border-merris-border bg-white p-5 text-left shadow-sm transition-all hover:border-merris-primary hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-merris-text-tertiary">{s.num}</span>
                <span className="font-body text-[9px] font-semibold uppercase tracking-wider text-merris-primary">{s.category}</span>
              </div>
              <p className="mb-4 font-display text-[13px] font-semibold leading-snug text-merris-text group-hover:text-merris-primary">
                {s.title}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {s.sources.map((src) => (
                  <span key={src} className="inline-flex items-center gap-1 rounded-full border border-merris-border px-2 py-0.5 font-body text-[9px] text-merris-text-secondary">
                    <span className="h-1 w-1 rounded-full bg-merris-primary" />
                    {src}
                  </span>
                ))}
                <span className="ml-auto font-body text-[9px] text-merris-text-tertiary">{s.badge}</span>
              </div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
