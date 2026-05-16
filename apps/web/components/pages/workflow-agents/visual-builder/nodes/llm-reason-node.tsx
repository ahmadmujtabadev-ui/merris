'use client';

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import type { LLMReasonData, NodeRunState } from '../flow-utils';

export function LLMReasonNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as LLMReasonData;
  return (
    <BaseNode
      type="llm-reason"
      selected={selected}
      status={data.state as NodeRunState}
      icon="🧠"
      label={data.label}
    >
      <p className="font-body text-[10px] text-gray-500 leading-relaxed">
        {data.prompt.length > 60 ? data.prompt.slice(0, 60) + '…' : data.prompt}
      </p>
      <p className="mt-1 font-mono text-[9px] text-purple-600">Claude Sonnet 4</p>
    </BaseNode>
  );
}
