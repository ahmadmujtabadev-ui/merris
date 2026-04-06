'use client';

import { useState, useEffect } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { Pill } from '@/components/merris/pill';
import { merrisTokens } from '@/lib/design-tokens';

interface ToggleProps {
  on: boolean;
  onChange: (next: boolean) => void;
}

function Toggle({ on, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="relative h-[18px] w-8 rounded-full transition-colors"
      style={{ background: on ? merrisTokens.primary : merrisTokens.surfaceHigh }}
    >
      <span
        className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all"
        style={{ left: on ? 16 : 2 }}
      />
    </button>
  );
}

const KNOWLEDGE_PRIORITIES = ['Firm Library', 'Engagement Docs', 'Merris Intel', 'Web Search'];

export function AIConfigPage() {
  const [challengeMode, setChallengeMode] = useState(true);
  const [evalScore, setEvalScore] = useState(true);
  const [citations, setCitations] = useState(true);
  const [gaps, setGaps] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const read = (key: string, fallback: boolean) => {
      const v = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      return v === null ? fallback : v === 'true';
    };
    setChallengeMode(read('merris-config-challengeMode', true));
    setEvalScore(read('merris-config-evalScore', true));
    setCitations(read('merris-config-citations', true));
    setGaps(read('merris-config-gaps', false));
  }, []);

  const persist = (key: string, value: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, String(value));
    }
  };

  return (
    <div className="p-6">
      <h1 className="mb-5 font-display text-[24px] font-bold text-merris-text">AI Configuration</h1>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <MerrisCard>
          <div className="mb-3.5 flex items-center gap-1.5 font-display text-[15px] font-semibold text-merris-text">
            ⚡ Response Behaviour
          </div>

          {[
            { label: 'Response Style', value: 'Balanced', position: '50%' },
            { label: 'Confidence Threshold', value: '85%', position: '85%' },
          ].map((s) => (
            <div key={s.label} className="mb-4">
              <div className="mb-1 flex items-center justify-between font-body text-[10px]">
                <span className="uppercase text-merris-text-tertiary">{s.label}</span>
                <span className="font-semibold text-merris-primary">{s.value}</span>
              </div>
              <div className="relative h-[3px] rounded-full bg-merris-surface-low">
                <div
                  className="absolute -top-[2.5px] h-2 w-2 rounded-full border-[2px] border-white bg-merris-primary shadow-merris"
                  style={{ left: s.position }}
                />
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[12px] font-semibold text-merris-text">Challenge Mode</div>
              <div className="font-body text-[10px] text-merris-text-tertiary">Critique inputs for ESG risks</div>
            </div>
            <Toggle on={challengeMode} onChange={(v) => { setChallengeMode(v); persist('merris-config-challengeMode', v); }} />
          </div>
        </MerrisCard>

        <MerrisCard>
          <div className="mb-2.5 font-display text-[15px] font-semibold text-merris-text">Knowledge Priorities</div>
          <div className="mb-3 font-body text-[11px] text-merris-text-secondary">
            Drag to set source hierarchy.
          </div>
          {KNOWLEDGE_PRIORITIES.map((n, i) => (
            <div
              key={n}
              className="mb-1.5 flex items-center gap-2 rounded-merris-sm bg-merris-surface-low px-2.5 py-2"
            >
              <span className="text-merris-text-tertiary">⋮⋮</span>
              <span className="text-merris-primary">📁</span>
              <span className="flex-1 font-display text-[12px] font-medium text-merris-text">{n}</span>
              {i === 0 && <Pill size="sm">Primary</Pill>}
            </div>
          ))}
        </MerrisCard>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <MerrisCard>
          <div className="mb-3 font-display text-[15px] font-semibold text-merris-text">Outputs</div>
          {[
            { label: 'Evaluation Score', state: evalScore, set: setEvalScore, key: 'merris-config-evalScore' },
            { label: 'Citations',         state: citations, set: setCitations, key: 'merris-config-citations' },
            { label: 'Knowledge Gaps',    state: gaps,      set: setGaps,      key: 'merris-config-gaps' },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-t border-merris-border py-1.5 font-body text-[12px] first:border-t-0"
            >
              <span>{row.label}</span>
              <Toggle on={row.state} onChange={(v) => { row.set(v); persist(row.key, v); }} />
            </div>
          ))}
        </MerrisCard>

        <MerrisCard>
          <div className="mb-3 font-display text-[15px] font-semibold text-merris-text">Integrations</div>
          {[
            { name: 'Microsoft 365', active: true },
            { name: 'Anthropic API', active: true },
            { name: 'Climatiq',      active: false },
          ].map((it) => (
            <div
              key={it.name}
              className="flex items-center justify-between border-t border-merris-border py-2 font-display text-[12px] first:border-t-0"
            >
              <span>{it.name}</span>
              {it.active ? (
                <Pill variant="completed" size="sm">Active</Pill>
              ) : (
                <span className="rounded-full bg-merris-surface-low px-2 py-0.5 font-body text-[9px] text-merris-text-secondary">Setup</span>
              )}
            </div>
          ))}
        </MerrisCard>
      </div>

      <div className="text-right">
        <MerrisButton variant="primary">Apply Settings</MerrisButton>
      </div>
    </div>
  );
}
