'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import { NODE_COLORS, STATUS_DOT, STATUS_RING, type ConditionData, type NodeRunState } from '../flow-utils';

export function ConditionNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as ConditionData;
  const color = NODE_COLORS.condition;
  const status = (data.state ?? 'idle') as NodeRunState;

  return (
    <div
      className={clsx(
        'relative min-w-[190px] rounded-xl border border-gray-200 bg-white shadow-sm transition-all',
        selected && 'border-transparent shadow-md ring-2 ring-pink-500',
        !selected && status !== 'idle' && STATUS_RING[status],
      )}
    >
      <div className="h-[3px] rounded-t-xl" style={{ background: color }} />

      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <span className="text-[15px] leading-none">⬡</span>
        <span className="flex-1 font-display text-[12px] font-semibold text-gray-800 truncate">{data.label}</span>
        <span className={clsx('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[status])} />
      </div>

      <div className="border-t border-gray-100 px-3 py-2">
        <p className="font-mono text-[10px] text-gray-600 bg-gray-50 rounded px-1.5 py-1">{data.condition}</p>
        <div className="mt-1.5 flex justify-between text-[9px] font-semibold">
          <span className="text-green-600">✓ {data.trueLabel}</span>
          <span className="text-red-500">✗ {data.falseLabel}</span>
        </div>
      </div>

      <div className="px-3 pb-2 pt-0.5">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-wider" style={{ color }}>condition</span>
      </div>

      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-gray-400 !rounded-full" />
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '35%', background: '#16a34a' }}
        className="!h-3 !w-3 !border-2 !border-white !rounded-full"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ background: '#dc2626' }}
        className="!h-3 !w-3 !border-2 !border-white !rounded-full"
      />
    </div>
  );
}
