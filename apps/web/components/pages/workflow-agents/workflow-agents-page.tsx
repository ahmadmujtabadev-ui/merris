'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, type WorkflowTemplate, type ReActExecution } from '@/lib/api';
import { useEngagementStore, useWorkflowStore } from '@/lib/store';
import { AGENTS_PREBUILT, AGENTS_CUSTOM, AGENT_CATEGORIES, type AgentEntry } from './workflow-agents-data';
import { BuilderTab, type OpenTemplate } from './builder-tab';
import { ReActResultsPanel } from './react-results-panel';
import { stepsToGraph } from './visual-builder/flow-utils';
import type { Node, Edge } from '@xyflow/react';

// ── Design tokens ─────────────────────────────────────────────────
const PRIMARY = '#0b5142';

// ── Node type → border color for hollow preview squares ───────────
const NODE_COLORS: Record<string, string> = {
  trigger:      '#16a34a',
  'kb-search':  '#0369a1',
  'llm-reason': '#7c3aed',
  'tool-call':  '#b45309',
  condition:    '#be185d',
  transform:    '#0e7490',
  output:       '#374151',
};

// ── Avatar color palette ─────────────────────────────────────────
const AVATAR_PALETTE = [
  '#0b5142', '#1e3a5f', '#5b21b6', '#b45309',
  '#0e7490', '#be185d', '#374151', '#16a34a',
];

function avatarColor(index: number) {
  return AVATAR_PALETTE[index % AVATAR_PALETTE.length]!;
}

function agentAbbrev(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 1);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Node preview strip (hollow squares connected by dashes) ───────
function NodePreviewStrip({ steps }: { steps: string[] }) {
  return (
    <div className="flex items-center rounded-lg px-2.5 py-1.5" style={{ background: '#f5f5f0' }}>
      {steps.map((type, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && (
            <span className="mx-0.5 flex items-center">
              <svg width="12" height="2" viewBox="0 0 12 2" fill="none">
                <line x1="0" y1="1" x2="12" y2="1" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="2 2"/>
              </svg>
            </span>
          )}
          <span
            className="flex h-[14px] w-[14px] items-center justify-center rounded-[3px] bg-white"
            style={{ border: `1.5px solid ${NODE_COLORS[type] ?? '#9ca3af'}` }}
          />
        </span>
      ))}
      <span className="ml-2.5 font-mono text-[10px]" style={{ color: '#9aa0a6' }}>
        {steps.length} nodes
      </span>
    </div>
  );
}

// ── Agent status/stats line ────────────────────────────────────────
function AgentStats({ runs, rating }: { runs?: number; rating?: number }) {
  const okPct = rating != null ? Math.min(100, Math.round(rating * 20)) : null;
  if (!runs) return null;
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: PRIMARY }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIMARY }} />
      <span style={{ color: '#5f6368' }}>
        {runs.toLocaleString()} runs
        {okPct != null && <> · {okPct}% ok</>}
      </span>
    </div>
  );
}

// ── SYSTEM badge with lock icon ────────────────────────────────────
function SystemBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-white"
      style={{ background: PRIMARY }}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
      SYSTEM
    </span>
  );
}

// ── Types ─────────────────────────────────────────────────────────
type ViewAgent = AgentEntry & { realTemplateId?: string };

interface RunFeedback {
  templateId: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed';
  message?: string;
  reactExecution?: ReActExecution;
}

function templatesToViewAgents(templates: WorkflowTemplate[]): ViewAgent[] {
  return templates.map((t) => {
    const stepTypes = (t.graph?.nodes ?? [])
      .map((n) => (n as { type?: string }).type ?? '')
      .filter(Boolean);
    return {
      name: t.name,
      description: t.description,
      category: t.category,
      iconLabel: '⚡',
      realTemplateId: t.id,
      stepTypes: stepTypes.length > 0 ? stepTypes : undefined,
    };
  });
}

