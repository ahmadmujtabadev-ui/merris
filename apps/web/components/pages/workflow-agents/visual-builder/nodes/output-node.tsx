'use client';

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import type { OutputData, NodeRunState } from '../flow-utils';

const FORMAT_ICONS: Record<string, string> = {
  report: '📊 Structured Report',
  json:   '{ } JSON Export',
  pdf:    '📑 PDF Document',
  email:  '📧 Email Digest',
};

export function OutputNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as OutputData;
  return (
    <BaseNode
      type="output"
      selected={selected}
      status={data.state as NodeRunState}
      icon="📄"
      label={data.label}
      hasOutputHandle={false}
    >
      <p className="font-body text-[10px] text-gray-500">
        {FORMAT_ICONS[data.format] ?? data.format}
      </p>
    </BaseNode>
  );
}
