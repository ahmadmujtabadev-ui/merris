'use client';

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import type { LLMReasonData, NodeRunState } from '../flow-utils';

const MODEL_LABELS: Record<string, string> = {
  'claude-sonnet-4-6': 'Claude Sonnet 4',
  'claude-opus-4-7':   'Claude Opus 4',
  'claude-haiku-4-5':  'Claude Haiku 4',
};

export function LLMReasonNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as LLMReasonData;
  const modelLabel = MODEL_LABELS[data.model ?? 'claude-sonnet-4-6'] ?? data.model ?? 'Claude Sonnet 4';
  const promptPreview = (data.prompt ?? '').slice(0, 50);
  return (
    <BaseNode
      type="llm-reason"
      selected={selected}
      status={data.state as NodeRunState}
      iconPath="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      label={data.label}
    >
      {promptPreview && (
        <p className="mb-1 font-body text-[10px] leading-relaxed" style={{ color: '#9aa0a6' }}>
          {promptPreview}{data.prompt?.length > 50 ? '…' : ''}
        </p>
      )}
      <p className="font-mono text-[9px] font-semibold" style={{ color: '#7c3aed' }}>
        {modelLabel} · structured output
      </p>
    </BaseNode>
  );
}