function matchesSearch(a: ViewAgent, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return a.name.toLowerCase().includes(lower) || a.description.toLowerCase().includes(lower);
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function durationFmt(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '—';
  if (!completedAt) return 'running…';
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

// ── Main page ─────────────────────────────────────────────────────
export function WorkflowAgentsPage() {
  const [tab, setTab] = useState<'library' | 'builder'>('library');
  const [builderMode, setBuilderMode] = useState<'describe' | 'visual'>('describe');
  const [category, setCategory] = useState<(typeof AGENT_CATEGORIES)[number]>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy] = useState<'last-edited' | 'name' | 'runs'>('last-edited');
  const [customAgents, setCustomAgents] = useState<ViewAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [runFeedback, setRunFeedback] = useState<RunFeedback | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [openTemplate, setOpenTemplate] = useState<OpenTemplate | null>(null);
  const currentEngagement = useEngagementStore((s) => s.currentEngagement);
  const { executions, fetchHistory: fetchWorkflowHistory } = useWorkflowStore();

  useEffect(() => { fetchWorkflowHistory(); }, [fetchWorkflowHistory]);

  const loadTemplates = useCallback(() => {
    setLoading(true);
    api.listWorkflowTemplates()
      .then((res) => {
        const fromApi = res.templates?.length > 0 ? templatesToViewAgents(res.templates) : [];
        setCustomAgents([...fromApi, ...AGENTS_CUSTOM]);
      })
      .catch(() => setCustomAgents([...AGENTS_CUSTOM]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { if (tab === 'library') loadTemplates(); }, [tab, loadTemplates]);

  const systemAgents = AGENTS_PREBUILT as ViewAgent[];
  const allAgents = [...systemAgents, ...customAgents];
  const totalAgents = allAgents.length;
  const runningCount = executions.filter((e) => e.status === 'running').length;

  const filteredSystem = systemAgents.filter(
    (a) => (category === 'All' || a.category === category) && matchesSearch(a, searchQuery),
  );
  const filteredCustom = customAgents.filter(
    (a) => (category === 'All' || a.category === category) && matchesSearch(a, searchQuery),
  );

  // Category counts
  const categoryCounts = (AGENT_CATEGORIES as readonly string[]).reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = cat === 'All' ? totalAgents : allAgents.filter((a) => a.category === cat).length;
    return acc;
  }, {});

  const handleRun = async (agent: ViewAgent) => {
    if (!agent.realTemplateId) {
      setRunFeedback({ templateId: agent.name, agentName: agent.name, status: 'failed', message: 'This is a system template — save it first via Agent Builder.' });
      return;
    }
    if (!currentEngagement) {
      setRunFeedback({ templateId: agent.realTemplateId, agentName: agent.name, status: 'failed', message: 'Select an engagement from the top bar first.' });
      return;
    }
    setRunFeedback({ templateId: agent.realTemplateId, agentName: agent.name, status: 'running', message: `Starting "${agent.name}"…` });
    setShowResults(false);
    try {
      const execution = await api.runReActAgent(agent.realTemplateId, currentEngagement.id, {});
      fetchWorkflowHistory();
      setRunFeedback({
        templateId: agent.realTemplateId,
        agentName: agent.name,
        status: execution.status as 'completed' | 'failed',
        message: execution.status === 'failed'
          ? execution.error ?? 'Agent failed'
          : `${agent.name} completed · ${execution.steps.length} steps`,
        reactExecution: execution,
      });
      if (execution.status === 'completed') setShowResults(true);
    } catch (err) {
      setRunFeedback({
        templateId: agent.realTemplateId,
        agentName: agent.name,
        status: 'failed',
        message: err instanceof Error ? err.message : 'Failed',
      });
    }
  };

  const handleOpenInBuilder = async (agent: ViewAgent) => {
    if (!agent.realTemplateId) return;
    try {
      const template = await api.getWorkflowTemplate(agent.realTemplateId);
      let nodes: Node[];
      let edges: Edge[];
      if (template.graph && template.graph.nodes.length > 0) {
        nodes = template.graph.nodes as Node[];
        edges = template.graph.edges as Edge[];
      } else {
        const graph = stepsToGraph(template.steps);
        nodes = graph.nodes;
        edges = graph.edges;
      }
      setOpenTemplate({ templateId: template.id, name: template.name, nodes, edges });
      setTab('builder');
    } catch { /* ignore */ }
  };

  const handleForkToEdit = (_agent: ViewAgent) => {
    setOpenTemplate(null);
    setBuilderMode('describe');
    setTab('builder');
  };

  return (
    <div className="px-6 py-5">
      {showResults && runFeedback?.status === 'completed' && runFeedback.reactExecution && (
        <ReActResultsPanel execution={runFeedback.reactExecution} onClose={() => setShowResults(false)} />
      )}

      {/* ── Page hero ─────────────────────────────────────────── */}
      <div className="mb-5">
        {/* Breadcrumb eyebrow */}
        <div className="mb-3 flex items-center gap-2">
          <div className="h-px w-4" style={{ background: PRIMARY }} />
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: PRIMARY }}>
            Workflow Agents · Build · Orchestrate · Run
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[30px] font-normal leading-tight text-merris-text">
              Build agents that <em style={{ fontStyle: 'italic', color: PRIMARY }}>think</em> like analysts.
            </h1>
            <p className="mt-1.5 max-w-lg font-body text-[12px] leading-relaxed text-merris-text-secondary">
              Compose multi-step workflows over your knowledge base. Drag nodes, draw connections,
              wire human review where it matters. Run on demand or on schedule.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-merris-border bg-white px-3 py-2 font-body text-[11px] text-merris-text-secondary transition-colors hover:border-merris-primary hover:text-merris-primary"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Import YAML
            </button>
            <button
              type="button"
              onClick={() => setTab('builder')}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 font-display text-[12px] font-semibold text-white"
              style={{ background: PRIMARY }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Build agent
            </button>
          </div>
        </div>

        {/* Stats pills */}
        <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIMARY }} />
            <span className="text-merris-text">
              {totalAgents} agents ·{' '}
              <span className="text-merris-text-secondary">{systemAgents.length} system · {customAgents.length} custom</span>
            </span>
          </div>
          {runningCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              <span className="text-amber-700">{runningCount} runs in progress</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-merris-text-tertiary">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span>auto-saved</span>
          </div>
        </div>
      </div>

      {/* ── Tab switcher ──────────────────────────────────────── */}
      <div className="mb-5 flex items-center gap-0" style={{ borderBottom: '1px solid #e8eae8' }}>
        <button
          type="button"
          onClick={() => { setTab('library'); setOpenTemplate(null); }}
          className="flex items-center gap-1.5 px-4 py-2.5 font-display text-[12px] font-semibold transition-colors"
          style={{
            color: tab === 'library' ? PRIMARY : '#5f6368',
            borderBottom: tab === 'library' ? `2px solid ${PRIMARY}` : '2px solid transparent',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          Library
          <span className="rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold" style={{ background: tab === 'library' ? PRIMARY : '#edeef0', color: tab === 'library' ? '#fff' : '#5f6368' }}>
            {totalAgents}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('builder')}
          className="flex items-center gap-1.5 px-4 py-2.5 font-display text-[12px] font-semibold transition-colors"
          style={{
            color: tab === 'builder' ? PRIMARY : '#5f6368',
            borderBottom: tab === 'builder' ? `2px solid ${PRIMARY}` : '2px solid transparent',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
          Agent Builder
        </button>

        {/* Describe / Visual sub-mode pills — only when builder is active */}
        {tab === 'builder' && (
          <>
            <div className="mx-3 h-4 w-px self-center" style={{ background: '#e0e2e0' }} />
            <button
              type="button"
              onClick={() => setBuilderMode('describe')}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-display text-[12px] font-semibold transition-colors"
              style={{
                background: builderMode === 'describe' ? PRIMARY : 'transparent',
                color: builderMode === 'describe' ? '#fff' : '#5f6368',
                border: builderMode === 'describe' ? 'none' : '1px solid #e0e2e0',
                marginBottom: '8px',
              }}
            >
              Describe
            </button>
            <div className="ml-1.5">
              <button
                type="button"
                onClick={() => setBuilderMode('visual')}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-display text-[12px] font-semibold transition-colors"
                style={{
                  background: 'transparent',
                  color: builderMode === 'visual' ? PRIMARY : '#5f6368',
                  border: builderMode === 'visual' ? `1px solid ${PRIMARY}` : '1px solid #e0e2e0',
                  marginBottom: '8px',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
                Visual
              </button>
            </div>
          </>
        )}
      </div>

      {tab === 'builder' && (
        <BuilderTab
          openTemplate={openTemplate}
          mode={builderMode}
          onModeChange={setBuilderMode}
        />
      )}

      {tab === 'library' && (
        <>
          {/* Run feedback banner */}
          {runFeedback && (
            <div
              className={`mb-4 flex items-center justify-between rounded-xl border-l-[3px] bg-white p-4 shadow-sm ${
                runFeedback.status === 'completed' ? 'border-emerald-500'
                  : runFeedback.status === 'failed' ? 'border-red-500'
                  : 'border-merris-primary'
              }`}
            >
              <div>
                <div className={`font-display text-[12px] font-semibold ${
                  runFeedback.status === 'completed' ? 'text-emerald-700'
                    : runFeedback.status === 'failed' ? 'text-red-600'
                    : 'text-merris-primary'
                }`}>
                  {runFeedback.status === 'running' && '▶ Running'}
                  {runFeedback.status === 'completed' && '✓ Completed'}
                  {runFeedback.status === 'failed' && '✗ Failed'}
                </div>
                <div className="font-body text-[11px] text-merris-text-secondary">{runFeedback.message}</div>
              </div>
              {runFeedback.status === 'completed' && (
                <button
                  type="button"
                  onClick={() => setShowResults(true)}
                  className="rounded-lg px-3 py-1.5 font-body text-[11px] font-semibold text-white"
                  style={{ background: PRIMARY }}
                >
                  View Results →
                </button>
              )}
            </div>
          )}

          {/* ── Search + filters ──────────────────────────────── */}
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-merris-border bg-white px-4 py-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents by name, capability or framework — try &quot;Scope 3&quot;…"
              className="flex-1 bg-transparent font-body text-[12px] text-merris-text outline-none placeholder:text-merris-text-tertiary"
            />
            <span className="shrink-0 font-mono text-[10px] text-merris-text-tertiary">
              {filteredSystem.length + filteredCustom.length} agents
            </span>
            <div className="h-3.5 w-px bg-merris-border" />
            <div className="flex items-center gap-1">
              <span className="font-body text-[11px] text-merris-text-tertiary">Sort:</span>
              <select className="bg-transparent font-body text-[11px] text-merris-text outline-none">
                <option>Last edited</option>
                <option>Name</option>
                <option>Most runs</option>
              </select>
            </div>
          </div>

          {/* Category chips with counts */}
          <div className="mb-6 flex flex-wrap gap-1.5">
            {AGENT_CATEGORIES.map((c) => {
              const count = categoryCounts[c] ?? 0;
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-[11px] font-semibold transition-colors"
                  style={{
                    background: active ? PRIMARY : '#f3f4f5',
                    color: active ? '#fff' : '#5f6368',
                    border: active ? 'none' : '1px solid rgba(0,107,95,0.08)',
                  }}
                >
                  {c}
                  {count > 0 && (
                    <span
                      className="rounded-full px-1 py-0.5 font-mono text-[9px] font-bold"
                      style={{
                        background: active ? 'rgba(255,255,255,0.25)' : 'rgba(0,107,95,0.1)',
                        color: active ? '#fff' : PRIMARY,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ══ System agents ════════════════════════════════════ */}
          <div className="mb-8">
            {/* Section header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span className="font-display text-[12px] font-semibold text-merris-text">System agents</span>
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-merris-text-tertiary">/ BUILT BY MERRIS</span>
              </div>
              <button type="button" className="font-body text-[11px] text-merris-text-tertiary hover:text-merris-text underline underline-offset-2">
                {systemAgents.length} total &rsaquo;
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-merris-border bg-white p-5">
                    <div className="mb-4 flex gap-3">
                      <div className="h-10 w-10 rounded-xl bg-merris-surface-low" />
                      <div className="flex-1"><div className="mb-1.5 h-4 w-3/4 rounded bg-merris-surface-low" /><div className="h-3 w-1/3 rounded bg-merris-surface-low" /></div>
                    </div>
                    <div className="h-3 w-full rounded bg-merris-surface-low" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredSystem.map((a, idx) => (
                  <div
                    key={a.name}
                    className="flex flex-col rounded-xl border bg-white transition-shadow hover:shadow-md"
                    style={{ borderColor: '#e8eae8' }}
                  >
                    <div className="flex-1 p-5">
                      {/* Card header */}
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl font-display text-[13px] font-bold text-white"
                            style={{ background: avatarColor(idx) }}
                          >
                            {agentAbbrev(a.name)}
                          </div>
                          <div>
                            <div className="font-display text-[14px] font-bold leading-tight text-merris-text">{a.name}</div>
                            <div className="font-body text-[10px] text-merris-text-tertiary">by Merris · system</div>
                          </div>
                        </div>
                        <SystemBadge />
                      </div>

                      {/* Description */}
                      <p className="mb-3.5 font-body text-[12px] leading-relaxed text-merris-text-secondary">{a.description}</p>

                      {/* Node preview strip */}
                      {a.stepTypes && <NodePreviewStrip steps={a.stepTypes} />}

                      {/* Stats line */}
                      <div className="mt-3">
                        <AgentStats runs={a.runs} rating={a.rating} />
                      </div>
                    </div>

                    {/* Card footer buttons */}
                    <div className="flex items-center gap-2 border-t px-5 py-3.5" style={{ borderColor: '#f0f0ed' }}>
                      <button
                        type="button"
                        onClick={() => handleRun(a)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-display text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: PRIMARY }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        Run agent
                      </button>
                      <button
                        type="button"
                        onClick={() => handleForkToEdit(a)}
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-2 font-body text-[11px] text-merris-text-secondary transition-colors hover:border-merris-primary hover:text-merris-primary"
                        style={{ borderColor: '#e0e2e0' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 9v6"/><path d="M18 9a9 9 0 01-9 9"/></svg>
                        Fork to edit
                      </button>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border font-body text-[13px] text-merris-text-tertiary transition-colors hover:bg-merris-surface-low"
                        style={{ borderColor: '#e0e2e0' }}
                      >
                        ···
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══ Custom agents ════════════════════════════════════ */}
          {(filteredCustom.length > 0 || !loading) && (
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                  <span className="font-display text-[12px] font-semibold text-merris-text">Custom</span>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-merris-text-tertiary">/ YOUR TEAM</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredCustom.map((a, idx) => (
                  <div
                    key={a.realTemplateId ?? a.name}
                    className="flex flex-col rounded-xl border bg-white transition-shadow hover:shadow-md"
                    style={{ borderColor: '#e8eae8' }}
                  >
                    <div className="flex-1 p-5">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl font-display text-[13px] font-bold text-white"
                            style={{ background: avatarColor(idx + systemAgents.length) }}
                          >
                            {agentAbbrev(a.name)}
                          </div>
                          <div>
                            <div className="font-display text-[14px] font-bold leading-tight text-merris-text">{a.name}</div>
                            {a.by ? (
                              <div className="font-body text-[10px] text-merris-text-tertiary">by {a.by}</div>
                            ) : (
                              <div className="font-body text-[10px] text-merris-text-tertiary">your workspace</div>
                            )}
                          </div>
                        </div>
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider"
                          style={a.realTemplateId
                            ? { background: '#fef3c7', color: '#92400e' }
                            : { background: '#f3f4f5', color: '#9aa0a6' }
                          }
                        >
                          {a.realTemplateId ? 'CUSTOM' : 'DRAFT'}
                        </span>
                      </div>
                      <p className="mb-3.5 font-body text-[12px] leading-relaxed text-merris-text-secondary">{a.description}</p>

                      {/* Node preview strip */}
                      {a.stepTypes && <NodePreviewStrip steps={a.stepTypes} />}

                      {/* Stats line */}
                      <div className="mt-3">
                        <AgentStats runs={a.runs} rating={a.rating} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 border-t px-5 py-3.5" style={{ borderColor: '#f0f0ed' }}>
                      <button
                        type="button"
                        onClick={() => handleRun(a)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-display text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: PRIMARY }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        Run agent
                      </button>
                      {a.realTemplateId && (
                        <button
                          type="button"
                          onClick={() => handleOpenInBuilder(a)}
                          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 font-body text-[11px] text-merris-text-secondary transition-colors hover:border-merris-primary hover:text-merris-primary"
                          style={{ borderColor: '#e0e2e0' }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border font-body text-[13px] text-merris-text-tertiary transition-colors hover:bg-merris-surface-low"
                        style={{ borderColor: '#e0e2e0' }}
                      >
                        ···
                      </button>
                    </div>
                  </div>
                ))}

                {/* Build custom card */}
                <button
                  type="button"
                  onClick={() => setTab('builder')}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-transparent p-8 transition-colors hover:bg-merris-surface-low"
                  style={{ borderColor: 'rgba(0,107,95,0.15)' }}
                >
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl font-mono text-[20px] font-light"
                    style={{ background: '#f0f5f3', color: PRIMARY }}
                  >
                    +
                  </div>
                  <div className="font-display text-[13px] font-semibold text-merris-text">Build custom agent</div>
                  <div className="mt-1 font-body text-[10px] text-merris-text-tertiary">Create from natural language</div>
                </button>
              </div>
            </div>
          )}

          {/* ══ Recently Run table ════════════════════════════════ */}
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex shrink-0 items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                <span className="font-display text-[12px] font-semibold text-merris-text">Recently run</span>
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-merris-text-tertiary">/ ACROSS THE FIRM</span>
              </div>
              <div className="h-px flex-1" style={{ background: '#e8eae8' }} />
              <button
                type="button"
                className="shrink-0 rounded border px-3 py-1.5 font-body text-[11px] font-semibold text-merris-text transition-colors hover:border-merris-primary hover:text-merris-primary"
                style={{ borderColor: '#d0d5d0' }}
              >
                Open History &rsaquo;
              </button>
            </div>

            {executions.length === 0 ? (
              <div className="rounded-xl border border-merris-border bg-white px-6 py-8 text-center">
                <div className="font-body text-[12px] text-merris-text-tertiary">No workflow runs yet. Run an agent above to see history here.</div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: '#e8eae8' }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: '#f9f9f7', borderBottom: '1px solid #e8eae8' }}>
                      <th className="px-5 py-2.5 text-left font-mono text-[9px] font-bold uppercase tracking-widest text-merris-text-tertiary">Agent</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[9px] font-bold uppercase tracking-widest text-merris-text-tertiary">Status</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[9px] font-bold uppercase tracking-widest text-merris-text-tertiary">Duration</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[9px] font-bold uppercase tracking-widest text-merris-text-tertiary">By</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[9px] font-bold uppercase tracking-widest text-merris-text-tertiary">Run</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.slice(0, 8).map((e, idx) => {
                      const abbrev = agentAbbrev(e.templateId);
                      const color = avatarColor(idx);
                      const duration = durationFmt(e.startedAt, e.completedAt);
                      const ago = timeAgo(e.startedAt);
                      const runId = `r_${e.id.slice(-4)}`;
                      const statusColors = {
                        completed: { dot: '#16a34a', text: '#15803d', bg: '#f0fdf4' },
                        failed:    { dot: '#dc2626', text: '#dc2626', bg: '#fef2f2' },
                        running:   { dot: '#b45309', text: '#b45309', bg: '#fffbeb' },
                      };
                      const sc = statusColors[e.status as keyof typeof statusColors] ?? statusColors.completed;

                      return (
                        <tr
                          key={e.id}
                          className="cursor-pointer transition-colors hover:bg-merris-surface-low"
                          style={{ borderBottom: '1px solid #f0f0ed' }}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-[11px] font-bold text-white"
                                style={{ background: color }}
                              >
                                {abbrev}
                              </div>
                              <div>
                                <div className="font-display text-[12px] font-semibold text-merris-text">{e.templateId}</div>
                                <div className="font-mono text-[9px] text-merris-text-tertiary">run · {runId} · {ago}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
                              style={{ color: sc.text, background: sc.bg }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc.dot }} />
                              {e.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-merris-text-secondary">{duration}</td>
                          <td className="px-4 py-3.5">
                            <span className="font-body text-[11px] text-merris-text-tertiary">—</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              className="font-body text-[11px] font-semibold hover:underline"
                              style={{ color: PRIMARY }}
                              onClick={() => {
                                setRunFeedback({
                                  templateId: e.templateId,
                                  agentName: e.templateId,
                                  status: e.status as 'completed' | 'failed' | 'running',
                                  message: `${e.currentStep}/${e.totalSteps} steps`,
                                });
                              }}
                            >
                              View &rsaquo;
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
