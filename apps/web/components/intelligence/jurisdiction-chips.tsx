'use client';

import clsx from 'clsx';
import { useChatStore } from '@/lib/chat-store';
import { JURISDICTIONS } from '@/lib/intelligence-constants';

const FLAG: Record<string, string> = {
  Qatar: '🇶🇦',
  Oman:  '🇴🇲',
  UAE:   '🇦🇪',
  Saudi: '🇸🇦',
  EU:    '🇪🇺',
  UK:    '🇬🇧',
};

export function JurisdictionChips() {
  const jurisdiction = useChatStore((s) => s.jurisdiction);
  const toggle = useChatStore((s) => s.toggleJurisdiction);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {JURISDICTIONS.map((j) => {
        const isActive = jurisdiction.includes(j);
        return (
          <button
            key={j}
            type="button"
            onClick={() => toggle(j)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-display text-[11px] font-semibold transition-all',
              isActive
                ? 'bg-merris-primary text-white shadow-sm'
                : 'border border-merris-border bg-white text-merris-text-secondary hover:border-merris-primary hover:text-merris-primary',
            )}
          >
            <span className="text-[13px] leading-none">{FLAG[j]}</span>
            {j}
          </button>
        );
      })}
    </div>
  );
}
