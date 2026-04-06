import type { StreamEvent, ThinkingStepName, CitationItem } from '@merris/shared';
import { getClient } from '../../lib/claude.js';
import { logger } from '../../lib/logger.js';
import { buildAgentContext } from './agent.context.js';
import { getToolDefinitions, getToolSchemas } from './agent.tools.js';
import { captureConversation } from './memory.js';
import { checkHardBlocks, evaluateResponse, autoRewrite } from '../../services/assistant/evaluator.js';
import type { ChatRequest } from './agent.service.js';
import type Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSystemPrompt(): string {
  const promptPath = path.resolve(__dirname, '../../../../../prompts/router.md');
  try {
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return 'You are the Merris ESG Agent — an expert sustainability advisor.';
  }
}

type Emit = (event: StreamEvent) => void;

async function phase<T>(
  emit: Emit,
  step: ThinkingStepName,
  fn: () => Promise<T> | T,
  detailFn?: (result: T) => string | undefined,
): Promise<T> {
  emit({ type: 'thinking_step', step, status: 'active' });
  try {
    const result = await fn();
    const detail = detailFn?.(result);
    emit({ type: 'thinking_step', step, status: 'done', ...(detail ? { detail } : {}) });
    return result;
  } catch (err) {
    // Terminate the in-flight phase so the frontend's progress UI doesn't
    // show this step as 'active' forever. The outer chatStream try/catch
    // still emits the top-level error + done after rethrow.
    emit({ type: 'thinking_step', step, status: 'done', detail: 'failed' });
    throw err;
  }
}

export async function chatStream(request: ChatRequest, emit: Emit): Promise<void> {
  try {
    // Phase 1: Assessing query — classify intent (cheap heuristic for now)
    await phase(emit, 'Assessing query', () => classifyIntent(request.message), (intent) => intent);

    // Phase 2: Searching context — load engagement context
    const context = await phase(
      emit,
      'Searching context',
      () => buildAgentContext(request.engagementId, request.userId),
      (ctx) => `${ctx.engagement?.name ?? 'engagement'} — ${ctx.orgProfile?.industry ?? 'unknown sector'}`,
    );

    // Phase 3: Retrieving intelligence — placeholder, real source emission happens during tool use
    await phase(emit, 'Retrieving intelligence', async () => {
      const sources = inferKnowledgeSources(request);
      // emits thinking_sources inline before phase done so the chips render
      // alongside the in-progress 'Retrieving intelligence' step
      if (sources.length > 0) {
        emit({ type: 'thinking_sources', sources });
      }
      return sources;
    });

    // Phase 4: Analyzing — call Claude (atomic; tool-use loop inside)
    const client = getClient();
    if (!client) {
      emit({ type: 'error', message: 'AI agent unavailable: ANTHROPIC_API_KEY not configured.' });
      emit({ type: 'done' });
      return;
    }

    const { responseText, toolCalls, citations } = await phase(
      emit,
      'Analyzing',
      () => runClaudeToolLoop(client, request, context),
    );

    // Phase 5: Evaluating quality — run evaluator + optional auto-rewrite.
    // Hard-blocked responses bypass the evaluator entirely; running the
    // evaluator on the synthetic warning string would produce semantically
    // meaningless score/decision values that are misleading on the wire.
    const { finalResponse, evaluation } = await phase(
      emit,
      'Evaluating quality',
      async () => {
        const hardBlock = checkHardBlocks(responseText);
        if (hardBlock) {
          // Streaming path does NOT regenerate (would re-emit phases).
          // Suppress with a warning string and a synthetic block evaluation.
          return {
            finalResponse: '⚠️ Response failed hard-block check and was suppressed. Please rephrase.',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            evaluation: { score: 0, decision: 'BLOCK', flags: [], hardBlocked: true } as any as Awaited<
              ReturnType<typeof evaluateResponse>
            >,
          };
        }
        let final = responseText;
        const evalResult = await evaluateResponse(request.message, final, { engagementId: request.engagementId });
        if (evalResult.decision === 'FIX' && evalResult.fix_instructions) {
          final = await autoRewrite(final, evalResult.flags, evalResult.fix_instructions);
        }
        return { finalResponse: final, evaluation: evalResult };
      },
      (r) => `score ${r.evaluation.score} (${r.evaluation.decision})`,
    );

    // Phase 6: Answering — emit the response, sources, evaluation, done
    await phase(emit, 'Answering', async () => {
      emit({ type: 'token', text: finalResponse });
      if (citations.length > 0) {
        emit({ type: 'sources', citations });
      }
      emit({
        type: 'evaluation',
        score: evaluation.score,
        confidence: deriveConfidence(citations),
        decision: evaluation.decision,
      });
    });

    // Capture to memory non-blocking
    captureConversation({
      engagementId: request.engagementId,
      userId: request.userId,
      channel: 'web',
      userMessage: request.message,
      agentResponse: finalResponse,
      toolsUsed: toolCalls.map((t) => t.name),
    }).catch(() => {});

    emit({ type: 'done' });
  } catch (err) {
    logger.error('chatStream failed', err);
    emit({ type: 'error', message: err instanceof Error ? err.message : 'Unknown stream error' });
    emit({ type: 'done' });
  }
}

