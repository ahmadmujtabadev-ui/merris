import type Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger.js';
import { getToolDefinitions, getToolSchemas } from './agent.tools.js';
import { loadSystemPrompt } from './system-prompt.js';
import type { ChatRequest } from './agent.service.js';
import type { buildAgentContext } from './agent.context.js';

// ============================================================
// Shared tool-use loop
// ============================================================
//
// This file is the single source of truth for the Claude tool-use loop
// used by both the JSON chat path (agent.service.ts:chat) and the SSE
// chat path (agent.stream.ts:chatStream).
//
// Historically the two paths had their own private copies that drifted
// in three places:
//   1) chatStream ignored cursorSection
//   2) chatStream wrote a shorter truncation marker
//   3) chatStream swallowed tool errors silently
// All three are reconciled here. Callers are responsible for:
//   - null-checking the Anthropic client before invoking
//   - mapping toolCalls to citations via extractCitations
//   - memory capture and suggestedActions derivation

export const MAX_ROUNDS = 20;

export interface ToolCallRecord {
  name: string;
  input: Record<string, unknown>;
  output: unknown;
}

export interface ToolUseLoopResult {
  responseText: string;
  toolCalls: ToolCallRecord[];
  reachedMaxRounds: boolean;
}

export interface ToolUseLoopOptions {
  client: NonNullable<Anthropic | null>;
  request: ChatRequest;
  context: Awaited<ReturnType<typeof buildAgentContext>>;
  /**
   * Fires after each tool executes (success or failure). chatStream uses
   * this to accumulate knowledge-retrieval domains for thinking_sources
   * emission.
   */
  onToolCall?: (call: ToolCallRecord) => void;
}

export async function runToolUseLoop(opts: ToolUseLoopOptions): Promise<ToolUseLoopResult> {
  const { client, request, context, onToolCall } = opts;
  const {
    conversationHistory = [],
    documentBody,
    cursorSection,
    jurisdiction,
    sector,
    ownershipType,
    message,
  } = request;

  // ---- System prompt --------------------------------------------------
  const systemTemplate = loadSystemPrompt();
  let systemPrompt = systemTemplate
    .replace('{engagement_context}', JSON.stringify(context, null, 2))
    .replace('{tool_descriptions}', 'Available via tool_use — see tools parameter.');

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

  // ---- Context prefix on the user message -----------------------------
  let contextPrefix = '';
  if (jurisdiction) contextPrefix += `Jurisdiction: ${jurisdiction}. `;
  if (sector) contextPrefix += `Sector: ${sector}. `;
  if (ownershipType) contextPrefix += `Entity type: ${ownershipType}. `;
  if (contextPrefix) {
    contextPrefix = `[Context: ${contextPrefix.trim()}]\n\n`;
  }

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: contextPrefix + message },
  ];

  // ---- Tool loop ------------------------------------------------------
  const tools = getToolSchemas() as Anthropic.Tool[];
  const toolDefinitions = getToolDefinitions();
  const toolCalls: ToolCallRecord[] = [];

  let currentMessages = [...messages];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ContentBlock & {
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
      } => block.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find((block) => block.type === 'text');
      const responseText =
        textBlock && 'text' in textBlock
          ? (textBlock as { text: string }).text
          : 'No response generated.';
      return { responseText, toolCalls, reachedMaxRounds: false };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolDef = toolDefinitions.find((t) => t.name === toolUse.name);

      let result: unknown;
      let record: ToolCallRecord | null = null;

      if (toolDef) {
        try {
          result = await toolDef.handler(toolUse.input as Record<string, unknown>);
          record = {
            name: toolUse.name,
            input: toolUse.input as Record<string, unknown>,
            output: result,
          };
          toolCalls.push(record);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Tool execution failed';
          result = { error: errorMessage };
          record = {
            name: toolUse.name,
            input: toolUse.input as Record<string, unknown>,
            output: { error: errorMessage },
          };
          toolCalls.push(record);
          logger.error(`Tool ${toolUse.name} failed`, err);
        }
      } else {
        result = { error: `Unknown tool: ${toolUse.name}` };
      }

      if (record && onToolCall) {
        onToolCall(record);
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    currentMessages = [
      ...currentMessages,
      {
        role: 'assistant',
        content: response.content as unknown as Array<
          Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam
        >,
      },
      { role: 'user', content: toolResults },
    ];
  }

  return { responseText: '', toolCalls, reachedMaxRounds: true };
}
