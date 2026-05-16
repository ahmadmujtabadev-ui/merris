'use client';

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import type { KBSearchData, NodeRunState } from '../flow-utils';

export function KBSearchNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as KBSearchData;
  return (
    <BaseNode
      type="kb-search"
      selected={selected}
      status={data.state as NodeRunState}
      icon="🔍"
      label={data.label}
    >
      <div className="flex flex-wrap gap-1 mb-1">
        {data.sources.map((src) => (
          <span
            key={src}
            className="rounded-full bg-blue-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-blue-700"
          >
            {src}
          </span>
        ))}
      </div>
      <p className="font-body text-[10px] text-gray-400">top {data.topK} chunks</p>
    </BaseNode>
  );
}
