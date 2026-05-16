'use client';

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import type { TransformData, NodeRunState } from '../flow-utils';

const OP_LABELS: Record<string, string> = {
  extract:   'Extract key fields',
  summarize: 'Summarize content',
  format:    'Format to template',
  merge:     'Merge multiple inputs',
  filter:    'Filter by criteria',
};

export function TransformNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as TransformData;
  return (
    <BaseNode
      type="transform"
      selected={selected}
      status={data.state as NodeRunState}
      icon="🔄"
      label={data.label}
    >
      <p className="font-body text-[10px] text-gray-500">
        {OP_LABELS[data.operation] ?? data.operation}
      </p>
    </BaseNode>
  );
}
