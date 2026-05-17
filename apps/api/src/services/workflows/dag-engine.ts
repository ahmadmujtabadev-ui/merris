// src/services/workflows/dag-engine.ts
//
// DAG execution engine: topological sort → async per-node execution → state threading
// Each node's output feeds downstream nodes as context.

import { denseSearch } from '../../modules/knowledge-base/dense-search.service.js';
import { checkCompliance } from '../verification/compliance-checker.js';
import { calculate } from '../../modules/calculation/calculation.service.js';
import { sendMessage } from '../../lib/claude.js';
import { logger } from '../../lib/logger.js';

// ── Internal types ──────────────────────────────────────────────

interface DagNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface DagEdge {
  id: string;
  source: string;
  target: string;
}

export interface DagStep {
  type: 'thought' | 'action' | 'observation' | 'final';
  content: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  toolResultSummary?: string;
}

export interface DagResult {
  steps: DagStep[];
  finalAnswer: string;
  nodeCount: number;
}

// ── Topological sort (Kahn's algorithm) ────────────────────────

function topologicalSort(nodes: DagNode[], edges: DagEdge[]): DagNode[] {
  const inDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const adjacency = new Map<string, string[]>(nodes.map((n) => [n.id, []]));

  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  }

  const queue: DagNode[] = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  const sorted: DagNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const neighborId of adjacency.get(node.id) ?? []) {
      const deg = (inDegree.get(neighborId) ?? 1) - 1;
      inDegree.set(neighborId, deg);
      if (deg === 0) {
        const neighbor = nodes.find((n) => n.id === neighborId);
        if (neighbor) queue.push(neighbor);
      }
    }
  }

  return sorted;
}

function buildPredecessorMap(edges: DagEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    if (!map.has(edge.target)) map.set(edge.target, []);
    map.get(edge.target)!.push(edge.source);
  }
  return map;
}

// ── Per-node executor ───────────────────────────────────────────

async function executeNode(
  node: DagNode,
  context: string,
  engagementId: string,
): Promise<string> {
  const d = node.data;

  switch (node.type) {
    case 'trigger':
      return JSON.stringify({ triggered: true, timestamp: new Date().toISOString() });

    case 'kb-search': {
      const query = String(d['query'] ?? '');
      if (!query) return '[]';
      const results = await denseSearch({ query, limit: 6, minScore: 0.2 });
      return JSON.stringify(
        results.slice(0, 5).map((r) => ({
          filename: r.filename,
          module: r.module,
          score: r.score,
          excerpt: r.text.slice(0, 500),
        })),
        null,
        2,
      );
    }

    case 'llm-reason': {
      const prompt = String(d['prompt'] ?? 'Analyze the following context:');
      const full = context
        ? `Context from previous steps:\n${context}\n\nTask:\n${prompt}`
        : prompt;
      const result = await sendMessage({
        system: 'You are Merris, an expert ESG analyst. Be precise, cite evidence, and structure your output clearly.',
        messages: [{ role: 'user', content: full }],
        maxTokens: 2048,
      });
      return result ?? 'No output generated.';
    }

    case 'tool-call': {
      const tool = String(d['tool'] ?? '');
      switch (tool) {
        case 'verify_compliance': {
          const frameworks = (d['frameworks'] as string[]) ?? [];
          const result = await checkCompliance(engagementId, context, frameworks);
          return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        }
        case 'calculate': {
          const method = String(d['method'] ?? '');
          const inputs = (d['inputs'] as Record<string, unknown>) ?? {};
          const result = await calculate({
            method: method as Parameters<typeof calculate>[0]['method'],
            inputs,
            engagementId,
            disclosureRef: '',
          });
          return JSON.stringify(result, null, 2);
        }
        default: {
          const result = await sendMessage({
            system: 'You are an ESG expert tool. Complete the task precisely.',
            messages: [{ role: 'user', content: `Tool: ${tool}\nContext:\n${context}` }],
            maxTokens: 1024,
          });
          return result ?? 'Tool call completed.';
        }
      }
    }

    case 'condition': {
      const condition = String(d['condition'] ?? '');
      const trueLabel = String(d['trueLabel'] ?? 'Pass');
      const falseLabel = String(d['falseLabel'] ?? 'Fail');
      const result = await sendMessage({
        system: 'You are an ESG compliance evaluator. Reply TRUE or FALSE only.',
        messages: [{
          role: 'user',
          content: `Context:\n${context}\n\nCondition: ${condition}\n\nDoes the context satisfy this condition? Reply TRUE or FALSE only.`,
        }],
        maxTokens: 10,
      });
      const passed = result?.trim().toUpperCase().startsWith('TRUE') ?? false;
      return JSON.stringify({ condition, branch: passed ? trueLabel : falseLabel, passed });
    }

    case 'transform': {
      const operation = String(d['operation'] ?? 'extract key information');
      const result = await sendMessage({
        system: 'You are a data extraction specialist. Extract and structure information clearly and concisely.',
        messages: [{
          role: 'user',
          content: `Input data:\n${context}\n\nOperation: ${operation}\n\nReturn only the transformed result.`,
        }],
        maxTokens: 2048,
      });
      return result ?? context;
    }

    case 'output': {
      // If context already contains a rich analysis (>500 chars), return it directly
      // to avoid a redundant expensive synthesis call that risks token overflow
      if (context.length > 500) return context;
      const format = String(d['format'] ?? 'report');
      const result = await sendMessage({
        system: 'You are Merris, an expert ESG reporting specialist. Produce a clear, professional, well-structured final output with citations and actionable recommendations.',
        messages: [{
          role: 'user',
          content: `Synthesize the following analysis into a final ${format}:\n\n${context}`,
        }],
        maxTokens: 2048,
      });
      return result ?? context;
    }

    default:
      return `[Unknown node type: ${node.type}]`;
  }
}

