// src/services/workflows/react-engine.ts
//
// ReAct (Reasoning + Acting) agent engine using Claude's native tool_use API.
// Claude autonomously decides which tools to call and when to stop.

import Anthropic from '@anthropic-ai/sdk';
import { semanticSearch } from '../../modules/knowledge-base/search.service.js';
import { checkCompliance } from '../verification/compliance-checker.js';
import { calculate } from '../../modules/calculation/calculation.service.js';
import { sendMessage } from '../../lib/claude.js';
import { logger } from '../../lib/logger.js';
import { getTemplate } from './workflows.service.js';

// ── Types ─────────────────────────────────────────────────────

export interface ReActStep {
  type: 'thought' | 'action' | 'observation' | 'final';
  content: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  toolResultSummary?: string;
}

export interface ReActExecution {
  id: string;
  templateId: string;
  engagementId: string;
  goal: string;
  status: 'running' | 'completed' | 'failed';
  steps: ReActStep[];
  finalAnswer: string;
  iterations: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// ── In-memory store ───────────────────────────────────────────

const reactStore = new Map<string, ReActExecution>();

export function getReActExecution(id: string): ReActExecution | null {
  return reactStore.get(id) ?? null;
}

export function listReActExecutions(): ReActExecution[] {
  return Array.from(reactStore.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

// ── Tool definitions exposed to Claude ───────────────────────

const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'search_knowledge',
    description:
      'Semantic search across the ESG knowledge base (K1–K7: regulatory, climate science, environmental, social, corporate disclosure, methodology, guidance). Use this before making any regulatory or factual claims.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        domains: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional domain filter: regulatory, climate_science, environmental_science, social_data, corporate_disclosure, methodology, guidance',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'verify_compliance',
    description:
      'Check a document or set of ESG disclosures against frameworks (GRI, ESRS, TCFD, CSRD, ISSB, SASB, CDP, QCB, ADX). Returns a structured gap analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        documentBody: { type: 'string', description: 'ESG disclosure text to verify' },
        frameworks: {
          type: 'array',
          items: { type: 'string' },
          description: 'Framework codes, e.g. ["gri", "esrs", "tcfd", "qcb"]',
        },
      },
      required: ['documentBody', 'frameworks'],
    },
  },
  {
    name: 'detect_frameworks',
    description:
      'Scan text to identify which ESG frameworks (GRI, SASB, TCFD, ISSB, CSRD, ESRS, CDP, UNGC, SDG) are referenced.',
    input_schema: {
      type: 'object' as const,
      properties: {
        documentBody: { type: 'string', description: 'Text to scan for framework mentions' },
      },
      required: ['documentBody'],
    },
  },
  {
    name: 'benchmark',
    description:
      'Search peer company ESG disclosures and practices in the knowledge base for comparison.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sector: {
          type: 'string',
          description: 'Industry sector, e.g. "energy", "finance", "manufacturing", "real estate"',
        },
        metric: {
          type: 'string',
          description: 'ESG metric to benchmark, e.g. "scope 1 emissions", "board diversity ratio"',
        },
      },
      required: ['sector'],
    },
  },
  {
    name: 'calculate',
    description:
      'Perform GHG emissions calculations (Scope 1/2/3), intensity ratios, water/waste metrics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        method: {
          type: 'string',
          description:
            'One of: ghg_scope1, ghg_scope2_market, ghg_scope2_location, ghg_scope3, intensity_ratio, water_intensity, waste_diversion',
        },
        inputs: {
          type: 'object',
          description: 'Calculation parameters (activityData, emissionFactor, unit, revenue, etc.)',
        },
      },
      required: ['method', 'inputs'],
    },
  },
  {
    name: 'generate_text',
    description:
      'Draft ESG report sections, executive summaries, remediation plans, or any written content using Claude.',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: { type: 'string', description: 'What to write' },
        context: { type: 'string', description: 'Optional background data or findings to incorporate' },
      },
      required: ['prompt'],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  engagementId: string,
): Promise<unknown> {
  switch (toolName) {
    case 'search_knowledge': {
      const query = String(toolInput['query'] ?? '');
      const domains = toolInput['domains'] as string[] | undefined;
      const results = await semanticSearch({ query, domains, limit: 8 });
      return results.slice(0, 6).map((r) => ({
        title: r.title,
        domain: r.domain,
        score: Number(r.score.toFixed(3)),
        source: r.source,
        description: r.description,
      }));
    }

    case 'verify_compliance': {
      const documentBody = String(toolInput['documentBody'] ?? '');
      const frameworks = (toolInput['frameworks'] as string[]) ?? [];
      return checkCompliance(engagementId, documentBody, frameworks);
    }

    case 'detect_frameworks': {
      const text = String(toolInput['documentBody'] ?? '').toLowerCase();
      const patterns: Record<string, RegExp[]> = {
        gri: [/\bgri\b/, /global reporting initiative/i],
        sasb: [/\bsasb\b/, /sustainability accounting standards/i],
        tcfd: [/\btcfd\b/, /task force on climate/i],
        issb: [/\bissb\b/, /international sustainability standards/i],
        csrd: [/\bcsrd\b/, /corporate sustainability reporting/i],
        esrs: [/\besrs\b/, /european sustainability reporting/i],
        cdp: [/\bcdp\b/, /carbon disclosure project/i],
        ungc: [/\bungc\b/, /un global compact/i],
        sdg: [/\bsdg\b/, /sustainable development goals/i],
      };
      const detected = Object.entries(patterns)
        .filter(([, rxs]) => rxs.some((r) => r.test(text)))
        .map(([code]) => code);
      return { detectedFrameworks: detected };
    }

    case 'benchmark': {
      const sector = String(toolInput['sector'] ?? '');
      const metric = toolInput['metric'] ? String(toolInput['metric']) : '';
      const query = metric ? `${sector} ${metric} peer benchmark` : `${sector} ESG best practice`;
      const results = await semanticSearch({ query, domains: ['corporate_disclosure'], limit: 6 });
      return results.slice(0, 5).map((r) => ({
        title: r.title,
        score: Number(r.score.toFixed(3)),
        source: r.source,
        description: r.description,
      }));
    }

    case 'calculate': {
      const method = String(toolInput['method'] ?? '');
      const inputs = (toolInput['inputs'] as Record<string, unknown>) ?? {};
      return calculate({
        method: method as Parameters<typeof calculate>[0]['method'],
        inputs,
        engagementId,
        disclosureRef: '',
      });
    }

    case 'generate_text': {
      const prompt = String(toolInput['prompt'] ?? '');
      const context = toolInput['context'] ? String(toolInput['context']) : '';
      const fullPrompt = context ? `Context:\n${context}\n\nTask:\n${prompt}` : prompt;
      const result = await sendMessage({
        system:
          'You are an expert ESG analyst and sustainability reporting specialist. Write clear, professional, evidence-based content.',
        messages: [{ role: 'user', content: fullPrompt }],
        maxTokens: 2048,
      });
      return result ?? 'Unable to generate text.';
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ── Goal builder ──────────────────────────────────────────────

function buildGoal(template: { name: string; description: string; steps: Array<{ name: string; description?: string }> }): string {
  const stepList = template.steps
    .map((s, i) => `${i + 1}. ${s.name}${s.description ? ` — ${s.description}` : ''}`)
    .join('\n');
  return [
    template.name,
    template.description ? `\n${template.description}` : '',
    `\n\nWorkflow steps:\n${stepList}`,
  ].join('');
}

// ── Main ReAct loop ───────────────────────────────────────────

export async function runReActAgent(
  templateId: string,
  engagementId: string,
  inputs: Record<string, unknown> = {},
): Promise<ReActExecution> {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Template "${templateId}" not found`);

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const anthropic = new Anthropic({ apiKey });
  const executionId = `react-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const goal = buildGoal(template);

  const execution: ReActExecution = {
    id: executionId,
    templateId,
    engagementId,
    goal,
    status: 'running',
    steps: [],
    finalAnswer: '',
    iterations: 0,
    startedAt: new Date().toISOString(),
  };

  reactStore.set(executionId, execution);

  const systemPrompt = `You are Merris, an expert ESG compliance AI agent running an autonomous analysis.

Engagement ID: ${engagementId}
Task: ${goal}

Operating rules:
1. ALWAYS search the knowledge base before making regulatory or factual claims
2. Use verify_compliance to check disclosures against frameworks, not just guess
3. Use calculate for any GHG or metric computations — never estimate by hand
4. Use benchmark to compare against peer organisations
5. After gathering sufficient evidence, produce a comprehensive final answer with cited sources
6. For GCC/Gulf: reference QCB, ADX, DFM, ADNOC frameworks where relevant
7. For EU organisations: reference ESRS E1-E5, CSRD, SFDR requirements
8. For global: apply GRI, TCFD, ISSB standards
${Object.keys(inputs).length > 0 ? `\nAdditional context: ${JSON.stringify(inputs)}` : ''}`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Execute this ESG workflow and provide a full analysis:\n\n${goal}` },
  ];

  const MAX_ITERATIONS = 12;

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      execution.iterations = iter + 1;
      reactStore.set(executionId, { ...execution, steps: [...execution.steps] });

      logger.info(`ReAct ${executionId}: iteration ${iter + 1}/${MAX_ITERATIONS}`);

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOL_DEFINITIONS,
        messages,
      });

      // Record any text reasoning as a Thought
      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          execution.steps.push({ type: 'thought', content: block.text });
          reactStore.set(executionId, { ...execution, steps: [...execution.steps] });
        }
      }

      // Claude finished — extract final answer
      if (response.stop_reason === 'end_turn') {
        const lastText = response.content
          .filter((b) => b.type === 'text')
          .at(-1);
        execution.finalAnswer =
          lastText && 'text' in lastText ? lastText.text : 'Analysis complete.';
        execution.steps.push({ type: 'final', content: execution.finalAnswer });
        break;
      }

      // Claude wants to call tools
      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          if (block.type !== 'tool_use') continue;

          const toolInput = block.input as Record<string, unknown>;

          execution.steps.push({
            type: 'action',
            content: `Calling ${block.name}(${JSON.stringify(toolInput).slice(0, 120)}…)`,
            tool: block.name,
            toolInput,
          });
          reactStore.set(executionId, { ...execution, steps: [...execution.steps] });

          let resultContent: string;
          let isError = false;

          try {
            const result = await executeTool(block.name, toolInput, engagementId);
            resultContent =
              typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          } catch (err) {
            resultContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
            isError = true;
          }

          execution.steps.push({
            type: 'observation',
            content: resultContent,
            tool: block.name,
            toolResultSummary: resultContent.slice(0, 300),
          });
          reactStore.set(executionId, { ...execution, steps: [...execution.steps] });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: resultContent,
            ...(isError ? { is_error: true } : {}),
          });
        }

        // Grow message history with assistant response + tool results
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: toolResults });
      }
    }

    if (execution.status === 'running') {
      if (!execution.finalAnswer) {
        execution.finalAnswer = 'Workflow reached maximum iterations. See step-by-step analysis above.';
        execution.steps.push({ type: 'final', content: execution.finalAnswer });
      }
      execution.status = 'completed';
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`ReAct ${executionId} failed: ${msg}`, err);
    execution.status = 'failed';
    execution.error = msg;
  }

  execution.completedAt = new Date().toISOString();
  reactStore.set(executionId, { ...execution, steps: [...execution.steps] });
  return execution;
}
