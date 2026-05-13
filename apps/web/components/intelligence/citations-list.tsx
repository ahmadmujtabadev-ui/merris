'use client';

import type { CitationItem } from '@merris/shared';

const K_COLORS: Record<string, string> = {
  K1: '#006b5f',
  K2: '#0369a1',
  K3: '#7c3aed',
  K4: '#b45309',
  K5: '#0f766e',
  K6: '#15803d',
  K7: '#be185d',
};

function KBadge({ source }: { source: string }) {
  const match = source?.match(/K\d/)?.[0] ?? '';
  const color = K_COLORS[match] ?? '#6b7280';
  return match ? (
    <span
      className="inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-[9px] font-bold text-white"
      style={{ background: color }}
    >
      {match}
    </span>
  ) : (
    <span className="inline-flex items-center justify-center rounded bg-blue-500 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">web</span>
  );
}

export function CitationsList({ citations }: { citations: CitationItem[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-5 border-t border-merris-border pt-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
          Citations
        </span>
        <span className="font-body text-[10px] text-merris-text-tertiary">
          {citations.length} source{citations.length !== 1 ? 's' : ''} · {citations.filter(c => c.verified).length} verified
        </span>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-2 gap-3">
        {citations.map((c, i) => (
          <div
            key={c.id}
            className="group rounded-xl border border-merris-border bg-merris-surface-low p-4 transition-all hover:border-merris-primary hover:shadow-sm"
          >
            <div className="mb-2.5 flex items-start gap-2.5">
              {/* Number badge */}
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-merris-border bg-white font-mono text-[10px] font-bold text-merris-text">
                {i + 1}
              </span>
              <KBadge source={c.source} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[12px] font-semibold leading-tight text-merris-text group-hover:text-merris-primary">
                  {c.title}
                </p>
              </div>
            </div>
            <div className="mb-2 flex items-center gap-2 text-merris-text-tertiary">
              <span className="font-body text-[10px]">{c.domain}</span>
              {c.source && <span className="font-body text-[10px]">· {c.source}</span>}
              {c.verified ? (
                <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 font-body text-[9px] font-semibold text-emerald-600">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  Verified
                </span>
              ) : (
                <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 font-body text-[9px] font-semibold text-amber-600">
                  Unverified
                </span>
              )}
            </div>
            {c.excerpt && (
              <p className="font-body text-[10px] italic leading-relaxed text-merris-text-secondary line-clamp-2">
                &ldquo;{c.excerpt}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
