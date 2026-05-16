'use client';

import { NODE_PALETTE_ITEMS, NODE_COLORS, type FlowNodeType } from './flow-utils';

interface NodePaletteProps {
  onAddNode: (type: FlowNodeType) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  function handleDragStart(e: React.DragEvent, type: FlowNodeType) {
    e.dataTransfer.setData('application/merris-node-type', type);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white w-[200px] shrink-0">
      {/* Header */}
      <div className="border-b border-gray-100 px-3 py-3">
        <p className="font-body text-[9px] font-semibold uppercase tracking-wider text-gray-400">
          Node Types
        </p>
        <p className="font-body text-[10px] text-gray-400 mt-0.5">Drag to canvas or click +</p>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {NODE_PALETTE_ITEMS.map(({ type, label, icon, description }) => {
          const color = NODE_COLORS[type];
          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => handleDragStart(e, type)}
              className="group relative cursor-grab rounded-lg border border-gray-200 bg-white p-2.5 transition-all hover:border-gray-300 hover:shadow-sm active:cursor-grabbing"
            >
              {/* Left color stripe */}
              <div
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                style={{ background: color }}
              />
              <div className="pl-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px]">{icon}</span>
                    <span className="font-display text-[11px] font-semibold text-gray-700">{label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddNode(type)}
                    className="h-4 w-4 rounded bg-gray-100 text-[11px] text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-200 flex items-center justify-center"
                    title={`Add ${label}`}
                  >
                    +
                  </button>
                </div>
                <p className="mt-0.5 font-body text-[9px] leading-tight text-gray-400">{description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="border-t border-gray-100 px-3 py-2.5">
        <p className="font-body text-[9px] text-gray-300 text-center">
          Connect nodes by dragging handle → handle
        </p>
      </div>
    </div>
  );
}
