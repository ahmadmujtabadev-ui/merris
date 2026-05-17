'use client';

import { useState, useEffect, useCallback } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { Pill } from '@/components/merris/pill';
import { Chip } from '@/components/merris/chip';
import { SectionLabel } from '@/components/merris/label';
import { api, type WorkflowTemplate, type ReActExecution } from '@/lib/api';
import { useEngagementStore, useWorkflowStore } from '@/lib/store';
import { AGENTS_PREBUILT, AGENTS_CUSTOM, AGENT_CATEGORIES, type AgentEntry } from './workflow-agents-data';
import { BuilderTab, type OpenTemplate } from './builder-tab';
import { ReActResultsPanel } from './react-results-panel';
import { stepsToGraph } from './visual-builder/flow-utils';
import type { Node, Edge } from '@xyflow/react';

type ViewAgent = AgentEntry & { realTemplateId?: string };

interface RunFeedback {
  templateId: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed';
  message?: string;
  reactExecution?: ReActExecution;
}

function templatesToViewAgents(templates: WorkflowTemplate[]): ViewAgent[] {
  return templates.map((t) => ({
    name: t.name,
    description: t.description,
    category: t.category,
    iconLabel: '⚡',
    realTemplateId: t.id,
  }));
}

// ResultsModal is now replaced by ReActResultsPanel (imported above)

