'use client';

import { useState, useRef, useEffect } from 'react';
import { Pill } from './pill';
import { merrisTokens } from '@/lib/design-tokens';
import { useEngagementStore } from '@/lib/store';
import { useChatStore } from '@/lib/chat-store';

const TABS = ['Dashboard'] as const;
// Analytics and Archive are future tabs — not yet implemented

export function MerrisTopBar() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Dashboard');
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const engagements = useEngagementStore((s) => s.engagements);
  const current = useEngagementStore((s) => s.currentEngagement);
  const setCurrent = useEngagementStore((s) => s.setCurrentEngagement);
  const setChatEngagementId = useChatStore((s) => s.setEngagementId);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const label = current?.name ?? 'No engagement selected';

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
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-merris-sm px-2.5 py-1 font-body text-[11px]"
          style={{ border: `1px solid ${merrisTokens.borderMedium}` }}
        >
          {current && <Pill size="sm">Active</Pill>}
          <span className="font-medium text-merris-text">{label}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.textTertiary} strokeWidth="1.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div
            className="absolute right-0 top-full z-[100] mt-1 max-h-64 w-64 overflow-y-auto rounded-merris-sm bg-merris-surface shadow-merris-hover"
            style={{ border: `1px solid ${merrisTokens.borderMedium}` }}
          >
            {engagements.length === 0 && (
              <div className="px-3 py-2 font-body text-[11px] text-merris-text-tertiary">No engagements available</div>
            )}
            {engagements.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  setCurrent(e);
                  setChatEngagementId(e.id);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left font-body text-[12px] text-merris-text hover:bg-merris-surface-low"
              >
                {e.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
