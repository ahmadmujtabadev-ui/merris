'use client';

import { useState, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';

const PRIMARY = '#0b5142';

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
const OUTPUT_FORMATS = ['Report', 'JSON', 'Word', 'Excel'] as const;
type OutputFormat = typeof OUTPUT_FORMATS[number];
type Permission = 'everyone' | 'analysts' | 'only-me';

const STEP_TYPES: Record<string, { label: string; color: string }> = {
  trigger:         { label: 'TRIGGER',       color: '#16a34a' },
  transform:       { label: 'TRANSFORM',     color: '#0e7490' },
  'kb-search':     { label: 'KB-SEARCH',     color: '#0369a1' },
  kb_search:       { label: 'KB-SEARCH',     color: '#0369a1' },
  'llm-reason':    { label: 'LLM-REASON',    color: '#7c3aed' },
  llm_reason:      { label: 'LLM-REASON',    color: '#7c3aed' },
  condition:       { label: 'CONDITION',     color: '#be185d' },
  'human-in-loop': { label: 'HUMAN-IN-LOOP', color: '#dc2626' },
  hil:             { label: 'HUMAN-IN-LOOP', color: '#dc2626' },
  output:          { label: 'OUTPUT',        color: '#374151' },
};

function resolveStepType(tool: string) {
  const key = tool.toLowerCase().replace(/[\s]/g, '-');
  return STEP_TYPES[key] ?? STEP_TYPES[tool] ?? { label: tool.toUpperCase(), color: '#9aa0a6' };
}

interface BuilderStep {
  id: string;
  name: string;
  description: string;
  tool: string;
}

export interface OpenTemplate {
  templateId: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
}

interface BuilderTabProps {
  openTemplate?: OpenTemplate | null;
  mode?: 'describe' | 'visual';
  onModeChange?: (m: 'describe' | 'visual') => void;
}

export function BuilderTab({ openTemplate, mode: externalMode, onModeChange }: BuilderTabProps = {}) {
  const [internalMode, setInternalMode] = useState<'describe' | 'visual'>('describe');
  const mode = externalMode ?? internalMode;

  const setMode = (m: 'describe' | 'visual') => {
    if (onModeChange) onModeChange(m);
    else setInternalMode(m);
  };

  const [agentName, setAgentName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<BuilderStep[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [genError, setGenError] = useState<string | null>(null);

  const [jurisdiction, setJurisdiction] = useState('EU (CSRD)');
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(['ESRS', 'GRI']);
  const [knowledgeSources, setKnowledgeSources] = useState<string[]>(['K1', 'K3', 'K7']);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('Report');
  const [permission, setPermission] = useState<Permission>('everyone');
  const [category, setCategory] = useState('Compliance');

  useEffect(() => {
    if (openTemplate) {
      if (onModeChange) onModeChange('visual');
      else setInternalMode('visual');
    }
  }, [openTemplate, onModeChange]);

  function toggleFramework(fw: string) {
    setSelectedFrameworks((prev) => prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]);
  }

  function toggleKSource(k: string) {
    setKnowledgeSources((prev) => prev.includes(k) ? prev.filter((s) => s !== k) : [...prev, k]);
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
      const res = await api.generateBuilderSteps(description.trim(), jurisdiction, selectedFrameworks.join(', '));
      setSteps(res.steps);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate steps');
    } finally {
      setGenerating(false);
    }
  };

  const saveAgent = async (publish: boolean) => {
    if (!agentName.trim()) { setGenError('Please enter an agent name before saving.'); return; }
    if (steps.length === 0) { setGenError('Generate steps first before saving.'); return; }
    setSaving(true);
    setSaveStatus('idle');
    try {
      await api.saveWorkflowTemplate({
        name: agentName.trim(),
        description: description.trim(),
        category: publish ? category : 'Custom',
        steps: steps.map((s) => ({ id: s.id, name: s.name, description: s.description, tool: s.tool, inputs: {} })),
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

  const estTime = steps.length > 0 ? `~${steps.length * 12}s` : '~90s';
  const scopeLabel = knowledgeSources.length > 0
    ? knowledgeSources.slice(0, 3).join(', ') + (knowledgeSources.length > 3 ? '…' : '') + ' in scope'
    : 'no KB selected';

  return (
    <div>
      {mode === 'visual' && (
        <VisualBuilder
          agentName={(openTemplate?.name ?? agentName) || 'New Agent'}
          templateId={openTemplate?.templateId}
          initialNodes={openTemplate?.nodes}
          initialEdges={openTemplate?.edges}
        />
      )}

      {mode === 'describe' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

          {/* ── Left column ─────────────────────────────────────────── */}
          <div>
            {/* Combined Agent Name + Describe card */}
            <div className="mb-5 overflow-hidden rounded-xl border bg-white" style={{ borderColor: '#e8eae8' }}>
              <div className="p-6">
                {/* AGENT NAME */}
                <div className="mb-5">
                  <label className="mb-1.5 flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                    Agent Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="e.g. ESRS Gap Analyser"
                    className="w-full rounded-lg border px-4 py-3 font-body text-[13px] text-merris-text outline-none focus:ring-2 focus:ring-merris-primary"
                    style={{ borderColor: '#e8eae8', background: '#fcfcfb' }}
                  />
                  <p className="mt-1.5 font-body text-[11px]" style={{ color: '#9aa0a6' }}>
                    Used in the library, history and audit trail.
                  </p>
                </div>

                {/* DESCRIBE THE WORKFLOW */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                    Describe the Workflow <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    placeholder="e.g. Conduct ESRS-aligned materiality assessment. Cross-reference GRI, flag Scope 3 discrepancies. Output prioritised compliance items for committee review."
                    className="w-full resize-none rounded-lg border p-4 font-body text-[13px] leading-relaxed text-merris-text outline-none focus:ring-2 focus:ring-merris-primary"
                    style={{ borderColor: '#e8eae8', background: '#fcfcfb' }}
                  />
                  <p className="mt-1.5 font-body text-[11px]" style={{ color: '#9aa0a6' }}>
                    Plain English. Merris will translate this into executable steps using Claude.
                  </p>
                </div>

                {genError && (
                  <div className="mt-3 rounded-lg px-3 py-2.5 font-body text-[11px] text-red-600" style={{ background: '#fef2f2' }}>
                    {genError}
                  </div>
                )}
              </div>

              {/* Estimate + Generate row */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ background: '#f5f5f0', borderTop: '1px solid #ebebea' }}
              >
                <div className="flex items-center gap-2 font-mono text-[10px]" style={{ color: '#9aa0a6' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                  </svg>
                  Estimated · 6–8 nodes · {estTime} per run · {scopeLabel}
                </div>
                <button
                  type="button"
                  onClick={generate}
                  disabled={generating}
                  className="flex items-center gap-2 rounded-lg px-5 py-2.5 font-display text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: PRIMARY }}
                >
                  <span>✦</span>
                  {generating ? 'Generating…' : 'Generate steps'}
                </button>
              </div>
            </div>

            {/* Generated execution plan */}
            {steps.length > 0 && (
              <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: '#e8eae8' }}>
                {/* Plan header */}
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #f0f0ed' }}>
                  <div className="flex items-center gap-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="1.5">
                      <path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z"/>
                    </svg>
                    <span className="font-display text-[14px] font-semibold text-merris-text">Generated execution plan</span>
                    <div className="flex items-center gap-1 font-mono text-[10px]" style={{ color: '#9aa0a6' }}>
                      <span className="rounded-full px-2 py-0.5" style={{ background: '#f0f0ed' }}>{steps.length} steps</span>
                      <span>·</span>
                      <span className="rounded-full px-2 py-0.5" style={{ background: '#f0f0ed' }}>{Math.max(0, steps.length - 1)} edges</span>
                      <span>·</span>
                      <span className="rounded-full px-2 py-0.5" style={{ background: '#f0f0ed' }}>{estTime}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('visual')}
                    className="font-body text-[11px] font-semibold hover:underline"
                    style={{ color: PRIMARY }}
                  >
                    View as graph &rsaquo;
                  </button>
                </div>

                {/* Step rows */}
                <div className="px-6">
                  {steps.map((step, i) => {
                    const st = resolveStepType(step.tool);
                    return (
                      <div
                        key={step.id}
                        className="flex items-center gap-4 py-4"
                        style={{ borderBottom: i < steps.length - 1 ? '1px solid #f5f5f0' : 'none' }}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold"
                          style={{ background: '#f3f4f5', color: '#5f6368' }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-[13px] font-semibold text-merris-text">{step.name}</div>
                          <div className="font-body text-[11px]" style={{ color: '#9aa0a6' }}>{step.description}</div>
                        </div>
                        <span
                          className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider"
                          style={{ background: st.color + '18', color: st.color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="px-6 pb-5 pt-4" style={{ borderTop: '1px solid #f0f0ed' }}>
                  {saveStatus === 'saved' && (
                    <div className="mb-3 rounded-lg px-3 py-2.5 font-body text-[11px] text-emerald-700" style={{ background: '#f0fdf4' }}>
                      ✓ Agent saved! It will appear in your Library.
                    </div>
                  )}
                  {saveStatus === 'error' && (
                    <div className="mb-3 rounded-lg px-3 py-2.5 font-body text-[11px] text-red-600" style={{ background: '#fef2f2' }}>
                      ✗ Failed to save. Check the API is running.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveAgent(true)}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg px-4 py-2 font-display text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      style={{ background: PRIMARY }}
                    >
                      {saving ? 'Publishing…' : 'Publish to Library'}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveAgent(false)}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg border px-4 py-2 font-display text-[12px] font-semibold text-merris-text-secondary transition-colors hover:border-merris-primary hover:text-merris-primary disabled:opacity-60"
                      style={{ borderColor: '#e0e2e0' }}
                    >
                      Save Draft
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Agent settings ────────────────────────────────── */}
          <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: '#e8eae8' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #e8eae8' }}>
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="1.5">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
                <span className="font-display text-[13px] font-semibold text-merris-text">Agent settings</span>
              </div>
              <span className="font-mono text-[9px]" style={{ color: '#9aa0a6' }}>auto-saved</span>
            </div>

            <div className="space-y-5 p-5">
              {/* JURISDICTION */}
              <div>
                <label className="mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                  Jurisdiction
                </label>
                <select
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 font-body text-[12px] text-merris-text outline-none focus:ring-2 focus:ring-merris-primary"
                  style={{ borderColor: '#e8eae8', background: '#fcfcfb' }}
                >
                  {JURISDICTIONS.map((j) => <option key={j}>{j}</option>)}
                </select>
              </div>

              {/* FRAMEWORKS */}
              <div>
                <label className="mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                  Frameworks
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FRAMEWORK_OPTIONS.map((fw) => {
                    const active = selectedFrameworks.includes(fw);
                    return (
                      <button
                        key={fw}
                        type="button"
                        onClick={() => toggleFramework(fw)}
                        className="rounded-md px-2.5 py-1 font-mono text-[10px] font-bold transition-colors"
                        style={{
                          background: active ? PRIMARY : 'transparent',
                          color: active ? '#fff' : '#9aa0a6',
                          border: active ? `1px solid ${PRIMARY}` : '1px solid #e0e2e0',
                        }}
                      >
                        {fw}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* KNOWLEDGE SOURCES */}
              <div>
                <label className="mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                  Knowledge Sources
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {KB_SOURCES.map((k) => {
                    const active = knowledgeSources.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleKSource(k)}
                        className="flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-[10px] font-bold transition-colors"
                        style={{
                          background: active ? PRIMARY + '14' : 'transparent',
                          color: active ? PRIMARY : '#9aa0a6',
                          border: `1px solid ${active ? PRIMARY + '50' : '#e0e2e0'}`,
                        }}
                      >
                        {k}
                        {active && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CATEGORY */}
              <div>
                <label className="mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                  Category
                </label>
                <div className="relative flex items-center">
                  <span
                    className="absolute left-3 h-2.5 w-2.5 rounded-sm"
                    style={{ background: '#7c3aed' }}
                  />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border py-2 pl-7 pr-3 font-body text-[12px] text-merris-text outline-none focus:ring-2 focus:ring-merris-primary"
                    style={{ borderColor: '#e8eae8', background: '#fcfcfb' }}
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* OUTPUT FORMAT */}
              <div>
                <label className="mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                  Output Format
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {OUTPUT_FORMATS.map((fmt) => {
                    const active = outputFormat === fmt;
                    return (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setOutputFormat(fmt)}
                        className="rounded-lg py-2 text-center font-display text-[12px] font-semibold transition-colors"
                        style={{
                          background: active ? PRIMARY : 'transparent',
                          color: active ? '#fff' : '#5f6368',
                          border: active ? `1px solid ${PRIMARY}` : '1px solid #e0e2e0',
                        }}
                      >
                        {fmt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PERMISSIONS */}
              <div>
                <label className="mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                  Permissions
                </label>
                {([
                  { val: 'everyone', label: 'Everyone in workspace' },
                  { val: 'analysts', label: 'Lead Analysts only' },
                  { val: 'only-me', label: 'Only me' },
                ] as const).map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPermission(val)}
                    className="flex w-full items-center gap-2.5 py-1.5 text-left font-body text-[12px]"
                    style={{ color: permission === val ? PRIMARY : '#5f6368' }}
                  >
                    <div
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                      style={{ border: `2px solid ${permission === val ? PRIMARY : '#d0d5d0'}` }}
                    >
                      {permission === val && (
                        <div className="h-2 w-2 rounded-full" style={{ background: PRIMARY }} />
                      )}
                    </div>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Save button */}
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => saveAgent(true)}
                disabled={saving || steps.length === 0}
                className="w-full rounded-lg py-3 text-center font-display text-[13px] font-semibold text-white transition-colors"
                style={{ background: steps.length > 0 && !saving ? PRIMARY : '#c4cac4' }}
              >
                {saving ? 'Saving…' : steps.length === 0 ? 'Save · once steps generated' : 'Save agent'}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
