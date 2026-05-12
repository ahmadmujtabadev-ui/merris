'use client';

import type { CitationItem } from '@merris/shared';

function SourceIcon({ domain, title }: { domain: string; title: string }) {
  const initial = (title || domain || '?')[0].toUpperCase();

  return (
    <div className="relative h-[22px] w-[22px] flex-shrink-0">
      {/* Favicon — hidden on error, letter avatar is always underneath */}
      <div className="absolute inset-0 flex items-center justify-center rounded-md bg-merris-primary-bg font-display text-[9px] font-bold text-merris-primary">
        {initial}
      </div>
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
        alt=""
        width={22}
        height={22}
        className="absolute inset-0 h-[22px] w-[22px] rounded-md object-contain"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
}

export function CitationsList({ citations }: { citations: CitationItem[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-3 border-t border-merris-border pt-3">
      <div className="mb-2 font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
        Sources
      </div>
      <ul className="space-y-2.5">
        {citations.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5">
            <SourceIcon domain={c.domain} title={c.title} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-body text-[12px] font-semibold text-merris-primary hover:underline leading-tight"
                  >
                    {c.title}
                  </a>
                ) : (
                  <span className="font-body text-[12px] font-semibold text-merris-text leading-tight">
                    {c.title}
                  </span>
                )}
                {c.verified && (
                  <span className="rounded-full bg-merris-success-bg px-1.5 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wide text-merris-success">
                    Verified
                  </span>
                )}
              </div>
              <div className="mt-0.5 font-body text-[11px] text-merris-text-tertiary">
                {c.source}
                {c.year ? ` · ${c.year}` : ''}
              </div>
              {c.excerpt && (
                <div className="mt-1 font-body text-[11px] italic leading-relaxed text-merris-text-secondary">
                  "{c.excerpt}"
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
