'use client';

import { Handle, Position } from '@xyflow/react';
import clsx from 'clsx';
import { NODE_COLORS, STATUS_DOT, STATUS_RING, type FlowNodeType, type NodeRunState } from '../flow-utils';

interface BaseNodeProps {
  type: FlowNodeType;
  selected?: boolean;
  status?: NodeRunState;
  icon: string;
  label: string;
  hasInputHandle?: boolean;
  hasOutputHandle?: boolean;
  children?: React.ReactNode;
}

export function BaseNode({
  type,
  selected,
  status = 'idle',
  icon,
  label,
  hasInputHandle = true,
  hasOutputHandle = true,
  children,
}: BaseNodeProps) {
  const color = NODE_COLORS[type];

  return (
    <div
      className={clsx(
        'relative min-w-[190px] rounded-xl border border-gray-200 bg-white shadow-sm transition-all',
        selected && 'border-transparent shadow-md',
        selected && STATUS_RING[status] || (selected ? 'ring-2 ring-blue-500' : ''),
        !selected && status !== 'idle' && STATUS_RING[status],
      )}
    >
      {/* Colored type stripe */}
      <div className="h-[3px] rounded-t-xl" style={{ background: color }} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <span className="text-[15px] leading-none">{icon}</span>
        <span className="flex-1 font-display text-[12px] font-semibold text-gray-800 truncate">
          {label}
        </span>
        {/* Status dot */}
        <span
          className={clsx('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[status])}
          title={status}
        />
      </div>

      {/* Content slot */}
      {children && (
        <div className="border-t border-gray-100 px-3 py-2">
          {children}
        </div>
      )}

      {/* Type label */}
      <div className="px-3 pb-2 pt-0.5">
        <span
          className="font-mono text-[9px] font-semibold uppercase tracking-wider"
          style={{ color }}
        >
          {type}
        </span>
      </div>

      {hasInputHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-white !bg-gray-400 !rounded-full"
        />
      )}
      {hasOutputHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-white !rounded-full"
          style={{ background: color }}
        />
      )}
    </div>
  );
}
