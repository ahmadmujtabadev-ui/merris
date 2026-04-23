'use client';

import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';

const TERMINAL_ACTIONS = [
  { label: 'Run Full Review', icon: '⚡' },
  { label: 'Generate Report', icon: '📄' },
  { label: 'Export Findings', icon: '⬇️' },
];

export function EngagementDetailSidebar() {
  return (
    <>
      <MerrisCard className="mb-3.5">
        <SectionLabel>Workflow Terminal</SectionLabel>
        {TERMINAL_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            className="flex w-full items-center justify-between border-t border-merris-border py-2.5 text-left first:border-t-0 opacity-50 cursor-not-allowed"
            disabled
            title="Select an engagement and upload documents first"
          >
            <span className="flex items-center gap-2 font-display text-[12px] font-medium text-merris-text">
              <span>{a.icon}</span>
              {a.label}
            </span>
            <span className="text-merris-text-tertiary">›</span>
          </button>
        ))}
      </MerrisCard>

      <MerrisCard>
        <SectionLabel>Team</SectionLabel>
        <p className="py-2 font-body text-[11px] text-merris-text-tertiary">
          No team members yet. Invite colleagues via Settings.
        </p>
      </MerrisCard>
    </>
  );
}
