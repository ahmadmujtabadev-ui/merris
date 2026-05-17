'use client';

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import type { ToolCallData, NodeRunState } from '../flow-utils';

export function ToolCallNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as ToolCallData;
  return (
    <BaseNode
      type="tool-call"
      selected={selected}
      status={data.state as NodeRunState}
      iconPath="M12 15a3 3 0 100-6 3 3 0 000 6zM12 1v2M12 21v2M3.5 12h2M18.5 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"
      label={data.label}
    >
      <p className="font-body text-[10px]" style={{ color: '#9aa0a6' }}>
        Call: {data.tool.replace(/-/g, ' ')}
      </p>
    </BaseNode>
  );
}
