'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_COLORS, type ConditionData, type NodeRunState } from '../flow-utils';
import { TYPE_LABELS } from './base-node';

const STATUS_COLORS: Record<NodeRunState, string> = {
  idle: '#d1d5db', running: '#d97706', done: '#16a34a', error: '#dc2626',
};
const STATUS_LABELS: Record<NodeRunState, string> = {
  idle: 'IDLE', running: 'RUNNING', done: 'DONE', error: 'ERROR',
};

export function ConditionNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as ConditionData;
  const color = NODE_COLORS.condition;
  const status = (data.state ?? 'idle') as NodeRunState;

  return (
    <div
      style={{
        borderTop:    `1.5px solid ${selected ? color : '#e8eae8'}`,
        borderRight:  `1.5px solid ${selected ? color : '#e8eae8'}`,
        borderBottom: `1.5px solid ${selected ? color : '#e8eae8'}`,
        borderLeft:   `4px solid ${color}`,
        boxShadow: selected ? `0 0 0 3px ${color}20` : '0 1px 4px rgba(0,0,0,0.06)',
        minWidth: 210,
        borderRadius: 12,
        background: '#fff',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: color + '18' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L22 12 12 22 2 12z"/>
          </svg>
        </div>
        <div className="font-display text-[12.5px] font-bold text-gray-800 truncate">{data.label}</div>
      </div>

      {/* Content */}
      <div className="border-t px-4 py-2.5" style={{ borderColor: '#f3f4f5' }}>
        <p className="mb-2 rounded-md px-2 py-1 font-mono text-[10px] text-gray-600" style={{ background: '#f5f5f0' }}>
          {data.condition || 'score &gt;= 0.7'}
        </p>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-bold" style={{ color: '#16a34a' }}>
            ✓ {data.trueLabel || 'Pass'}
          </span>
          <span className="font-mono text-[9px] font-bold" style={{ color: '#dc2626' }}>
            ✗ {data.falseLabel || 'Fail'}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid #f3f4f5' }}>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[status] }} />
          <span className="font-mono text-[9px] font-semibold uppercase tracking-wide" style={{ color: STATUS_COLORS[status] }}>
            {STATUS_LABELS[status]}
          </span>
        </div>
        <span className="font-mono text-[8px] font-bold uppercase tracking-widest" style={{ color }}>
          {TYPE_LABELS.condition}
        </span>
      </div>

      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-gray-300" />
      <Handle type="source" position={Position.Right} id="true" style={{ top: '35%', background: '#16a34a' }} className="!h-3 !w-3 !rounded-full !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} id="false" style={{ background: '#dc2626' }} className="!h-3 !w-3 !rounded-full !border-2 !border-white" />
    </div>
  );
}
