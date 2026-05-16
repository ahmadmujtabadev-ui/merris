'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { Pill } from '@/components/merris/pill';
import { Chip } from '@/components/merris/chip';
import { SectionLabel } from '@/components/merris/label';
import { api } from '@/lib/api';

const VisualBuilder = dynamic(
  () => import('./visual-builder').then((m) => m.VisualBuilder),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 font-body text-[12px] text-gray-400">
        Loading canvas…
      </div>
    ),
  },
);

const KB_SOURCES = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7'];
const JURISDICTIONS = ['EU (CSRD)', 'Qatar (QCB)', 'UAE', 'KSA', 'Global (ISSB)', 'UK', 'US'];
const FRAMEWORK_OPTIONS = ['ESRS', 'GRI', 'TCFD', 'SASB', 'ISSB', 'CDP', 'UN SDG', 'UNGC'];
const CATEGORIES = ['Compliance', 'Climate', 'Monitoring', 'Due Diligence', 'Reporting', 'Custom'];

interface BuilderStep {
  id: string;
  name: string;
  description: string;
  tool: string;
}

type Permission = 'everyone' | 'analysts' | 'only-me';
type OutputFormat = 'report' | 'json';

export function BuilderTab() {
  const [mode, setMode] = useState<'describe' | 'visual'>('describe');

  // ─── Describe mode state ────────────────────────────────────
  const [agentName, setAgentName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<BuilderStep[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [genError, setGenError] = useState<string | null>(null);

  // ─── Agent settings state ──────────────────────────────────
  const [jurisdiction, setJurisdiction] = useState('EU (CSRD)');
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(['ESRS', 'GRI']);
  const [knowledgeSources, setKnowledgeSources] = useState<string[]>(['K1', 'K3', 'K7']);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('report');
  const [permission, setPermission] = useState<Permission>('everyone');
  const [category, setCategory] = useState('Compliance');

  function toggleFramework(fw: string) {
    setSelectedFrameworks((prev) =>
      prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw],
    );
  }

  function toggleKSource(k: string) {
    setKnowledgeSources((prev) =>
      prev.includes(k) ? prev.filter((s) => s !== k) : [...prev, k],
    );
  }

  const generate = async () => {
    if (description.trim().length < 10) {
      setGenError('Description must be at least 10 characters.');
      return;
    }
    setGenerating(true);
    setGenError(null);
    setSteps([]);
    try {
      const res = await api.generateBuilderSteps(
        description.trim(),
        jurisdiction,
        selectedFrameworks.join(', '),
      );
      setSteps(res.steps);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate steps');
    } finally {
      setGenerating(false);
    }
  };

  const saveAgent = async (publish: boolean) => {
    if (!agentName.trim()) {
      setGenError('Please enter an agent name before saving.');
      return;
    }
    if (steps.length === 0) {
      setGenError('Generate steps first before saving.');
      return;
    }
    setSaving(true);
    setSaveStatus('idle');
    try {
      await api.saveWorkflowTemplate({
        name: agentName.trim(),
        description: description.trim(),
        category: publish ? category : 'Custom',
        steps: steps.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          tool: s.tool,
          inputs: {},
        })),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
      setGenError(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Mode toggle */}
      <div className="mb-5 inline-flex rounded-merris-sm bg-merris-surface-low p-1">
        <button
          type="button"
          onClick={() => setMode('describe')}
          className={
            mode === 'describe'
              ? 'rounded-[6px] bg-merris-primary px-4 py-1 font-display text-[11px] font-semibold text-white'
              : 'px-4 py-1 font-display text-[11px] text-merris-text-secondary hover:text-merris-text'
          }
        >
          Describe
        </button>
        <button
          type="button"
          onClick={() => setMode('visual')}
          className={
            mode === 'visual'
              ? 'rounded-[6px] bg-merris-primary px-4 py-1 font-display text-[11px] font-semibold text-white'
              : 'px-4 py-1 font-display text-[11px] text-merris-text-secondary hover:text-merris-text'
          }
        >
          Visual Builder
        </button>
      </div>

      {mode === 'visual' && <VisualBuilder agentName={agentName || 'New Agent'} />}

      {mode === 'describe' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
          {/* ── Left: configure + steps ── */}
          <div>
            {/* Agent name */}
            <MerrisCard className="mb-4">
              <label className="mb-1 block font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
                Agent Name
              </label>
              <input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. ESRS Gap Analyser"
                className="w-full rounded-merris-sm border border-merris-border bg-merris-surface-low px-3 py-2 font-body text-[13px] text-merris-text outline-none focus:ring-2 focus:ring-merris-primary"
              />
            </MerrisCard>

            {/* Description + Generate */}
            <MerrisCard className="mb-5">
              <h2 className="mb-1 font-display text-[18px] font-bold text-merris-text">
                Configure Intelligence Loop
              </h2>
              <p className="mb-3 font-body text-[12px] text-merris-text-secondary">
                Describe what this agent should do. Merris will use Claude AI to generate the execution steps.
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="e.g. Conduct ESRS-aligned materiality assessment. Cross-reference GRI, flag Scope 3 discrepancies. Output prioritised compliance items for committee review."
                className="mb-3 w-full resize-none rounded-merris-sm bg-merris-surface-low p-3 font-body text-[12px] leading-relaxed text-merris-text outline-none focus:ring-2 focus:ring-merris-primary"
              />
              {genError && (
                <div className="mb-3 rounded-merris-sm bg-merris-error-bg px-3 py-2 font-body text-[11px] text-merris-error">
                  {genError}
                </div>
              )}
              <div className="flex items-center gap-2">
                <MerrisButton variant="primary" onClick={generate} disabled={generating}>
                  {generating ? 'Generating with Claude…' : '⚡ Generate Steps'}
                </MerrisButton>
                {generating && (
                  <span className="font-body text-[10px] text-merris-text-tertiary">
                    Claude AI is designing your workflow…
                  </span>
                )}
              </div>
            </MerrisCard>

            {/* Generated steps */}
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
                          <div className="font-display text-[13px] font-semibold text-merris-text">
                            {step.name}
                          </div>
                          <div className="font-body text-[11px] text-merris-text-secondary">
                            {step.description}
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-merris-text-tertiary">
                            tool: {step.tool}
                          </div>
                        </div>
                      </div>
                      <Pill variant="draft" size="sm">Pending</Pill>
                    </div>
                  </MerrisCard>
                ))}

                {/* Save status */}
                {saveStatus === 'saved' && (
                  <div className="mb-3 rounded-merris-sm bg-merris-success-bg px-3 py-2 font-body text-[11px] text-merris-success">
                    ✓ Agent saved! It will appear in your Library.
                  </div>
                )}
                {saveStatus === 'error' && (
                  <div className="mb-3 rounded-merris-sm bg-merris-error-bg px-3 py-2 font-body text-[11px] text-merris-error">
                    ✗ Failed to save. Check the API is running.
                  </div>
                )}

                <div className="mt-5 flex gap-2">
                  <MerrisButton
                    variant="primary"
                    onClick={() => saveAgent(true)}
                    disabled={saving}
                  >
                    {saving ? 'Publishing…' : '📤 Publish to Library'}
                  </MerrisButton>
                  <MerrisButton
                    variant="secondary"
                    onClick={() => saveAgent(false)}
                    disabled={saving}
                  >
                    💾 Save Draft
                  </MerrisButton>
                </div>
              </>
            )}
          </div>

          {/* ── Right: settings sidebar ── */}
          <div>
            <MerrisCard className="mb-3.5">
              <div className="mb-3 font-display text-[15px] font-semibold text-merris-text">
                Agent Settings
              </div>

              {/* Jurisdiction */}
              <div className="mb-3">
                <label className="mb-1 block font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
                  Jurisdiction
                </label>
                <select
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="w-full rounded-merris-sm border border-merris-border-medium bg-white px-2.5 py-1.5 font-body text-[12px] text-merris-text outline-none focus:ring-2 focus:ring-merris-primary"
                >
                  {JURISDICTIONS.map((j) => (
                    <option key={j}>{j}</option>
                  ))}
                </select>
              </div>

              {/* Frameworks */}
              <div className="mb-3">
                <label className="mb-1 block font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
                  Frameworks
                </label>
                <div className="flex flex-wrap gap-1">
                  {FRAMEWORK_OPTIONS.map((fw) => {
                    const active = selectedFrameworks.includes(fw);
                    return (
                      <button
                        key={fw}
                        type="button"
                        onClick={() => toggleFramework(fw)}
                        className={`rounded-full px-2 py-0.5 font-body text-[10px] font-semibold transition-colors ${
                          active
                            ? 'bg-merris-primary text-white'
                            : 'border border-merris-border bg-white text-merris-text-tertiary hover:border-merris-primary hover:text-merris-primary'
                        }`}
                      >
                        {fw}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Knowledge Sources */}
              <div className="mb-3">
                <label className="mb-1 block font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
                  Knowledge Sources
                </label>
                <div className="flex flex-wrap gap-1">
                  {KB_SOURCES.map((k) => {
                    const active = knowledgeSources.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleKSource(k)}
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold transition-colors ${
                          active
                            ? 'bg-merris-primary text-white'
                            : 'border border-merris-border bg-white text-merris-text-tertiary hover:border-merris-primary'
                        }`}
                      >
                        {active ? `${k} ✕` : k}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category */}
              <div className="mb-3">
                <label className="mb-1 block font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-merris-sm border border-merris-border-medium bg-white px-2.5 py-1.5 font-body text-[12px] text-merris-text outline-none focus:ring-2 focus:ring-merris-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Output Format */}
              <div className="mb-3">
                <label className="mb-1 block font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
                  Output Format
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['report', 'json'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setOutputFormat(fmt)}
                      className={`cursor-pointer rounded-merris-sm border-[1.5px] px-2 py-2 text-center font-display text-[11px] font-medium transition-colors ${
                        outputFormat === fmt
                          ? 'border-merris-primary bg-merris-primary-bg text-merris-primary'
                          : 'border-merris-border-medium text-merris-text-secondary hover:border-merris-primary'
                      }`}
                    >
                      {fmt === 'report' ? 'Report' : 'JSON'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div className="mb-4">
                <label className="mb-1 block font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
                  Permissions
                </label>
                {(
                  [
                    { val: 'everyone', label: 'Everyone in workspace' },
                    { val: 'analysts', label: 'Lead Analysts only' },
                    { val: 'only-me', label: 'Only me' },
                  ] as const
                ).map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPermission(val)}
                    className={`flex w-full items-center gap-1.5 py-1 font-body text-[11px] ${
                      permission === val ? 'text-merris-primary' : 'text-merris-text-secondary'
                    }`}
                  >
                    <div
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] ${
                        permission === val ? 'border-merris-primary' : 'border-merris-border-medium'
                      }`}
                    >
                      {permission === val && (
                        <div className="h-2 w-2 rounded-full bg-merris-primary" />
                      )}
                    </div>
                    {label}
                  </button>
                ))}
              </div>

              <MerrisButton
                variant="primary"
                className="w-full justify-center"
                onClick={() => saveAgent(true)}
                disabled={saving || steps.length === 0}
              >
                {saving ? 'Saving…' : 'Save Agent'}
              </MerrisButton>
            </MerrisCard>

            <MerrisCard className="bg-merris-primary" style={{ padding: '14px 16px' }}>
              <div className="mb-2 inline-block rounded-full bg-white/20 px-2 py-0.5 font-body text-[10px] font-semibold uppercase text-white">
                AI Insight
              </div>
              <p className="font-body text-[11px] leading-relaxed text-white/90">
                {selectedFrameworks.includes('ESRS')
                  ? 'ESRS E1 requires Scope 3 category disclosure. Consider adding a "Scope 3 Boundary" validation step.'
                  : 'Add a Knowledge Retrieval step to ground the agent in your KB before analysis.'}
              </p>
            </MerrisCard>
          </div>
        </div>
      )}
    </div>
  );
}
