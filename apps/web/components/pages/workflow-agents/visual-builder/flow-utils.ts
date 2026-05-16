import type { Node, Edge } from '@xyflow/react';

export type FlowNodeType =
  | 'trigger'
  | 'kb-search'
  | 'llm-reason'
  | 'tool-call'
  | 'condition'
  | 'transform'
  | 'output';

export type NodeRunState = 'idle' | 'running' | 'done' | 'error';

export interface TriggerData     { label: string; triggerType: 'manual' | 'schedule' | 'document' | 'kb-query'; state: NodeRunState; }
export interface KBSearchData    { label: string; sources: string[]; query: string; topK: number; state: NodeRunState; }
export interface LLMReasonData   { label: string; prompt: string; model?: string; state: NodeRunState; }
export interface ToolCallData    { label: string; tool: string; state: NodeRunState; }
export interface ConditionData   { label: string; condition: string; trueLabel: string; falseLabel: string; state: NodeRunState; }
export interface TransformData   { label: string; operation: string; state: NodeRunState; }
export interface OutputData      { label: string; format: 'report' | 'json' | 'pdf' | 'email'; state: NodeRunState; }

export type AnyNodeData =
  | TriggerData | KBSearchData | LLMReasonData | ToolCallData
  | ConditionData | TransformData | OutputData;

export const NODE_COLORS: Record<FlowNodeType, string> = {
  trigger:      '#16a34a',
  'kb-search':  '#0369a1',
  'llm-reason': '#7c3aed',
  'tool-call':  '#b45309',
  condition:    '#be185d',
  transform:    '#0e7490',
  output:       '#374151',
};

export const NODE_PALETTE_ITEMS: Array<{
  type: FlowNodeType;
  label: string;
  icon: string;
  description: string;
}> = [
  { type: 'trigger',     label: 'Trigger',      icon: '🎯', description: 'Start the workflow' },
  { type: 'kb-search',   label: 'KB Search',     icon: '🔍', description: 'Search knowledge vaults K1–K7' },
  { type: 'llm-reason',  label: 'LLM Reasoning', icon: '🧠', description: 'Claude analysis & synthesis' },
  { type: 'tool-call',   label: 'Tool Call',     icon: '⚙️', description: 'Call a specific tool or API' },
  { type: 'condition',   label: 'Condition',     icon: '⬡', description: 'Branch on a threshold or rule' },
  { type: 'transform',   label: 'Transform',     icon: '🔄', description: 'Extract, merge or reshape data' },
  { type: 'output',      label: 'Output',        icon: '📄', description: 'Final report or export' },
];

export const STATUS_RING: Record<NodeRunState, string> = {
  idle:    '',
  running: 'ring-2 ring-amber-400',
  done:    'ring-2 ring-green-500',
  error:   'ring-2 ring-red-500',
};

export const STATUS_DOT: Record<NodeRunState, string> = {
  idle:    'bg-gray-200',
  running: 'bg-amber-400',
  done:    'bg-green-500',
  error:   'bg-red-500',
};

const defaults: Record<FlowNodeType, AnyNodeData> = {
  trigger:     { label: 'Start',         triggerType: 'manual',   state: 'idle' } as TriggerData,
  'kb-search': { label: 'KB Search',     sources: ['K3', 'K7'],   query: '', topK: 10, state: 'idle' } as KBSearchData,
  'llm-reason':{ label: 'LLM Reasoning', prompt: 'Analyze and identify compliance gaps:', state: 'idle' } as LLMReasonData,
  'tool-call': { label: 'Tool Call',     tool: 'web-search',      state: 'idle' } as ToolCallData,
  condition:   { label: 'Condition',     condition: 'score >= 0.7', trueLabel: 'Pass', falseLabel: 'Fail', state: 'idle' } as ConditionData,
  transform:   { label: 'Transform',     operation: 'extract',    state: 'idle' } as TransformData,
  output:      { label: 'Output',        format: 'report',        state: 'idle' } as OutputData,
};

export function makeNode(type: FlowNodeType, position: { x: number; y: number }): Node {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return { id, type, position, data: { ...defaults[type] } };
}

export const INITIAL_NODES: Node[] = [
  { id: 'n1', type: 'trigger',    position: { x: 60,  y: 180 }, data: { label: 'Start', triggerType: 'manual', state: 'idle' } },
  { id: 'n2', type: 'kb-search',  position: { x: 300, y: 180 }, data: { label: 'Regulatory KB', sources: ['K3', 'K7'], query: '', topK: 10, state: 'idle' } },
  { id: 'n3', type: 'llm-reason', position: { x: 560, y: 180 }, data: { label: 'Gap Analysis',  prompt: 'Identify compliance gaps from the retrieved regulatory context:', state: 'idle' } },
  { id: 'n4', type: 'output',     position: { x: 820, y: 180 }, data: { label: 'Final Report',  format: 'report', state: 'idle' } },
];

export const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: 'n1', target: 'n2', type: 'smoothstep' },
  { id: 'e2', source: 'n2', target: 'n3', type: 'smoothstep' },
  { id: 'e3', source: 'n3', target: 'n4', type: 'smoothstep' },
];
