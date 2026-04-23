import { getClient } from '../../lib/claude.js';
import { logger } from '../../lib/logger.js';
import { buildAgentContext } from './agent.context.js';
import { getToolDefinitions } from './agent.tools.js';
import { captureConversation, buildMemoryContext } from './memory.js';
import { trackDataGaps } from '../../services/knowledge/gap-tracker.js';
import { extractCitations, determineConfidence, type Citation } from './citations.js';
import { runToolUseLoop } from './tool-use-loop.js';
import type { ToolCall } from '@merris/shared';

export type { Citation };

// ============================================================
// Types
// ============================================================

export interface ChatRequest {
  engagementId: string;
  userId: string;
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  documentBody?: string;
  cursorSection?: string;
  jurisdiction?: string;
  sector?: string;
  ownershipType?: string;
  documentId?: string;
  knowledgeSources?: string[];
}

export interface ChatResponse {
  response: string;
  toolCalls: ToolCall[];
  suggestedActions?: string[];
  citations: Citation[];       // verified KB entries only
  references: string[];        // model knowledge references (not from KB)
  confidence: 'high' | 'medium' | 'low';
  data_gaps: string[];
}

export interface ActionRequest {
  engagementId: string;
  userId: string;
  action: string;
  params: Record<string, unknown>;
}

// ============================================================
// Chat Function
// ============================================================

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const { engagementId, userId, message } = request;

  const client = getClient();
  if (!client) {
    return {
      response:
        'The AI agent is currently unavailable. Please ensure ANTHROPIC_API_KEY is configured.',
      toolCalls: [],
      citations: [],
      references: [],
      confidence: 'low',
      data_gaps: [],
    };
  }

  // Build context
  const context = await buildAgentContext(engagementId, userId);

  // Run the shared tool-use loop (same code path as chatStream)
  const { responseText, toolCalls, reachedMaxRounds } = await runToolUseLoop({
    client,
    request,
    context,
  });

  const finalResponse = reachedMaxRounds
    ? 'The agent completed processing but reached the maximum number of tool execution rounds.'
    : responseText;

  // Capture to memory (awaited so history is always persisted)
  await captureConversation({
    engagementId,
    userId,
    channel: 'web',
    userMessage: message,
    agentResponse: finalResponse,
    toolsUsed: toolCalls.map((t) => t.name),
  }).catch((err) => logger.error('Memory capture failed', err));

  const { citations, references, data_gaps } = extractCitations(toolCalls as ToolCall[]);
  trackDataGaps(data_gaps, { country: context?.orgProfile?.country, sector: context?.orgProfile?.industry }).catch(() => {}); // non-blocking

  return {
    response: finalResponse,
    toolCalls: toolCalls as ToolCall[],
    suggestedActions: deriveSuggestedActions(context),
    citations,
    references,
    confidence: determineConfidence(citations, toolCalls as ToolCall[]),
    data_gaps,
  };
}

// ============================================================
// Direct Action Execution
// ============================================================

export async function executeAction(request: ActionRequest): Promise<unknown> {
  const { action, params, engagementId } = request;

  const toolDefinitions = getToolDefinitions();
  const toolDef = toolDefinitions.find((t) => t.name === action);

  if (!toolDef) {
    throw new Error(`Unknown action: ${action}`);
  }

  // Inject engagementId into params if not present
  const enrichedParams = { engagementId, ...params };

  return toolDef.handler(enrichedParams);
}

// ============================================================
// Helpers
// ============================================================

function deriveSuggestedActions(context: Awaited<ReturnType<typeof buildAgentContext>>): string[] {
  const suggestions: string[] = [];

  if (context.dataCompleteness.overall < 50) {
    suggestions.push('Upload more data sources to improve completeness');
  }
  if (context.dataCompleteness.overall >= 50 && context.dataCompleteness.overall < 90) {
    suggestions.push('Review and confirm pending data points');
  }
  if (context.dataCompleteness.overall >= 60) {
    suggestions.push('Draft disclosure narratives for completed sections');
  }
  if (context.currentStage === 'review') {
    suggestions.push('Run consistency check before finalizing');
  }

  return suggestions;
}
