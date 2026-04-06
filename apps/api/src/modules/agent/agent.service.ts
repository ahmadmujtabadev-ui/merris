import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { getClient } from '../../lib/claude.js';
import { logger } from '../../lib/logger.js';
import { buildAgentContext } from './agent.context.js';
import { getToolDefinitions, getToolSchemas } from './agent.tools.js';
import { captureConversation, buildMemoryContext } from './memory.js';
import { trackDataGaps } from '../../services/knowledge/gap-tracker.js';
import { extractCitations, determineConfidence, type Citation } from './citations.js';
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
// System Prompt Loader
// ============================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSystemPrompt(): string {
  const promptPath = path.resolve(__dirname, '../../../../../prompts/router.md');
  try {
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    logger.warn('Could not load prompts/router.md, using fallback system prompt');
    return `You are the Merris ESG Agent — an expert sustainability advisor.
NEVER fabricate data. Only use values from confirmed data points.
Always cite sources when referencing data.`;
  }
}

// ============================================================
// Chat Function
// ============================================================

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const { engagementId, userId, message, conversationHistory = [], documentBody, cursorSection, jurisdiction, sector, ownershipType } = request;

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

  // Build system prompt
  const systemTemplate = loadSystemPrompt();
  let systemPrompt = systemTemplate
    .replace('{engagement_context}', JSON.stringify(context, null, 2))
    .replace('{tool_descriptions}', 'Available via tool_use — see tools parameter.');

  // Inject document context if provided
  if (documentBody) {
    const docSection = documentBody.length > 15000
      ? documentBody.substring(0, 15000) + '\n\n[Document truncated — ' + documentBody.length + ' chars total]'
      : documentBody;
    systemPrompt += `\n\nDOCUMENT CONTEXT (the user has this document open in Word):\n${docSection}`;
    if (cursorSection) {
      systemPrompt += `\n\nUSER'S CURSOR IS IN SECTION: "${cursorSection}"`;
    }
    systemPrompt += `\n\nWhen the user asks you to "draft" a section, generate the full disclosure text ready to insert into the document. When referencing sections, use the exact headings from the document above. If a section contains "[TO BE DRAFTED BY MERRIS]" or "[TO BE COMPLETED]", that is a placeholder waiting for you to generate content.`;
  }

  // Build context prefix from optional fields
  let contextPrefix = '';
  if (jurisdiction) contextPrefix += `Jurisdiction: ${jurisdiction}. `;
  if (sector) contextPrefix += `Sector: ${sector}. `;
  if (ownershipType) contextPrefix += `Entity type: ${ownershipType}. `;
  if (contextPrefix) {
    contextPrefix = `[Context: ${contextPrefix.trim()}]\n\n`;
  }

  // Build messages
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: contextPrefix + message },
  ];

  // Get tool schemas
  const tools = getToolSchemas() as Anthropic.Tool[];
  const toolDefinitions = getToolDefinitions();
  const toolCalls: ToolCall[] = [];

  // Tool use loop — iterate until we get a final text response
  let currentMessages = [...messages];
  const MAX_TOOL_ROUNDS = 20;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    });

    // Check if response contains tool_use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ContentBlock & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      // Final response — extract text
      const textBlock = response.content.find((block) => block.type === 'text');
      const responseText =
        textBlock && 'text' in textBlock ? (textBlock as { text: string }).text : 'No response generated.';

      // Capture to memory (non-blocking)
      captureConversation({
        engagementId,
        userId,
        channel: 'web',
        userMessage: message,
        agentResponse: responseText,
        toolsUsed: toolCalls.map(t => t.name),
      }).catch(() => { /* non-critical */ });

      const { citations, references, data_gaps } = extractCitations(toolCalls);
      trackDataGaps(data_gaps, { country: context?.orgProfile?.country, sector: context?.orgProfile?.industry }).catch(() => {}); // non-blocking
      return {
        response: responseText,
        toolCalls,
        suggestedActions: deriveSuggestedActions(context),
        citations,
        references,
        confidence: determineConfidence(citations, toolCalls),
        data_gaps,
      };
    }

    // Execute tools and send results back
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolDef = toolDefinitions.find((t) => t.name === toolUse.name);

      let result: unknown;
      if (toolDef) {
        try {
          result = await toolDef.handler(toolUse.input as Record<string, unknown>);
          toolCalls.push({
            name: toolUse.name,
            input: toolUse.input as Record<string, unknown>,
            output: result,
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Tool execution failed';
          result = { error: errorMessage };
          toolCalls.push({
            name: toolUse.name,
            input: toolUse.input as Record<string, unknown>,
            output: { error: errorMessage },
          });
          logger.error(`Tool ${toolUse.name} failed`, err);
        }
      } else {
        result = { error: `Unknown tool: ${toolUse.name}` };
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    // Add assistant message (with tool_use) and user message (with tool_results)
    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: response.content as unknown as Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> },
      { role: 'user', content: toolResults },
    ];
  }

  // If we exceeded max rounds, return what we have
  const { citations, references, data_gaps } = extractCitations(toolCalls);
  trackDataGaps(data_gaps, { country: context?.orgProfile?.country, sector: context?.orgProfile?.industry }).catch(() => {}); // non-blocking
  return {
    response: 'The agent completed processing but reached the maximum number of tool execution rounds.',
    toolCalls,
    citations,
    references,
    confidence: determineConfidence(citations, toolCalls),
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
