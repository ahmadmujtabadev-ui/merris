'use client';

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import type { TriggerData, NodeRunState } from '../flow-utils';

const TRIGGER_LABELS: Record<string, string> = {
  manual:     'Manual trigger',
  schedule:   'Scheduled run',
  document:   'Document upload',
  'kb-query': 'KB query trigger',
};

export function TriggerNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as TriggerData;
  return (
    <BaseNode
      type="trigger"
      selected={selected}
      status={data.state as NodeRunState}
      iconPath="M13 2L3 14h9l-1 10 10-12h-9l1-10z"
      label={data.label}
      hasInputHandle={false}
    >
      <p className="font-body text-[10px] leading-relaxed" style={{ color: '#9aa0a6' }}>
        {TRIGGER_LABELS[data.triggerType] ?? data.triggerType}
      </p>
    </BaseNode>
  );
}
