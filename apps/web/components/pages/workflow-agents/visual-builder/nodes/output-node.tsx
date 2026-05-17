'use client';

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import type { OutputData, NodeRunState } from '../flow-utils';

const FORMAT_LABELS: Record<string, string> = {
  report: 'Word + Excel exhibit',
  json:   'JSON structured export',
  pdf:    'PDF document',
  email:  'Email digest',
};

export function OutputNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as OutputData;
  return (
    <BaseNode
      type="output"
      selected={selected}
      status={data.state as NodeRunState}
      iconPath="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z|M14 2v6h6"
      label={data.label}
      hasOutputHandle={false}
    >
      <p className="font-body text-[10px]" style={{ color: '#9aa0a6' }}>
        {FORMAT_LABELS[data.format] ?? data.format}
      </p>
    </BaseNode>
  );
}