// ── Main page ────────────────────────────────────────────────
export function WorkflowAgentsPage() {
  const [tab, setTab] = useState<'library' | 'builder'>('library');
  const [category, setCategory] = useState<(typeof AGENT_CATEGORIES)[number]>('All');
  const [agents, setAgents] = useState<ViewAgent[]>([]);
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
        if (res.templates && res.templates.length > 0) {
          setAgents([...templatesToViewAgents(res.templates), ...AGENTS_CUSTOM]);
        } else {
          setAgents([...AGENTS_PREBUILT, ...AGENTS_CUSTOM]);
        }
      })
      .catch(() => setAgents([...AGENTS_PREBUILT, ...AGENTS_CUSTOM]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    if (tab === 'library') loadTemplates();
  }, [tab, loadTemplates]);

  const filtered = agents.filter((a) => category === 'All' || a.category === category);

  const handleRun = async (agent: ViewAgent) => {
    if (!agent.realTemplateId) {
      setRunFeedback({ templateId: agent.name, agentName: agent.name, status: 'failed', message: 'This agent template is not yet connected to the backend.' });
      return;
    }
    if (!currentEngagement) {
      setRunFeedback({ templateId: agent.realTemplateId, agentName: agent.name, status: 'failed', message: 'Select an engagement from the top bar before running a workflow.' });
      return;
    }

    setRunFeedback({ templateId: agent.realTemplateId, agentName: agent.name, status: 'running', message: `ReAct agent starting for "${agent.name}"…` });
    setShowResults(false);

    try {
      const execution = await api.runReActAgent(agent.realTemplateId, currentEngagement.id, {});
      fetchWorkflowHistory();
      const fb: RunFeedback = {
        templateId: agent.realTemplateId,
        agentName: agent.name,
        status: execution.status as 'completed' | 'failed',
        message: execution.status === 'failed'
          ? execution.error ?? 'ReAct agent failed'
          : `${agent.name} completed · ${execution.iterations} reasoning iteration${execution.iterations !== 1 ? 's' : ''} · ${execution.steps.length} steps`,
        reactExecution: execution,
      };
      setRunFeedback(fb);
      if (execution.status === 'completed') setShowResults(true);
    } catch (err) {
      setRunFeedback({
        templateId: agent.realTemplateId,
        agentName: agent.name,
        status: 'failed',
        message: err instanceof Error ? err.message : 'Failed to start ReAct agent',
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
    } catch {
      // silently ignore — template may not exist on backend yet
    }
  };

  return (
    <div className="p-6">
      {/* ReAct results panel */}
      {showResults && runFeedback?.status === 'completed' && runFeedback.reactExecution && (
        <ReActResultsPanel execution={runFeedback.reactExecution} onClose={() => setShowResults(false)} />
      )}

      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="mb-1 font-display text-[24px] font-bold text-merris-text">Workflow Agents</h1>
          <p className="font-body text-[12px] text-merris-text-secondary">
            Run pre-built agents or build your own, tailored to your organisation's needs.
          </p>
        </div>
        <MerrisButton variant="primary" onClick={() => setTab('builder')}>+ Build Agent</MerrisButton>
      </div>

      {/* Tab switcher */}
      <div className="mb-5 inline-flex rounded-merris-sm bg-merris-surface-low p-1">
        <button
          type="button"
          onClick={() => { setTab('library'); setOpenTemplate(null); }}
          className={tab === 'library'
            ? 'rounded-[6px] bg-merris-primary px-4 py-1.5 font-display text-[12px] font-semibold text-white'
            : 'px-4 py-1.5 font-display text-[12px] text-merris-text-secondary'}
        >
          Library
        </button>
        <button
          type="button"
          onClick={() => setTab('builder')}
          className={tab === 'builder'
            ? 'rounded-[6px] bg-merris-primary px-4 py-1.5 font-display text-[12px] font-semibold text-white'
            : 'px-4 py-1.5 font-display text-[12px] text-merris-text-secondary'}
        >
          Agent Builder
        </button>
      </div>

      {tab === 'builder' && <BuilderTab openTemplate={openTemplate} />}

      {tab === 'library' && (
        <>
          {/* Run feedback banner */}
          {runFeedback && (
            <MerrisCard
              className={`mb-4 border-l-[3px] font-body text-[12px] ${
                runFeedback.status === 'completed'
                  ? 'border-merris-success text-merris-success'
                  : runFeedback.status === 'failed'
                    ? 'border-merris-error text-merris-error'
                    : 'border-merris-primary text-merris-primary'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {runFeedback.status === 'running' && '▶ Running'}
                    {runFeedback.status === 'completed' && '✓ Completed'}
                    {runFeedback.status === 'failed' && '✗ Failed'}
                  </div>
                  <div className="text-merris-text-secondary">{runFeedback.message}</div>
                  {runFeedback.reactExecution && (
                    <div className="mt-0.5 font-mono text-[9px] text-merris-text-tertiary">
                      execution: {runFeedback.reactExecution.id}
                    </div>
                  )}
                </div>
                {runFeedback.status === 'completed' && (
                  <MerrisButton
                    variant="primary"
                    className="!text-[11px] !px-3 !py-1.5"
                    onClick={() => setShowResults(true)}
                  >
                    View Results →
                  </MerrisButton>
                )}
              </div>
            </MerrisCard>
          )}

          {/* Category filters */}
          <div className="mb-5 flex flex-wrap gap-1.5">
            {AGENT_CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </div>

          {/* Agent cards */}
          {loading ? (
            <div className="mb-7 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <MerrisCard key={i} className="animate-pulse">
                  <div className="mb-3 h-9 w-9 rounded-merris-sm bg-merris-surface-low" />
                  <div className="mb-2 h-4 w-3/4 rounded bg-merris-surface-low" />
                  <div className="h-3 w-full rounded bg-merris-surface-low" />
                </MerrisCard>
              ))}
            </div>
          ) : (
            <div className="mb-7 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((a) => (
                <MerrisCard key={a.realTemplateId ?? a.name} hover>
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-merris-sm bg-merris-primary-bg text-[18px]">
                      {a.iconLabel}
                    </div>
                    {a.realTemplateId ? (
                      <Pill size="sm">Live</Pill>
                    ) : a.by ? (
                      <Pill variant="draft" size="sm">Custom</Pill>
                    ) : (
                      <Pill size="sm">Pre-built</Pill>
                    )}
                  </div>
                  <div className="mb-1 font-display text-[14px] font-semibold text-merris-text">{a.name}</div>
                  <div className="mb-3 font-body text-[11px] leading-relaxed text-merris-text-secondary">{a.description}</div>
                  <div className="flex items-center justify-between border-t border-merris-border pt-3">
                    <div className="font-body text-[10px] text-merris-text-tertiary">
                      {a.by ? `by ${a.by}` : a.category}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {a.realTemplateId && (
                        <button
                          type="button"
                          onClick={() => handleOpenInBuilder(a)}
                          className="rounded-lg border border-merris-border px-3 py-1.5 font-body text-[11px] text-merris-text-secondary transition-colors hover:border-merris-primary hover:text-merris-primary"
                        >
                          Open
                        </button>
                      )}
                      <MerrisButton
                        variant="primary"
                        className="!text-[11px] !px-3 !py-1.5"
                        onClick={() => handleRun(a)}
                      >
                        ▶ Run
                      </MerrisButton>
                    </div>
                  </div>
                </MerrisCard>
              ))}

              {/* Build custom */}
              <button
                type="button"
                onClick={() => setTab('builder')}
                className="flex flex-col items-center justify-center rounded-merris border-2 border-dashed border-merris-border-medium bg-transparent p-6 transition-colors hover:bg-merris-surface-low"
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-merris-surface-low text-[18px] text-merris-text-tertiary">+</div>
                <div className="font-display text-[13px] font-semibold text-merris-text">Build Custom Agent</div>
                <div className="mt-1 font-body text-[10px] text-merris-text-tertiary">Create from natural language</div>
              </button>
            </div>
          )}

          {/* Recently Run */}
          <SectionLabel>Recently Run</SectionLabel>
          {executions.length === 0 ? (
            <MerrisCard className="text-center font-body text-[12px] text-merris-text-tertiary" style={{ padding: '24px' }}>
              No workflow runs yet. Run an agent above to see history here.
            </MerrisCard>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {executions.slice(0, 6).map((e) => (
                <MerrisCard
                  key={e.id}
                  style={{ padding: '16px' }}
                  className="cursor-pointer hover:border-merris-primary"
                  onClick={() => {
                    setRunFeedback({
                      templateId: e.templateId,
                      agentName: e.templateId,
                      status: e.status as 'completed' | 'failed' | 'running',
                      message: `${e.currentStep}/${e.totalSteps} steps`,
                    });
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-[12px] font-semibold text-merris-text truncate pr-2">
                      {e.templateId}
                    </span>
                    <Pill
                      variant={e.status === 'completed' ? 'completed' : e.status === 'failed' ? 'critical' : 'in-progress'}
                      size="sm"
                    >
                      {e.status}
                    </Pill>
                  </div>
                  <div className="font-body text-[10px] text-merris-text-tertiary">
                    {e.startedAt ? new Date(e.startedAt).toLocaleString() : ''}
                    {' · '}{e.currentStep}/{e.totalSteps} steps
                  </div>
                </MerrisCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
