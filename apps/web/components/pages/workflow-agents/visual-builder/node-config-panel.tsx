'use client';

import type { Node } from '@xyflow/react';
import { NODE_COLORS, type FlowNodeType } from './flow-utils';

interface NodeConfigPanelProps {
  node: Node | null;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
}

const KB_SOURCES = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7'];
const TOOLS = ['web-search', 'calculator', 'extract-text', 'compare', 'translate', 'validate'];
const TRIGGER_TYPES = ['manual', 'schedule', 'document', 'kb-query'];
const TRANSFORM_OPS = ['extract', 'summarize', 'format', 'merge', 'filter'];
const OUTPUT_FORMATS = ['report', 'json', 'pdf', 'email'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block font-body text-[9px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-body text-[12px] text-gray-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-body text-[12px] text-gray-700 outline-none focus:border-blue-400"
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function Textarea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-body text-[12px] leading-relaxed text-gray-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
    />
  );
}

function NodeFields({ node, onUpdate }: { node: Node; onUpdate: (id: string, data: Record<string, unknown>) => void }) {
  const data = node.data as Record<string, unknown>;
  const type = node.type as FlowNodeType;

  function set(key: string, value: unknown) {
    onUpdate(node.id, { ...data, [key]: value });
  }

  function toggleSource(src: string) {
    const sources = (data.sources as string[]) ?? [];
    set('sources', sources.includes(src) ? sources.filter((s) => s !== src) : [...sources, src]);
  }

  switch (type) {
    case 'trigger':
      return (
        <>
          <Field label="Trigger Type">
            <Select value={data.triggerType as string} onChange={(v) => set('triggerType', v)} options={TRIGGER_TYPES} />
          </Field>
        </>
      );

    case 'kb-search':
      return (
        <>
          <Field label="Knowledge Vaults">
            <div className="flex flex-wrap gap-1">
              {KB_SOURCES.map((src) => {
                const active = ((data.sources as string[]) ?? []).includes(src);
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => toggleSource(src)}
                    className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {src}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Query Template">
            <Input value={(data.query as string) ?? ''} onChange={(v) => set('query', v)} />
          </Field>
          <Field label="Top K Chunks">
            <input
              type="number"
              min={1}
              max={50}
              value={(data.topK as number) ?? 10}
              onChange={(e) => set('topK', parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-body text-[12px] text-gray-700 outline-none focus:border-blue-400"
            />
          </Field>
        </>
      );

    case 'llm-reason':
      return (
        <>
          <Field label="Prompt">
            <Textarea
              value={(data.prompt as string) ?? ''}
              onChange={(v) => set('prompt', v)}
              rows={5}
            />
          </Field>
          <Field label="Model">
            <Select
              value={(data.model as string) ?? 'claude-sonnet-4-6'}
              onChange={(v) => set('model', v)}
              options={['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5']}
            />
          </Field>
        </>
      );

    case 'tool-call':
      return (
        <>
          <Field label="Tool">
            <Select value={(data.tool as string) ?? 'web-search'} onChange={(v) => set('tool', v)} options={TOOLS} />
          </Field>
        </>
      );

    case 'condition':
      return (
        <>
          <Field label="Condition Expression">
            <Input value={(data.condition as string) ?? ''} onChange={(v) => set('condition', v)} />
          </Field>
          <Field label="True Branch Label">
            <Input value={(data.trueLabel as string) ?? 'Pass'} onChange={(v) => set('trueLabel', v)} />
          </Field>
          <Field label="False Branch Label">
            <Input value={(data.falseLabel as string) ?? 'Fail'} onChange={(v) => set('falseLabel', v)} />
          </Field>
        </>
      );

    case 'transform':
      return (
        <Field label="Operation">
          <Select value={(data.operation as string) ?? 'extract'} onChange={(v) => set('operation', v)} options={TRANSFORM_OPS} />
        </Field>
      );

    case 'output':
      return (
        <Field label="Output Format">
          <div className="grid grid-cols-2 gap-1.5">
            {OUTPUT_FORMATS.map((fmt) => {
              const active = data.format === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => set('format', fmt)}
                  className={`rounded-lg border px-2 py-1.5 font-body text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-gray-700 bg-gray-700 text-white'
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {fmt}
                </button>
              );
            })}
          </div>
        </Field>
      );

    default:
      return null;
  }
}

export function NodeConfigPanel({ node, onUpdate, onDelete }: NodeConfigPanelProps) {
  if (!node) {
    return (
      <div className="flex w-[220px] shrink-0 flex-col items-center justify-center border-l border-gray-200 bg-white p-6 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-[20px]">
          ☝️
        </div>
        <p className="font-body text-[11px] leading-relaxed text-gray-400">
          Click a node to configure it
        </p>
      </div>
    );
  }

  const type = node.type as FlowNodeType;
  const color = NODE_COLORS[type] ?? '#374151';
  const data = node.data as Record<string, unknown>;

  return (
    <div className="flex h-full w-[220px] shrink-0 flex-col border-l border-gray-200 bg-white">
      {/* Panel header */}
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-[10px] w-[10px] rounded-full" style={{ background: color }} />
          <span className="font-display text-[12px] font-semibold text-gray-700 capitalize">
            {type.replace(/-/g, ' ')}
          </span>
        </div>
        <p className="mt-0.5 font-mono text-[9px] text-gray-400">{node.id}</p>
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Common: label */}
        <Field label="Node Label">
          <input
            value={(data.label as string) ?? ''}
            onChange={(e) => onUpdate(node.id, { ...data, label: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-body text-[12px] text-gray-700 outline-none focus:border-blue-400"
          />
        </Field>

        {/* Type-specific fields */}
        <NodeFields node={node} onUpdate={onUpdate} />
      </div>

      {/* Delete button */}
      <div className="border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={() => onDelete(node.id)}
          className="w-full rounded-lg border border-red-200 px-3 py-1.5 font-body text-[11px] font-medium text-red-500 transition-colors hover:bg-red-50"
        >
          Delete Node
        </button>
      </div>
    </div>
  );
}
