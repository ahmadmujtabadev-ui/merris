import type { NodeTypes } from '@xyflow/react';
import { TriggerNode }   from './trigger-node';
import { KBSearchNode }  from './kb-search-node';
import { LLMReasonNode } from './llm-reason-node';
import { ToolCallNode }  from './tool-call-node';
import { ConditionNode } from './condition-node';
import { TransformNode } from './transform-node';
import { OutputNode }    from './output-node';

export const nodeTypes: NodeTypes = {
  trigger:      TriggerNode,
  'kb-search':  KBSearchNode,
  'llm-reason': LLMReasonNode,
  'tool-call':  ToolCallNode,
  condition:    ConditionNode,
  transform:    TransformNode,
  output:       OutputNode,
};
