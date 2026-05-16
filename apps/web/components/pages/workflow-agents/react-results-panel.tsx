'use client';

import type { ReActExecution, ReActStep } from '@/lib/api';
import { MerrisButton } from '@/components/merris/button';
import { Pill } from '@/components/merris/pill';

const STEP_ICONS: Record<ReActStep['type'], string> = {
  thought: '💭',
  action: '⚙️',
  observation: '👁️',
  final: '✅',
};

const STEP_LABELS: Record<ReActStep['type'], string> = {
  thought: 'Reasoning',
  action: 'Tool Call',
  observation: 'Observation',
  final: 'Final Answer',
};

const STEP_COLORS: Record<ReActStep['type'], string> = {
  thought: 'border-purple-200 bg-purple-50',
  action: 'border-amber-200 bg-amber-50',
  observation: 'border-blue-200 bg-blue-50',
  final: 'border-green-200 bg-green-50',
};

const STEP_TEXT_COLORS: Record<ReActStep['type'], string> = {
  thought: 'text-purple-700',
  action: 'text-amber-700',
  observation: 'text-blue-700',
  final: 'text-green-700',
};

const TOOL_ICONS: Record<string, string> = {
  search_knowledge: '🔍',
  verify_compliance: '✓',
  detect_frameworks: '🗺️',
  benchmark: '📊',
  calculate: '🔢',
  generate_text: '✍️',
};

function StepCard({ step, index }: { step: ReActStep; index: number }) {
  const borderBg = STEP_COLORS[step.type];
  const textColor = STEP_TEXT_COLORS[step.type];
  const icon = STEP_ICONS[step.type];
  const label = STEP_LABELS[step.type];

  return (
    <div className={`rounded-xl border ${borderBg} p-4`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[14px]">{step.tool ? (TOOL_ICONS[step.tool] ?? icon) : icon}</span>
        <span className={`font-display text-[11px] font-bold uppercase tracking-wide ${textColor}`}>
          {label}
          {step.tool ? ` · ${step.tool.replace(/_/g, ' ')}` : ''}
        </span>
        <span className="ml-auto font-mono text-[9px] text-gray-400">step {index + 1}</span>
      </div>

      {step.type === 'action' && step.toolInput && (
        <div className="mb-2 rounded-lg bg-white/70 p-2">
          <pre className="overflow-x-auto font-mono text-[9px] leading-relaxed text-amber-800">
            {JSON.stringify(step.toolInput, null, 2).slice(0, 400)}
          </pre>
        </div>
      )}

      <div
        className={`font-body text-[11px] leading-relaxed ${
          step.type === 'final' ? 'text-green-800' : 'text-gray-700'
        }`}
      >
        {step.type === 'observation' || step.type === 'action' ? (
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-gray-600">
            {step.content.slice(0, 800)}
            {step.content.length > 800 ? '\n…[truncated]' : ''}
          </pre>
        ) : (
          <p className="whitespace-pre-wrap">{step.content}</p>
        )}
      </div>
    </div>
  );
}

interface ReActResultsPanelProps {
  execution: ReActExecution;
  onClose: () => void;
}

export function ReActResultsPanel({ execution, onClose }: ReActResultsPanelProps) {
  const handleExport = () => {
    const lines: string[] = [
      `# ${execution.goal.split('\n')[0]}`,
      `**Execution ID:** ${execution.id}`,
      `**Status:** ${execution.status}`,
      `**Iterations:** ${execution.iterations}`,
      `**Started:** ${execution.startedAt}`,
      `**Completed:** ${execution.completedAt ?? '—'}`,
      '',
      '## Step-by-step ReAct trace',
      '',
    ];

    for (const [i, step] of execution.steps.entries()) {
      lines.push(`### Step ${i + 1}: ${STEP_LABELS[step.type]}${step.tool ? ` (${step.tool})` : ''}`);
      if (step.toolInput) {
        lines.push('```json');
        lines.push(JSON.stringify(step.toolInput, null, 2));
        lines.push('```');
      }
      lines.push(step.content);
      lines.push('');
    }

    if (execution.finalAnswer) {
      lines.push('## Final Answer', '', execution.finalAnswer);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `react-${execution.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const goalTitle = execution.goal.split('\n')[0] ?? execution.templateId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-[15px] font-bold text-gray-900 truncate">{goalTitle}</span>
              <Pill
                variant={execution.status === 'completed' ? 'completed' : execution.status === 'failed' ? 'critical' : 'in-progress'}
                size="sm"
              >
                {execution.status}
              </Pill>
            </div>
            <div className="mt-1 flex items-center gap-3 font-body text-[10px] text-gray-400">
              <span>ReAct Agent · {execution.iterations} iteration{execution.iterations !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{execution.steps.length} steps</span>
              <span>·</span>
              <span className="font-mono">{execution.id}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Step legend */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-6 py-2">
          {(['thought', 'action', 'observation', 'final'] as const).map((t) => (
            <div key={t} className="flex items-center gap-1">
              <span className="text-[11px]">{STEP_ICONS[t]}</span>
              <span className={`font-body text-[9px] font-semibold uppercase ${STEP_TEXT_COLORS[t]}`}>
                {STEP_LABELS[t]}
              </span>
            </div>
          ))}
        </div>

        {/* Steps scroll area */}
        <div className="flex-1 overflow-y-auto p-6">
          {execution.steps.length === 0 ? (
            <div className="py-12 text-center font-body text-[12px] text-gray-400">
              {execution.status === 'running' ? 'Agent is running…' : 'No steps recorded.'}
            </div>
          ) : (
            <div className="space-y-3">
              {execution.steps.map((step, i) => (
                <StepCard key={i} step={step} index={i} />
              ))}
            </div>
          )}

          {/* Error */}
          {execution.status === 'failed' && execution.error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-display text-[11px] font-bold uppercase text-red-600">Error</p>
              <p className="mt-1 font-mono text-[11px] text-red-700">{execution.error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
          <div className="font-body text-[10px] text-gray-400">
            {execution.completedAt
              ? `Completed in ${Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)}s`
              : 'Running…'}
          </div>
          <div className="flex gap-2">
            <MerrisButton variant="secondary" onClick={onClose}>Close</MerrisButton>
            <MerrisButton variant="primary" onClick={handleExport}>
              ⬇ Export Trace
            </MerrisButton>
          </div>
        </div>
      </div>
    </div>
  );
}
