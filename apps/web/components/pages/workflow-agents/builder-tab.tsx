'use client';

import { useState } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { Pill } from '@/components/merris/pill';
import { Chip } from '@/components/merris/chip';
import { SectionLabel } from '@/components/merris/label';
import { api } from '@/lib/api';

const DEFAULT_DESCRIPTION = `Conduct ESRS-aligned materiality assessment. Cross-reference GRI, flag Scope 3 discrepancies. Output prioritised compliance items for committee review.`;

interface BuilderStep {
  id: string;
  name: string;
  description: string;
  tool: string;
}

export function BuilderTab() {
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [steps, setSteps] = useState<BuilderStep[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateBuilderSteps(description.trim());
      setSteps(res.steps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate steps');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
      {/* Left column: configure + generated logic */}
      <div>
        {/* Mode toggle (Describe / Visual Builder) — Visual is a coming-soon stub */}
        <div className="mb-5 inline-flex rounded-merris-sm bg-merris-surface-low p-1">
          <span className="rounded-[6px] bg-merris-primary px-4 py-1 font-display text-[11px] font-semibold text-white">Describe</span>
          <span className="px-4 py-1 font-display text-[11px] text-merris-text-tertiary" title="Coming soon">Visual Builder</span>
        </div>

        <MerrisCard className="mb-5">
          <h2 className="mb-1 font-display text-[18px] font-bold text-merris-text">Configure Intelligence Loop</h2>
          <p className="mb-3 font-body text-[12px] text-merris-text-secondary">
            Describe what this agent should do. Merris will generate the execution steps.
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mb-3 w-full resize-none rounded-merris-sm bg-merris-surface-low p-3 font-body text-[12px] leading-relaxed text-merris-text outline-none focus:ring-2 focus:ring-merris-primary"
          />
          {error && (
            <div className="mb-3 rounded-merris-sm bg-merris-error-bg px-3 py-2 font-body text-[11px] text-merris-error">
              {error}
            </div>
          )}
          <MerrisButton variant="primary" onClick={generate} disabled={generating}>
            {generating ? 'Generating…' : '⚡ Generate Steps'}
          </MerrisButton>
        </MerrisCard>

        {steps.length > 0 && (
          <>
            <SectionLabel>Generated Execution Logic</SectionLabel>
            {steps.map((step, i) => (
              <MerrisCard
                key={step.id}
                className="mb-2.5 border-l-[3px] border-merris-primary"
                style={{ padding: '14px 18px' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-2.5">
                    <div className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-merris-primary-bg font-display text-[11px] font-bold text-merris-primary">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div>
                      <div className="font-display text-[13px] font-semibold text-merris-text">{step.name}</div>
                      <div className="font-body text-[11px] text-merris-text-secondary">{step.description}</div>
                      <div className="mt-1 font-mono text-[10px] text-merris-text-tertiary">tool: {step.tool}</div>
                    </div>
                  </div>
                  <Pill variant="draft" size="sm">Pending</Pill>
                </div>
              </MerrisCard>
            ))}

            <div className="mt-5 flex gap-2">
              <MerrisButton variant="primary">📤 Publish to Library</MerrisButton>
              <MerrisButton variant="secondary">👁 Preview</MerrisButton>
            </div>
          </>
        )}
      </div>

      {/* Right column: settings sidebar */}
      <div>
        <MerrisCard className="mb-3.5">
          <div className="mb-3 font-display text-[15px] font-semibold text-merris-text">Agent Settings</div>

          {[
            { label: 'Jurisdiction', value: 'EU (CSRD)' },
            { label: 'Frameworks',   value: 'ESRS, GRI' },
          ].map((setting) => (
            <div key={setting.label} className="mb-3">
              <div className="mb-1 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">{setting.label}</div>
              <div className="rounded-merris-sm border border-merris-border-medium px-2.5 py-1.5 font-body text-[12px] text-merris-text">{setting.value}</div>
            </div>
          ))}

          <div className="mb-3">
            <div className="mb-1 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Knowledge Sources</div>
            <div className="flex flex-wrap gap-1">
              <Chip active>K1 ✕</Chip>
              <Chip active>K3 ✕</Chip>
              <Chip active>K7 ✕</Chip>
              <Chip>Add +</Chip>
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Golden Documents</div>
            <div className="rounded-merris-sm border border-dashed border-merris-border-medium px-3 py-2 font-body text-[11px] text-merris-text-tertiary">
              Drop templates or examples
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Output Format</div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="cursor-pointer rounded-merris-sm border-[1.5px] border-merris-primary bg-merris-primary-bg px-2 py-2 text-center font-display text-[11px] font-medium text-merris-primary">Report</div>
              <div className="cursor-pointer rounded-merris-sm border-[1.5px] border-merris-border-medium px-2 py-2 text-center font-display text-[11px] font-medium text-merris-text-secondary">JSON</div>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-1 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">Permissions</div>
            {['Everyone in workspace', 'Lead Analysts only', 'Only me'].map((perm, i) => (
              <div key={perm} className={`flex items-center gap-1.5 py-1 font-body text-[11px] ${i === 0 ? 'text-merris-primary' : 'text-merris-text-secondary'}`}>
                <div className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] ${i === 0 ? 'border-merris-primary' : 'border-merris-border-medium'}`}>
                  {i === 0 && <div className="h-2 w-2 rounded-full bg-merris-primary" />}
                </div>
                {perm}
              </div>
            ))}
          </div>

          <MerrisButton variant="primary" className="w-full justify-center">Save Agent</MerrisButton>
        </MerrisCard>

        <MerrisCard className="bg-merris-primary" style={{ padding: '14px 16px' }}>
          <div className="mb-2 inline-block rounded-full bg-white/20 px-2 py-0.5 font-body text-[10px] font-semibold uppercase text-white">AI Insight</div>
          <p className="font-body text-[11px] leading-relaxed text-white/90">
            Consider adding "Double Materiality" validation step based on recent ESRS updates.
          </p>
        </MerrisCard>
      </div>
    </div>
  );
}
