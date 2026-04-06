'use client';

import { useState } from 'react';
import { Pill } from './pill';
import { merrisTokens } from '@/lib/design-tokens';

const TABS = ['Dashboard', 'Analytics', 'Archive'] as const;

export function MerrisTopBar() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Dashboard');

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between bg-merris-surface px-6 py-2.5"
      style={{ borderBottom: `1px solid ${merrisTokens.border}` }}
    >
      <div className="flex gap-[18px]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={
              activeTab === t
                ? 'pb-0.5 font-display text-[12px] font-semibold text-merris-text'
                : 'pb-0.5 font-display text-[12px] font-normal text-merris-text-tertiary'
            }
            style={activeTab === t ? { borderBottom: `2px solid ${merrisTokens.primary}` } : undefined}
          >
            {t}
          </button>
        ))}
      </div>
      <div
        className="flex items-center gap-1.5 rounded-merris-sm px-2.5 py-1 font-body text-[11px]"
        style={{ border: `1px solid ${merrisTokens.borderMedium}` }}
      >
        <Pill size="sm">Active</Pill>
        <span className="font-medium text-merris-text">QAPCO Sustainability 2026</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.5">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </header>
  );
}
