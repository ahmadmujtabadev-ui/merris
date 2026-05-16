'use client';

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import type { ToolCallData, NodeRunState } from '../flow-utils';

const TOOL_ICONS: Record<string, string> = {
  'web-search':   '🌐',
  'calculator':   '🧮',
  'extract-text': '📋',
  'compare':      '⇌',
  'translate':    '🌍',
  'validate':     '✓',
};

export function ToolCallNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as ToolCallData;
  return (
    <BaseNode
      type="tool-call"
      selected={selected}
      status={data.state as NodeRunState}
      icon="⚙️"
      label={data.label}
    >
      <p className="font-body text-[10px] text-gray-500">
        {TOOL_ICONS[data.tool] ?? '🔧'} {data.tool}
      </p>
    </BaseNode>
  );
}
