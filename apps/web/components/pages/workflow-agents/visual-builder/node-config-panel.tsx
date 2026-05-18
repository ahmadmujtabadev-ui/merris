'use client';

import type { Node } from '@xyflow/react';
import { NODE_COLORS, type FlowNodeType } from './flow-utils';
import { TYPE_LABELS } from './nodes/base-node';

const PRIMARY = '#0b5142';

const TYPE_ICON_PATHS: Record<FlowNodeType, string> = {
  trigger:      'M13 2L3 14h9l-1 10 10-12h-9l1-10z',
  'kb-search':  'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  'llm-reason': 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  'tool-call':  'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  condition:    'M12 2L22 12 12 22 2 12z',
  transform:    'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',
  output:       'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z|M14 2v6h6',
};

const TYPE_DISPLAY_NAMES: Record<FlowNodeType, string> = {
  trigger:      'Trigger',
  'kb-search':  'KB Search',
  'llm-reason': 'LLM Reasoning',
  'tool-call':  'Human-in-Loop',
  condition:    'Condition',
  transform:    'Transform',
  output:       'Output',
};

const KB_VAULTS: Array<{ id: string; name: string; count: string }> = [
  { id: 'K1', name: 'Disclosures',  count: '1,272' },
  { id: 'K2', name: 'Market',       count: '3,160' },
  { id: 'K3', name: 'Regulatory',   count: '2,708' },
  { id: 'K4', name: 'Finance',      count: '9,595' },
  { id: 'K5', name: 'Peers',        count: '594'   },
  { id: 'K6', name: 'Climate',      count: '2,024' },
  { id: 'K7', name: 'Research',     count: '3,019' },
];

const MODELS: Array<{ id: string; name: string; context: string }> = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4',  context: '200k' },
  { id: 'claude-opus-4-7',   name: 'Claude Opus 4',    context: '200k' },
  { id: 'claude-haiku-4-5',  name: 'Claude Haiku 4.5', context: '200k' },
];

const TRIGGER_TYPES  = ['manual', 'schedule', 'document', 'kb-query'] as const;
const TRANSFORM_OPS  = ['extract', 'summarize', 'format', 'merge', 'filter'] as const;
const TOOLS          = ['web-search', 'calculator', 'extract-text', 'compare', 'translate', 'validate'] as const;
const OUTPUT_FORMATS = ['Report', 'JSON', 'Word', 'Excel'] as const;
const OUTPUT_SCHEMA  = ['Structured', 'Markdown', 'JSON'] as const;

interface NodeConfigPanelProps {
  node: Node | null;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#c4cac4' }}>
      {children}
    </p>
  );
}

function ConfigInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 font-body text-[12px] text-gray-700 outline-none"
      style={{ background: '#f5f5f0', border: '1px solid #ebebea' }}
    />
  );
}

