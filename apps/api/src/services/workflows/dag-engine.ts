// src/services/workflows/dag-engine.ts
//
// DAG execution engine: topological sort → async per-node execution → state threading
// Each node's output feeds downstream nodes as context.

import mongoose from 'mongoose';
import { denseSearch } from '../../modules/knowledge-base/dense-search.service.js';
import { checkCompliance } from '../verification/compliance-checker.js';
import { calculate } from '../../modules/calculation/calculation.service.js';
import { sendMessage } from '../../lib/claude.js';
import { logger } from '../../lib/logger.js';
import { ESGDocumentModel, DataPointModel } from '../../modules/ingestion/ingestion.model.js';
import { HilReviewModel } from '../../modules/hil/hil-review.model.js';

const HIL_SENTINEL = '__HIL_PAUSED__:';

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
  paused?: boolean;
  hilReviewId?: string;
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
  executionId: string,
): Promise<string> {
  const d = node.data;

  switch (node.type) {
    case 'trigger': {
      // Load all ingested engagement documents and their extracted data points
      let docContext = '';
      try {
        const engId = new mongoose.Types.ObjectId(engagementId);
        const docs = await ESGDocumentModel.find(
          { engagementId: engId, status: 'ingested' },
          { filename: 1, extractedData: 1, extractedText: 1 },
        ).lean();

        if (docs.length > 0) {
          const dataPoints = await DataPointModel.find(
            { engagementId: engId },
            { metricName: 1, value: 1, unit: 1, frameworkRef: 1, confidence: 1 },
          ).lean();

          const dpSummary = dataPoints
            .slice(0, 40)
            .map((dp) => `  • ${dp.metricName}: ${dp.value} ${dp.unit} [${dp.frameworkRef}]`)
            .join('\n');

          const textPreviews = docs
            .map((doc) => {
              const preview = doc.extractedText?.slice(0, 1500) ?? '';
              return `=== ${doc.filename} ===\n${preview}`;
            })
            .join('\n\n');

          docContext = `ENGAGEMENT DOCUMENTS (${docs.length} file${docs.length > 1 ? 's' : ''} ingested):\n\nExtracted Data Points:\n${dpSummary}\n\nDocument Text:\n${textPreviews}`;
        }
      } catch (err) {
        logger.warn('DAG trigger: could not load engagement docs', err);
      }

      return JSON.stringify({
        triggered: true,
        timestamp: new Date().toISOString(),
        document_context: docContext || null,
      });
    }

    case 'kb-search': {
      // Derive query: use configured template, fall back to context excerpt
      let query = String(d['query'] ?? '').trim();
      if (!query && context) {
        // Extract a meaningful phrase from predecessor context
        const stripped = context.replace(/[{}":\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
        query = stripped.slice(0, 150);
      }
      if (!query) return '[]';

      // Map K1-K7 vault selections to M01-M14 module names
      const sourceMap: Record<string, string> = {
        K1: 'M09-financial',
        K2: 'M10-sector',
        K3: 'M01-regulatory',
        K4: 'M09-financial',
        K5: 'M04-benchmarks',
        K6: 'M05-climate',
        K7: 'M14-research',
      };
      const rawSources = (d['sources'] as string[] | undefined) ?? [];
      const modules = rawSources.length > 0
        ? rawSources.map((k) => sourceMap[k] ?? k).filter(Boolean)
        : undefined;

      // Search firm-wide KB (Qdrant dense)
      const kbResults = await denseSearch({ query, modules, limit: 8, minScore: 0.15 });

      // Also pull matching data points from the engagement's ingested docs
      let engagementMatches: Array<{ metric: string; value: unknown; unit: string; source: string }> = [];
      try {
        const engId = new mongoose.Types.ObjectId(engagementId);
        const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const regex = queryWords.length > 0
          ? new RegExp(queryWords.slice(0, 4).join('|'), 'i')
          : /./;
        const dps = await DataPointModel.find(
          { engagementId: engId, metricName: regex },
          { metricName: 1, value: 1, unit: 1, frameworkRef: 1 },
        ).limit(10).lean();
        engagementMatches = dps.map((dp) => ({
          metric: dp.metricName,
          value: dp.value,
          unit: dp.unit,
          source: `engagement:${dp.frameworkRef}`,
        }));
      } catch { /* non-critical */ }

      return JSON.stringify(
        {
          kb_results: kbResults.slice(0, 5).map((r) => ({
            filename: r.filename,
            module: r.module,
            score: r.score,
            excerpt: r.text.slice(0, 500),
          })),
          engagement_data: engagementMatches,
        },
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
      const label = String(d['label'] ?? '').toLowerCase();

      // Human-in-the-Loop pause: save review record and return sentinel
      if (label.includes('human') || label.includes('hil') || label.includes('review')) {
        const reviewId = `hil_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        try {
          const doc = new HilReviewModel({
            reviewId,
            executionId: executionId || 'unknown',
            templateId: '',
            engagementId: engagementId || '',
            nodeId: String(node.id || 'node'),
            nodeLabel: String(d['label'] ?? node.id ?? 'Human Review'),
            stepIndex: 0,
            totalSteps: 0,
            agentOutput: String(context || '').slice(0, 8000),
            runContext: {},
            status: 'pending',
          });
          await doc.save({ validateBeforeSave: false });
          logger.info(`DAG ${executionId}: HIL review saved reviewId=${reviewId}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`DAG: HIL save FAILED — ${msg}`);
        }
        return `${HIL_SENTINEL}${reviewId}`;
      }

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
      output = await executeNode(node, context, engagementId, executionId);
    } catch (err) {
      output = `Error: ${err instanceof Error ? err.message : String(err)}`;
    }

    nodeOutputs.set(node.id, output);

    // Detect HIL pause sentinel — stop DAG and surface review ID
    if (output.startsWith(HIL_SENTINEL)) {
      const hilReviewId = output.slice(HIL_SENTINEL.length);
      steps.push({
        type: 'observation',
        content: `Paused for human review · reviewId: ${hilReviewId}`,
        tool: node.type,
        toolResultSummary: `Awaiting approval (${hilReviewId})`,
      });
      onStep(steps);

      const pausedAnswer = `This workflow has paused for a human review step.\n\nReview ID: **${hilReviewId}**\n\nOpen the Human-in-Loop review page to approve or reject this step and continue the workflow.`;
      steps.push({ type: 'final', content: pausedAnswer });
      onStep(steps);

      return { steps, finalAnswer: pausedAnswer, nodeCount: sorted.length, paused: true, hilReviewId };
    }

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