// ----- helpers -----

/** PLACEHOLDER: cheap heuristic — replace with a real intent classifier in a follow-up plan. */
function classifyIntent(message: string): string {
  const m = message.toLowerCase();
  if (/draft|write|generate/.test(m)) return 'drafting request';
  if (/review|check|gap|finding/.test(m)) return 'review request';
  if (/calculate|how many|how much|total/.test(m)) return 'quantitative query';
  return 'advisory question';
}

/** PLACEHOLDER: defaults to a representative trio when the caller doesn't pass `knowledgeSources`. */
function inferKnowledgeSources(request: ChatRequest): string[] {
  if (request.knowledgeSources && request.knowledgeSources.length > 0) {
    return request.knowledgeSources;
  }
  // default to a representative trio so the chips render in early integration tests
  return ['K1', 'K2', 'K3'];
}

function deriveConfidence(citations: CitationItem[]): 'high' | 'medium' | 'low' {
  if (citations.length >= 3) return 'high';
  if (citations.length >= 1) return 'medium';
  return 'low';
}

interface ToolLoopResult {
  responseText: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown>; output: unknown }>;
  citations: CitationItem[];
}

async function runClaudeToolLoop(
  client: NonNullable<ReturnType<typeof getClient>>,
  request: ChatRequest,
  context: Awaited<ReturnType<typeof buildAgentContext>>,
): Promise<ToolLoopResult> {
  const systemTemplate = loadSystemPrompt();
  let systemPrompt = systemTemplate
    .replace('{engagement_context}', JSON.stringify(context, null, 2))
    .replace('{tool_descriptions}', 'Available via tool_use — see tools parameter.');

  if (request.documentBody) {
    const docSection =
      request.documentBody.length > 15000
        ? request.documentBody.substring(0, 15000) + '\n\n[Document truncated]'
        : request.documentBody;
    systemPrompt += `\n\nDOCUMENT CONTEXT:\n${docSection}`;
  }

  let prefix = '';
  if (request.jurisdiction) prefix += `Jurisdiction: ${request.jurisdiction}. `;
  if (request.sector) prefix += `Sector: ${request.sector}. `;
  if (request.ownershipType) prefix += `Entity type: ${request.ownershipType}. `;
  if (prefix) prefix = `[Context: ${prefix.trim()}]\n\n`;

  const messages: Anthropic.MessageParam[] = [
    ...(request.conversationHistory ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: prefix + request.message },
  ];

  const tools = getToolSchemas() as Anthropic.Tool[];
  const toolDefinitions = getToolDefinitions();
  const toolCalls: ToolLoopResult['toolCalls'] = [];

  let currentMessages = [...messages];
  const MAX_ROUNDS = 20;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Extract<typeof block, { type: 'tool_use' }> => block.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find((b) => b.type === 'text');
      const responseText = textBlock && 'text' in textBlock ? (textBlock as { text: string }).text : '';
      // Citations are derived in the existing extractCitations() — for now, return [] and rely on tool catalogue.
      // The full extractCitations import would create a circular dep risk; lift it in Task 7 if needed.
      return { responseText, toolCalls, citations: [] };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const def = toolDefinitions.find((t) => t.name === toolUse.name);
      let result: unknown;
      if (def) {
        try {
          result = await def.handler(toolUse.input as Record<string, unknown>);
          toolCalls.push({ name: toolUse.name, input: toolUse.input as Record<string, unknown>, output: result });
        } catch (err) {
          result = { error: err instanceof Error ? err.message : 'Tool failed' };
          toolCalls.push({ name: toolUse.name, input: toolUse.input as Record<string, unknown>, output: result });
        }
      } else {
        result = { error: `Unknown tool: ${toolUse.name}` };
      }
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
    }

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: response.content as unknown as Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> },
      { role: 'user', content: toolResults },
    ];
  }

  return { responseText: 'Reached max tool rounds.', toolCalls, citations: [] };
}
