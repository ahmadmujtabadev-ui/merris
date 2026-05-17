'use client';

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './base-node';
import type { KBSearchData, NodeRunState } from '../flow-utils';

export function KBSearchNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as KBSearchData;
  const sources = data.sources ?? [];
  return (
    <BaseNode
      type="kb-search"
      selected={selected}
      status={data.state as NodeRunState}
      iconPath="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
      label={data.label}
    >
      <p className="font-body text-[10px]" style={{ color: '#9aa0a6' }}>
        {sources.length > 0 ? sources.slice(0, 3).join(', ') : 'all vaults'} · top {data.topK ?? 8} chunks
      </p>
    </BaseNode>
  );
}
