'use client';

import { useState } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { Pill } from '@/components/merris/pill';
import { Chip } from '@/components/merris/chip';
import { SectionLabel } from '@/components/merris/label';
import { AGENTS_PREBUILT, AGENTS_CUSTOM, RECENTLY_RUN, AGENT_CATEGORIES, type AgentEntry } from './workflow-agents-data';

export function WorkflowAgentsPage() {
  const [category, setCategory] = useState<(typeof AGENT_CATEGORIES)[number]>('All');

  const allAgents: AgentEntry[] = [...AGENTS_PREBUILT, ...AGENTS_CUSTOM];
  const filtered = allAgents.filter((a) => category === 'All' || a.category === category);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="mb-1 font-display text-[24px] font-bold text-merris-text">Workflow Agents</h1>
          <p className="font-body text-[12px] text-merris-text-secondary">
            Run pre-built agents or build your own, tailored to your organisation's needs.
          </p>
        </div>
        <MerrisButton variant="primary">+ Build Agent</MerrisButton>
      </div>

      <div className="mb-5 inline-flex rounded-merris-sm bg-merris-surface-low p-1">
        <span className="rounded-[6px] bg-merris-primary px-4 py-1.5 font-display text-[12px] font-semibold text-white">Library</span>
        <span className="px-4 py-1.5 font-display text-[12px] text-merris-text-secondary">Agent Builder</span>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {AGENT_CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="mb-7 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((a) => (
          <MerrisCard key={a.name} hover>
            <div className="mb-3 flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-merris-sm bg-merris-primary-bg text-[18px]">
                {a.iconLabel}
              </div>
              {a.by ? (
                <Pill variant="draft" size="sm">Custom</Pill>
              ) : (
                <Pill size="sm">Pre-built</Pill>
              )}
            </div>
            <div className="mb-1 font-display text-[14px] font-semibold text-merris-text">{a.name}</div>
            <div className="mb-3 font-body text-[11px] leading-relaxed text-merris-text-secondary">{a.description}</div>
            <div className="flex items-center justify-between border-t border-merris-border pt-3">
              <div className="flex gap-2.5 font-body text-[10px] text-merris-text-tertiary">
                {a.runs !== undefined && <span>{a.runs.toLocaleString()} runs</span>}
                {a.rating !== undefined && <span>★ {a.rating}</span>}
                {a.by && <span>by {a.by}</span>}
                {a.shared !== undefined && <span>👥 {a.shared}</span>}
              </div>
              <MerrisButton variant="primary" className="!text-[11px] !px-3 !py-1.5">▶ Run</MerrisButton>
            </div>
          </MerrisCard>
        ))}

        <button
          type="button"
          className="flex flex-col items-center justify-center rounded-merris border-2 border-dashed border-merris-border-medium bg-transparent p-6 transition-colors hover:bg-merris-surface-low"
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-merris-surface-low text-[18px] text-merris-text-tertiary">+</div>
          <div className="font-display text-[13px] font-semibold text-merris-text">Build Custom Agent</div>
          <div className="mt-1 font-body text-[10px] text-merris-text-tertiary">Create from natural language</div>
        </button>
      </div>

      <SectionLabel>Recently Run</SectionLabel>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {RECENTLY_RUN.map((r) => (
          <MerrisCard key={r.name} style={{ padding: '16px' }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-[12px] font-semibold text-merris-text">{r.name}</span>
              <Pill variant="completed" size="sm">{r.status}</Pill>
            </div>
            <div className="font-body text-[10px] text-merris-text-tertiary">
              {r.time}
              {r.findings > 0 && <span className="text-merris-warning"> · {r.findings} findings</span>}
            </div>
          </MerrisCard>
        ))}
      </div>
    </div>
  );
}
