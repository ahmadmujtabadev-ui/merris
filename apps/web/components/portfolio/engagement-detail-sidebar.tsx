'use client';

import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';
import { PLACEHOLDER_TEAM } from '@/lib/portfolio-constants';

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
            className="flex w-full items-center justify-between border-t border-merris-border py-2.5 text-left first:border-t-0"
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
        {PLACEHOLDER_TEAM.map((m) => (
          <div key={m.id} className="flex items-center gap-2 py-1.5">
            <div className="h-6 w-6 rounded-full bg-merris-surface-high" />
            <div className="flex-1">
              <div className="font-display text-[11px] font-medium text-merris-text">{m.name}</div>
              <div className="font-body text-[9px] text-merris-text-tertiary">{m.role}</div>
            </div>
            <div className={`h-1.5 w-1.5 rounded-full ${m.online ? 'bg-merris-primary' : 'bg-merris-surface-high'}`} />
          </div>
        ))}
      </MerrisCard>
    </>
  );
}
