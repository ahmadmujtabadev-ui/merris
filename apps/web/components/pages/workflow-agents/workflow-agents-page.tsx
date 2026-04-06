'use client';

import { useState, useEffect, useRef } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { Pill } from '@/components/merris/pill';
import { Chip } from '@/components/merris/chip';
import { SectionLabel } from '@/components/merris/label';
import { api, type WorkflowTemplate } from '@/lib/api';
import { useEngagementStore } from '@/lib/store';
import { AGENTS_PREBUILT, AGENTS_CUSTOM, RECENTLY_RUN, AGENT_CATEGORIES, type AgentEntry } from './workflow-agents-data';

type ViewAgent = AgentEntry & { realTemplateId?: string };

interface RunFeedback {
  templateId: string;
  status: 'running' | 'completed' | 'failed';
  message?: string;
  executionId?: string;
}

function templatesToViewAgents(templates: WorkflowTemplate[]): ViewAgent[] {
  return templates.map((t) => ({
    name: t.name,
    description: t.description,
    category: t.category,
    runs: undefined,
    rating: undefined,
    iconLabel: '⚡',
    realTemplateId: t.id,
  }));
}

export function WorkflowAgentsPage() {
  const [category, setCategory] = useState<(typeof AGENT_CATEGORIES)[number]>('All');
  const [agents, setAgents] = useState<ViewAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [runFeedback, setRunFeedback] = useState<RunFeedback | null>(null);
  const currentEngagement = useEngagementStore((s) => s.currentEngagement);
  const pollIntervalRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHydrationError(null);
    api
      .listWorkflowTemplates()
      .then((res) => {
        if (cancelled) return;
        if (res.templates && res.templates.length > 0) {
          // Real backend templates take precedence; append the hardcoded custom
          // agents at the end so the page still shows the "by X" cards.
          setAgents([...templatesToViewAgents(res.templates), ...AGENTS_CUSTOM]);
        } else {
          // Empty response — show the prototype set so the page isn't blank
          setAgents([...AGENTS_PREBUILT, ...AGENTS_CUSTOM]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // Backend unreachable / 404 / etc. — fall back to hardcoded set
        setAgents([...AGENTS_PREBUILT, ...AGENTS_CUSTOM]);
        setHydrationError(err instanceof Error ? err.message : 'Unable to fetch live workflow templates');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = agents.filter((a) => category === 'All' || a.category === category);

  const handleRun = async (agent: ViewAgent) => {
    stopPolling(); // cancel any previous run

    if (!agent.realTemplateId) {
      setRunFeedback({
        templateId: agent.name,
        status: 'failed',
        message: 'This is a hardcoded prototype agent — not yet wired to a real workflow template.',
      });
      return;
    }
    if (!currentEngagement) {
      setRunFeedback({
        templateId: agent.realTemplateId,
        status: 'failed',
        message: 'Select an engagement from the top bar before running a workflow.',
      });
      return;
    }

    setRunFeedback({ templateId: agent.realTemplateId, status: 'running', message: `Starting ${agent.name}…` });

    try {
      const execution = await api.runWorkflowTemplate(agent.realTemplateId, currentEngagement.id, {});

      if (execution.status === 'failed') {
        setRunFeedback({
          templateId: agent.realTemplateId,
          status: 'failed',
          message: execution.error ?? 'Workflow execution failed',
          executionId: execution.id,
        });
        return;
      }

      if (execution.status === 'completed') {
        setRunFeedback({
          templateId: agent.realTemplateId,
          status: 'completed',
          message: `${agent.name} completed (${execution.currentStep}/${execution.totalSteps} steps)`,
          executionId: execution.id,
        });
        return;
      }

      // Still running — start polling
      setRunFeedback({
        templateId: agent.realTemplateId,
        status: 'running',
        message: `${agent.name} step ${execution.currentStep}/${execution.totalSteps}…`,
        executionId: execution.id,
      });

      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const latest = await api.getWorkflowExecutionStatus(execution.id);
          if (latest.status === 'running') {
            setRunFeedback({
              templateId: agent.realTemplateId!,
              status: 'running',
              message: `${agent.name} step ${latest.currentStep}/${latest.totalSteps}…`,
              executionId: execution.id,
            });
          } else {
            stopPolling();
            setRunFeedback({
              templateId: agent.realTemplateId!,
              status: latest.status,
              message:
                latest.status === 'failed'
                  ? latest.error ?? 'Workflow execution failed'
                  : `${agent.name} completed (${latest.currentStep}/${latest.totalSteps} steps)`,
              executionId: execution.id,
            });
          }
        } catch (err) {
          stopPolling();
          setRunFeedback({
            templateId: agent.realTemplateId!,
            status: 'failed',
            message: err instanceof Error ? err.message : 'Failed to poll workflow status',
            executionId: execution.id,
          });
        }
      }, 1500);
    } catch (err) {
      setRunFeedback({
        templateId: agent.realTemplateId,
        status: 'failed',
        message: err instanceof Error ? err.message : 'Failed to start workflow',
      });
    }
  };

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

      {hydrationError && (
        <MerrisCard className="mb-4 border-l-[3px] border-merris-warning font-body text-[11px] text-merris-warning">
          ⚠ {hydrationError}. Showing hardcoded prototype agents instead.
        </MerrisCard>
      )}

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
          <div className="font-semibold">
            {runFeedback.status === 'running' && '▶ Running'}
            {runFeedback.status === 'completed' && '✓ Completed'}
            {runFeedback.status === 'failed' && '✗ Failed'}
          </div>
          <div className="text-merris-text-secondary">{runFeedback.message}</div>
          {runFeedback.executionId && (
            <div className="mt-1 font-mono text-[10px] text-merris-text-tertiary">execution: {runFeedback.executionId}</div>
          )}
        </MerrisCard>
      )}

      <div className="mb-5 flex flex-wrap gap-1.5">
        {AGENT_CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {loading ? (
        <MerrisCard className="text-center font-body text-[12px] text-merris-text-tertiary">
          Loading workflow templates…
        </MerrisCard>
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
                <div className="flex gap-2.5 font-body text-[10px] text-merris-text-tertiary">
                  {a.runs !== undefined && <span>{a.runs.toLocaleString()} runs</span>}
                  {a.rating !== undefined && <span>★ {a.rating}</span>}
                  {a.by && <span>by {a.by}</span>}
                  {a.shared !== undefined && <span>👥 {a.shared}</span>}
                </div>
                <MerrisButton
                  variant="primary"
                  className="!text-[11px] !px-3 !py-1.5"
                  onClick={() => handleRun(a)}
                >
                  ▶ Run
                </MerrisButton>
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
      )}

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
