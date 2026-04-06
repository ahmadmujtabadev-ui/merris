'use client';

import type { CitationItem } from '@merris/shared';

export function CitationsList({ citations }: { citations: CitationItem[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-3 border-t border-merris-border pt-3">
      <div className="mb-2 font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
        Sources
      </div>
      <ul className="space-y-2">
        {citations.map((c) => (
          <li key={c.id} className="font-body text-[11px] leading-relaxed">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-merris-text">{c.title}</span>
              {c.verified && (
                <span className="rounded-full bg-merris-success-bg px-1.5 py-0.5 text-[9px] font-semibold uppercase text-merris-success">
                  Verified
                </span>
              )}
            </div>
            <div className="text-merris-text-secondary">
              {c.source} · {c.year}
              {c.url && (
                <>
                  {' · '}
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-merris-primary hover:underline">
                    Source
                  </a>
                </>
              )}
            </div>
            {c.excerpt && <div className="mt-0.5 italic text-merris-text-tertiary">"{c.excerpt}"</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
