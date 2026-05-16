'use client';

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import type { TriggerData, NodeRunState } from '../flow-utils';

const TRIGGER_LABELS: Record<string, string> = {
  manual:     'Manual trigger',
  schedule:   'Scheduled',
  document:   'On document upload',
  'kb-query': 'On KB query',
};

export function TriggerNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as TriggerData;
  return (
    <BaseNode
      type="trigger"
      selected={selected}
      status={data.state as NodeRunState}
      icon="🎯"
      label={data.label}
      hasInputHandle={false}
    >
      <p className="font-body text-[10px] text-gray-500">
        {TRIGGER_LABELS[data.triggerType] ?? data.triggerType}
      </p>
    </BaseNode>
  );
}
