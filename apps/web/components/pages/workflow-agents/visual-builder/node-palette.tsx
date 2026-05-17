'use client';

import { useState } from 'react';
import { NODE_COLORS, type FlowNodeType } from './flow-utils';

interface PaletteItem {
  type: FlowNodeType;
  label: string;
  description: string;
  iconPath: string;
  defaultLabel?: string;
}

const PALETTE_GROUPS: Array<{ group: string; items: PaletteItem[] }> = [
  {
    group: 'INPUT',
    items: [
      { type: 'trigger',    label: 'Trigger',        description: 'Start the workflow',       iconPath: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z' },
      { type: 'trigger',    label: 'Document Input', description: 'Upload or pick a file',    iconPath: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z|M14 2v6h6', defaultLabel: 'Document Input' },
    ],
  },
  {
    group: 'EXTRACTION',
    items: [
      { type: 'transform',  label: 'Extract Data',   description: 'Pull fields from text',    iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', defaultLabel: 'Extract Data' },
      { type: 'transform',  label: 'Transform',      description: 'Reshape or merge data',    iconPath: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4' },
    ],
  },
  {
    group: 'KNOWLEDGE',
    items: [
      { type: 'kb-search',  label: 'KB Search',      description: 'Search vaults K1–K7',     iconPath: 'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z' },
      { type: 'kb-search',  label: 'Benchmark',      description: 'Peer comparison',          iconPath: 'M22 12h-4l-3 9L9 3l-3 9H2', defaultLabel: 'Benchmark' },
    ],
  },
  {
    group: 'ANALYSIS',
    items: [
      { type: 'llm-reason', label: 'LLM Reasoning',  description: 'Claude synthesis',         iconPath: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
      { type: 'llm-reason', label: 'Detect Gap',     description: 'Find missing disclos…',   iconPath: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01', defaultLabel: 'Detect Gap' },
      { type: 'transform',  label: 'Map to Clause',  description: 'Bind to standard',        iconPath: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m6 13l-5.447 2.724A1 1 0 0115 19.382V8.618a1 1 0 011.447-.894L21 5v11M15 7l-6 3', defaultLabel: 'Map to Clause' },
    ],
  },
  {
    group: 'LOGIC',
    items: [
      { type: 'condition',  label: 'Condition',      description: 'Branch on a threshold or rule', iconPath: 'M12 2L22 12 12 22 2 12z' },
      { type: 'transform',  label: 'Loop',           description: 'Iterate over items',       iconPath: 'M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15', defaultLabel: 'Loop' },
    ],
  },
  {
    group: 'OUTPUT',
    items: [
      { type: 'llm-reason', label: 'Generate Section', description: 'Write a section',        iconPath: 'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z', defaultLabel: 'Generate Section' },
      { type: 'output',     label: 'Export',           description: 'Word / Excel / PPT',     iconPath: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3', defaultLabel: 'Export' },
      { type: 'tool-call',  label: 'Human-in-Loop',   description: 'Pause for review',       iconPath: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', defaultLabel: 'Human-in-Loop' },
    ],
  },
  {
    group: 'TOOLS',
    items: [
      { type: 'tool-call',  label: 'Tool Call',       description: 'API or external tool',   iconPath: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z', defaultLabel: 'Tool Call' },
      { type: 'tool-call',  label: 'Calculate',       description: 'Math & aggregation',     iconPath: 'M4 7h16M4 12h16M4 17h7M15 14l2 2 4-4', defaultLabel: 'Calculate' },
      { type: 'condition',  label: 'Verify Compliance', description: 'Schema check',         iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', defaultLabel: 'Verify Compliance' },
    ],
  },
];

interface NodePaletteProps {
  onAddNode: (type: FlowNodeType, label?: string) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const [filter, setFilter] = useState('');

  function handleDragStart(e: React.DragEvent, item: PaletteItem) {
    e.dataTransfer.setData('application/merris-node-type', item.type);
    e.dataTransfer.setData('application/merris-node-label', item.defaultLabel ?? item.label);
    e.dataTransfer.effectAllowed = 'move';
  }

  const q = filter.toLowerCase();
  const filtered = PALETTE_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (i) => !q || i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full w-[240px] shrink-0 flex-col border-r bg-white" style={{ borderColor: '#e8eae8' }}>
      {/* Header */}
      <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #f0f0ed' }}>
        <p className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
          Node Types
        </p>
        <p className="font-body text-[10px]" style={{ color: '#c4cac4' }}>
          Drag to canvas or click +
        </p>
      </div>

      {/* Filter */}
      <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #f0f0ed' }}>
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: '#f5f5f0', border: '1px solid #ebebea' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter nodes…"
            className="flex-1 bg-transparent font-body text-[11px] text-gray-700 outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Grouped items */}
      <div className="flex-1 overflow-y-auto py-2">
        {filtered.map(({ group, items }) => (
          <div key={group}>
            {/* Group label + count */}
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="font-mono text-[8px] font-bold uppercase tracking-widest" style={{ color: '#c4cac4' }}>
                {group}
              </span>
              <span className="font-mono text-[8px] font-bold" style={{ color: '#c4cac4' }}>
                {items.length}
              </span>
            </div>

            {/* Items */}
            {items.map((item) => {
              const color = NODE_COLORS[item.type];
              const paths = item.iconPath.split('|');
              return (
                <div
                  key={item.label}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  className="group mx-2 mb-1 flex cursor-grab items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50 active:cursor-grabbing"
                  style={{ border: '1px solid transparent' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#e8eae8'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                >
                  {/* Colored icon square */}
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{ background: color + '18' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {paths.map((p, i) => <path key={i} d={p} />)}
                    </svg>
                  </div>

                  {/* Label + description */}
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[11.5px] font-semibold text-gray-700 truncate">{item.label}</div>
                    <div className="font-body text-[9px] truncate" style={{ color: '#9aa0a6' }}>{item.description}</div>
                  </div>

                  {/* Add button */}
                  <button
                    type="button"
                    onClick={() => onAddNode(item.type, item.defaultLabel ?? item.label)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[12px] font-bold opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ background: color + '20', color }}
                    title={`Add ${item.label}`}
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 text-center" style={{ borderTop: '1px solid #f0f0ed' }}>
        <p className="font-body text-[9px]" style={{ color: '#d1d5db' }}>
          Connect nodes by dragging handle → handle
        </p>
      </div>
    </div>
  );
}
