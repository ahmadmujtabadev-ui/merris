import type { StreamEvent, ThinkingStepName, CitationItem } from '@merris/shared';
import { getClient } from '../../lib/claude.js';
import { logger } from '../../lib/logger.js';
import { buildAgentContext } from './agent.context.js';
import { captureConversation } from './memory.js';
import { extractCitations, toWireCitations, TOOL_CITATION_MAP } from './citations.js';
import { checkHardBlocks, evaluateResponse, autoRewrite } from '../../services/assistant/evaluator.js';
import { runToolUseLoop, type ToolCallRecord } from './tool-use-loop.js';
import type { ChatRequest } from './agent.service.js';

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
    // Phase 1: Assessing query — no-op; timeline still animates active → done
    await phase(emit, 'Assessing query', () => undefined);

    // Phase 2: Searching context — load engagement context
    const context = await phase(
      emit,
      'Searching context',
      () => buildAgentContext(request.engagementId, request.userId),
      (ctx) => `${ctx.engagement?.name ?? 'engagement'} — ${ctx.orgProfile?.industry ?? 'unknown sector'}`,
    );

    // Phase 3: Retrieving intelligence — dual-mode thinking_sources emission.
    //
    // If the caller explicitly provided knowledgeSources (e.g. the add-in
    // scoped the query to specific K-domains), we emit them here during
    // Phase 3 so the chips render alongside the in-progress retrieval step.
    // Otherwise we defer emission until the Analyzing phase, where we can
    // derive real K-domains from the tool calls that actually executed via
    // TOOL_CITATION_MAP. Either way, the Phase 3 step still fires so the
    // phase ordering contract (asserted in agent.stream.test.ts) is stable.
    const preEmittedSources = request.knowledgeSources && request.knowledgeSources.length > 0
      ? request.knowledgeSources
      : null;
    await phase(emit, 'Retrieving intelligence', async () => {
      if (preEmittedSources) {
        emit({ type: 'thinking_sources', sources: preEmittedSources });
      }
    });

    // Phase 4: Analyzing — call Claude (atomic; shared tool-use loop)
    const client = getClient();
    if (!client) {
      emit({ type: 'error', message: 'AI agent unavailable: ANTHROPIC_API_KEY not configured.' });
      emit({ type: 'done' });
      return;
    }

    const { responseText, toolCalls, citations } = await phase(
      emit,
      'Analyzing',
      async () => {
        const accumulatedDomains = new Set<string>();
        const onToolCall = (call: ToolCallRecord) => {
          const mapEntry = TOOL_CITATION_MAP[call.name];
          if (mapEntry?.domain) {
            accumulatedDomains.add(mapEntry.domain);
          }
        };

        const loopResult = await runToolUseLoop({
          client,
          request,
          context,
          onToolCall,
        });

        // If the caller did NOT pre-emit sources during Phase 3, emit now
        // using the real K-domains observed in the tool loop. This happens
        // before the Analyzing phase closes so the chips still arrive
        // before the 'Analyzing:done' thinking_step event.
        if (!preEmittedSources && accumulatedDomains.size > 0) {
          emit({ type: 'thinking_sources', sources: Array.from(accumulatedDomains) });
        }

        const finalText = loopResult.reachedMaxRounds
          ? 'Reached max tool rounds.'
          : loopResult.responseText;
        const { citations: extracted } = extractCitations(loopResult.toolCalls);
        return {
          responseText: finalText,
          toolCalls: loopResult.toolCalls,
          citations: toWireCitations(extracted),
        };
      },
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

function deriveConfidence(citations: CitationItem[]): 'high' | 'medium' | 'low' {
  if (citations.length >= 3) return 'high';
  if (citations.length >= 1) return 'medium';
  return 'low';
}