function TypeFields({
  type, data, set,
}: {
  type: FlowNodeType;
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
}) {
  const color = NODE_COLORS[type] ?? '#374151';

  switch (type) {
    case 'trigger':
      return (
        <div>
          <FieldLabel>Trigger Type</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {TRIGGER_TYPES.map((t) => {
              const active = (data.triggerType ?? 'manual') === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('triggerType', t)}
                  className="rounded-lg py-1.5 font-mono text-[9px] font-bold uppercase tracking-wide transition-colors"
                  style={{
                    background: active ? color + '15' : '#f5f5f0',
                    border:     `1px solid ${active ? color + '40' : '#ebebea'}`,
                    color:      active ? color : '#9aa0a6',
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      );

    case 'kb-search': {
      const sources = (data.sources as string[]) ?? [];
      return (
        <>
          <div>
            <FieldLabel>Vault Scope</FieldLabel>
            <div className="space-y-1">
              {KB_VAULTS.map(({ id, name, count }) => {
                const checked = sources.includes(id);
                return (
                  <label key={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50">
                    <div
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
                      style={{
                        background: checked ? color : '#f5f5f0',
                        border:     `1.5px solid ${checked ? color : '#d1d5db'}`,
                      }}
                      onClick={() =>
                        set('sources', checked ? sources.filter((s) => s !== id) : [...sources, id])
                      }
                    >
                      {checked && (
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[10px] font-bold" style={{ color: checked ? '#374151' : '#9aa0a6' }}>{id}</span>
                      <span className="ml-1.5 font-body text-[9.5px]" style={{ color: '#9aa0a6' }}>{name}</span>
                    </div>
                    <span className="font-mono text-[8.5px]" style={{ color: '#c4cac4' }}>{count}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <FieldLabel>Query Template</FieldLabel>
            <ConfigInput value={(data.query as string) ?? ''} onChange={(v) => set('query', v)} placeholder="Search for…" />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <FieldLabel>Top-K Chunks</FieldLabel>
              <span className="font-mono text-[10px] font-bold text-gray-600">{(data.topK as number) ?? 10}</span>
            </div>
            <input
              type="range"
              min={1} max={50} step={1}
              value={(data.topK as number) ?? 10}
              onChange={(e) => set('topK', parseInt(e.target.value, 10))}
              className="w-full"
              style={{ accentColor: color }}
            />
            <div className="mt-0.5 flex justify-between font-mono text-[8px]" style={{ color: '#c4cac4' }}>
              <span>1</span><span>50</span>
            </div>
          </div>
        </>
      );
    }

    case 'llm-reason':
      return (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <FieldLabel>Prompt</FieldLabel>
              <button type="button" className="rounded p-0.5 hover:bg-gray-100">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </button>
            </div>
            <textarea
              value={(data.prompt as string) ?? ''}
              onChange={(e) => set('prompt', e.target.value)}
              rows={5}
              className="w-full resize-none rounded-lg px-3 py-2 font-body text-[11.5px] leading-relaxed text-gray-700 outline-none"
              style={{ background: '#f5f5f0', border: '1px solid #ebebea' }}
            />
          </div>
          <div>
            <FieldLabel>Model</FieldLabel>
            <div className="space-y-1">
              {MODELS.map(({ id, name, context }) => {
                const active = (data.model ?? 'claude-sonnet-4-6') === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => set('model', id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors"
                    style={{
                      background: active ? color + '12' : '#f5f5f0',
                      border:     `1px solid ${active ? color + '40' : '#ebebea'}`,
                    }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: active ? color : '#d1d5db' }} />
                    <span className="flex-1 text-left font-body text-[11px] font-semibold" style={{ color: active ? '#374151' : '#9aa0a6' }}>
                      {name}
                    </span>
                    <span className="rounded px-1.5 py-0.5 font-mono text-[8px] font-bold" style={{ background: '#ebebea', color: '#9aa0a6' }}>
                      {context}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <FieldLabel>Temperature</FieldLabel>
              <span className="font-mono text-[10px] font-bold text-gray-600">
                {((data.temperature as number) ?? 0.3).toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0} max={1} step={0.1}
              value={(data.temperature as number) ?? 0.3}
              onChange={(e) => set('temperature', parseFloat(e.target.value))}
              className="w-full"
              style={{ accentColor: color }}
            />
            <div className="mt-0.5 flex justify-between font-mono text-[8px]" style={{ color: '#c4cac4' }}>
              <span>0.0 precise</span><span>1.0 creative</span>
            </div>
          </div>
          <div>
            <FieldLabel>Output Schema</FieldLabel>
            <div className="flex gap-1.5">
              {OUTPUT_SCHEMA.map((s) => {
                const active = (data.outputSchema ?? 'Structured') === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('outputSchema', s)}
                    className="flex-1 rounded-lg py-1.5 font-mono text-[9px] font-bold tracking-wide transition-colors"
                    style={{
                      background: active ? PRIMARY + '15' : '#f5f5f0',
                      border:     `1px solid ${active ? PRIMARY + '40' : '#ebebea'}`,
                      color:      active ? PRIMARY : '#9aa0a6',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      );

    case 'tool-call':
      return (
        <div>
          <FieldLabel>Tool</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {TOOLS.map((t) => {
              const active = (data.tool ?? 'web-search') === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('tool', t)}
                  className="rounded-lg py-1.5 font-mono text-[9px] font-bold uppercase tracking-wide transition-colors"
                  style={{
                    background: active ? color + '15' : '#f5f5f0',
                    border:     `1px solid ${active ? color + '40' : '#ebebea'}`,
                    color:      active ? color : '#9aa0a6',
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      );

    case 'condition':
      return (
        <>
          <div>
            <FieldLabel>Condition Expression</FieldLabel>
            <input
              value={(data.condition as string) ?? ''}
              onChange={(e) => set('condition', e.target.value)}
              placeholder="score >= 0.7"
              className="w-full rounded-lg px-3 py-2 font-mono text-[11px] text-gray-700 outline-none"
              style={{ background: '#f5f5f0', border: '1px solid #ebebea' }}
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <FieldLabel>True Branch</FieldLabel>
              <input
                value={(data.trueLabel as string) ?? 'Pass'}
                onChange={(e) => set('trueLabel', e.target.value)}
                className="w-full rounded-lg px-3 py-2 font-body text-[11px] text-gray-700 outline-none"
                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
              />
            </div>
            <div className="flex-1">
              <FieldLabel>False Branch</FieldLabel>
              <input
                value={(data.falseLabel as string) ?? 'Fail'}
                onChange={(e) => set('falseLabel', e.target.value)}
                className="w-full rounded-lg px-3 py-2 font-body text-[11px] text-gray-700 outline-none"
                style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
              />
            </div>
          </div>
        </>
      );

    case 'transform':
      return (
        <div>
          <FieldLabel>Operation</FieldLabel>
          <div className="space-y-1">
            {TRANSFORM_OPS.map((op) => {
              const active = (data.operation ?? 'extract') === op;
              return (
                <button
                  key={op}
                  type="button"
                  onClick={() => set('operation', op)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 font-body text-[11px] transition-colors"
                  style={{
                    background:  active ? color + '12' : '#f5f5f0',
                    border:      `1px solid ${active ? color + '40' : '#ebebea'}`,
                    color:       active ? color : '#9aa0a6',
                    fontWeight:  active ? 600 : 400,
                  }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: active ? color : '#d1d5db' }} />
                  {op.charAt(0).toUpperCase() + op.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
      );

    case 'output':
      return (
        <div>
          <FieldLabel>Output Format</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {OUTPUT_FORMATS.map((fmt) => {
              const active = (data.format as string)?.toLowerCase() === fmt.toLowerCase();
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => set('format', fmt.toLowerCase())}
                  className="rounded-lg py-2 font-body text-[11px] font-semibold transition-colors"
                  style={{
                    background: active ? '#37415115' : '#f5f5f0',
                    border:     `1px solid ${active ? '#37415140' : '#ebebea'}`,
                    color:      active ? '#374151' : '#9aa0a6',
                  }}
                >
                  {fmt}
                </button>
              );
            })}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function NodeConfigPanel({ node, onUpdate, onDelete }: NodeConfigPanelProps) {
  if (!node) {
    return (
      <div className="flex w-[280px] shrink-0 flex-col items-center justify-center border-l bg-white p-6 text-center" style={{ borderColor: '#e8eae8' }}>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: '#f5f5f0' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4cac4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: '#c4cac4' }}>No selection</p>
        <p className="font-body text-[10px] leading-relaxed" style={{ color: '#9aa0a6' }}>
          Click a node on the canvas to configure it
        </p>
      </div>
    );
  }

  const n = node;
  const type = n.type as FlowNodeType;
  const color = NODE_COLORS[type] ?? '#374151';
  const data  = n.data as Record<string, unknown>;
  const iconPath    = TYPE_ICON_PATHS[type] ?? 'M12 12m-4 0';
  const iconPaths   = iconPath.split('|');
  const displayName = TYPE_DISPLAY_NAMES[type] ?? type;

  function set(key: string, value: unknown) {
    onUpdate(n.id, { ...data, [key]: value });
  }

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-l bg-white" style={{ borderColor: '#e8eae8' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #f0f0ed' }}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: color + '18' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {iconPaths.map((p, i) => <path key={i} d={p} />)}
              </svg>
            </div>
            <span className="font-display text-[13px] font-bold text-gray-800">{displayName}</span>
          </div>
          <span className="rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-white" style={{ background: '#374151' }}>
            SELECTED
          </span>
        </div>
        <p className="font-mono text-[9px]" style={{ color: '#c4cac4' }}>
          NODE · {n.id} · {TYPE_LABELS[type]}
        </p>
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Node label — always shown */}
        <div>
          <FieldLabel>Node Label</FieldLabel>
          <ConfigInput
            value={(data.label as string) ?? ''}
            onChange={(v) => set('label', v)}
            placeholder="Label…"
          />
        </div>

        {/* Type-specific fields */}
        <TypeFields type={type} data={data} set={set} />
      </div>

      {/* Bottom actions */}
      <div className="flex gap-2 p-3" style={{ borderTop: '1px solid #f0f0ed' }}>
        <button
          type="button"
          className="flex-1 rounded-lg px-3 py-2 font-body text-[11px] font-semibold transition-colors hover:bg-gray-50"
          style={{ border: '1px solid #e8eae8', color: '#374151' }}
        >
          Test step
        </button>
        <button
          type="button"
          onClick={() => onDelete(n.id)}
          className="rounded-lg px-3 py-2 font-body text-[11px] font-semibold transition-colors hover:bg-red-50"
          style={{ color: '#dc2626' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
