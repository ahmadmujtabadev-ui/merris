'use client';

import { Handle, Position } from '@xyflow/react';
import { NODE_COLORS, type FlowNodeType, type NodeRunState } from '../flow-utils';

const STATUS_COLORS: Record<NodeRunState, string> = {
  idle:    '#d1d5db',
  running: '#d97706',
  done:    '#16a34a',
  error:   '#dc2626',
};

const STATUS_LABELS: Record<NodeRunState, string> = {
  idle:    'IDLE',
  running: 'RUNNING',
  done:    'DONE',
  error:   'ERROR',
};

export const TYPE_LABELS: Record<FlowNodeType, string> = {
  trigger:      'TRIGGER',
  'kb-search':  'KB-SEARCH',
  'llm-reason': 'LLM-REASON',
  'tool-call':  'TOOL-CALL',
  condition:    'CONDITION',
  transform:    'TRANSFORM',
  output:       'OUTPUT',
};

interface BaseNodeProps {
  type: FlowNodeType;
  selected?: boolean;
  status?: NodeRunState;
  iconPath: string;
  label: string;
  hasInputHandle?: boolean;
  hasOutputHandle?: boolean;
  children?: React.ReactNode;
}

export function BaseNode({
  type, selected, status = 'idle',
  iconPath, label,
  hasInputHandle = true, hasOutputHandle = true,
  children,
}: BaseNodeProps) {
  const color = NODE_COLORS[type];
  const statusColor = STATUS_COLORS[status];
  const isRunning = status === 'running';

  // Support multi-path icons separated by "|"
  const paths = iconPath.split('|');

  return (
    <div
      style={{
        borderTop:    `1.5px solid ${selected ? color : isRunning ? '#d97706' : '#e8eae8'}`,
        borderRight:  `1.5px solid ${selected ? color : isRunning ? '#d97706' : '#e8eae8'}`,
        borderBottom: `1.5px solid ${selected ? color : isRunning ? '#d97706' : '#e8eae8'}`,
        borderLeft:   `4px solid ${color}`,
        boxShadow: selected
          ? `0 0 0 3px ${color}20, 0 2px 12px ${color}15`
          : isRunning
            ? '0 0 0 2px #d9770620, 0 1px 4px rgba(0,0,0,0.06)'
            : '0 1px 4px rgba(0,0,0,0.06)',
        minWidth: 210,
        borderRadius: 12,
        background: '#fff',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
    >
      {/* Header: icon + label */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: color + '18' }}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke={color} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            {paths.map((p, i) => <path key={i} d={p} />)}
          </svg>
        </div>
        <div className="min-w-0">
          <div className="font-display text-[12.5px] font-bold leading-tight text-gray-800 truncate">
            {label}
          </div>
        </div>
      </div>

      {/* Content slot */}
      {children && (
        <div className="border-t px-4 py-2.5" style={{ borderColor: '#f3f4f5' }}>
          {children}
        </div>
      )}

      {/* Footer: status (left) + type badge (right) */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderTop: '1px solid #f3f4f5' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
          <span
            className="font-mono text-[9px] font-semibold uppercase tracking-wide"
            style={{ color: statusColor }}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>
        <span
          className="font-mono text-[8px] font-bold uppercase tracking-widest"
          style={{ color }}
        >
          {TYPE_LABELS[type]}
        </span>
      </div>

      {hasInputHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-gray-300"
        />
      )}
      {hasOutputHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !rounded-full !border-2 !border-white"
          style={{ background: color }}
        />
      )}
    </div>
  );
}