// ── Main DAG runner ─────────────────────────────────────────────

export async function runDAGExecution(
  graph: { nodes: unknown[]; edges: unknown[] },
  engagementId: string,
  executionId: string,
  onStep: (steps: DagStep[]) => void,
): Promise<DagResult> {
  const nodes = graph.nodes as DagNode[];
  const edges = graph.edges as DagEdge[];

  const sorted = topologicalSort(nodes, edges);
  const predecessors = buildPredecessorMap(edges);
  const nodeOutputs = new Map<string, string>();
  const steps: DagStep[] = [];
  let finalAnswer = '';

  for (const node of sorted) {
    const predIds = predecessors.get(node.id) ?? [];
    const contextParts = predIds
      .map((pid) => nodeOutputs.get(pid))
      .filter((v): v is string => v !== undefined && v.length > 0)
      .map((v) => v.slice(0, 1500)); // cap each predecessor's output to avoid token overflow
    const rawContext = contextParts.join('\n\n---\n\n');
    // Hard cap total context at 6000 chars so no single node blows the token limit
    const context = rawContext.length > 6000 ? rawContext.slice(0, 6000) + '\n\n[...context truncated...]' : rawContext;

    steps.push({
      type: 'action',
      content: `[${node.type}] ${String(node.data['label'] ?? node.id)}`,
      tool: node.type,
      toolInput: { nodeId: node.id, label: node.data['label'] },
    });
    onStep(steps);

    logger.info(`DAG ${executionId}: node ${node.id} (${node.type})`);

    let output: string;
    try {
      output = await executeNode(node, context, engagementId);
    } catch (err) {
      output = `Error: ${err instanceof Error ? err.message : String(err)}`;
    }

    nodeOutputs.set(node.id, output);

    steps.push({
      type: 'observation',
      content: output,
      tool: node.type,
      toolResultSummary: output.slice(0, 300),
    });
    onStep(steps);

    if (node.type === 'output') finalAnswer = output;
  }

  // Prefer the best llm-reason result over raw output-node passthrough
  if (!finalAnswer || finalAnswer.length < 100) {
    const llmNode = [...sorted].reverse().find((n) => n.type === 'llm-reason');
    if (llmNode) finalAnswer = nodeOutputs.get(llmNode.id) ?? finalAnswer;
  }

  if (!finalAnswer && sorted.length > 0) {
    const last = sorted[sorted.length - 1]!;
    finalAnswer = nodeOutputs.get(last.id) ?? 'Analysis complete.';
  }

  steps.push({ type: 'final', content: finalAnswer });
  onStep(steps);

  return { steps, finalAnswer, nodeCount: sorted.length };
}
