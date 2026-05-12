import type Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger.js';
import { getToolDefinitions, getToolSchemas } from './agent.tools.js';
import { loadSystemPrompt } from './system-prompt.js';
import type { ChatRequest } from './agent.service.js';
import type { buildAgentContext } from './agent.context.js';

export const MAX_ROUNDS = 4;

// Hard cap on expensive search calls to prevent runaway loops.
// Prompt instructions alone are not reliable — enforce in code.
// search_kb_dense is allowed 2 calls because the named-company protocol
// requires two queries with different keyword angles before concluding no results.
const TOOL_CALL_LIMITS: Record<string, number> = {
  search_kb_dense:  2,
  search_knowledge: 1,
};

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
  onToolCall?: (call: ToolCallRecord) => void;
  onTextChunk?: (chunk: string) => void;
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

  const loopStart = Date.now();

  // ---- System prompt --------------------------------------------------
  const systemTemplate = loadSystemPrompt();
  let systemPromptText = systemTemplate
    .replace('{engagement_context}', JSON.stringify(context, null, 2))
    .replace('{tool_descriptions}', 'Available via tool_use — see tools parameter.');

  if (documentBody) {
    const docSection = documentBody.length > 15000
      ? documentBody.substring(0, 15000) + '\n\n[Document truncated — ' + documentBody.length + ' chars total]'
      : documentBody;
    systemPromptText += `\n\nDOCUMENT CONTEXT (the user has this document open in Word):\n${docSection}`;
    if (cursorSection) {
      systemPromptText += `\n\nUSER'S CURSOR IS IN SECTION: "${cursorSection}"`;
    }
    systemPromptText += `\n\nWhen the user asks you to "draft" a section, generate the full disclosure text ready to insert into the document. When referencing sections, use the exact headings from the document above. If a section contains "[TO BE DRAFTED BY MERRIS]" or "[TO BE COMPLETED]", that is a placeholder waiting for you to generate content.`;
  }

  // Cacheable system prompt (cache_control not in standard SDK types — cast to any)
  const systemParam: any = [
    { type: 'text', text: systemPromptText, cache_control: { type: 'ephemeral' } },
  ];

  // ---- Context prefix --------------------------------------------------
  let contextPrefix = '';
  if (jurisdiction) contextPrefix += `Jurisdiction: ${jurisdiction}. `;
  if (sector) contextPrefix += `Sector: ${sector}. `;
  if (ownershipType) contextPrefix += `Entity type: ${ownershipType}. `;
  if (contextPrefix) contextPrefix = `[Context: ${contextPrefix.trim()}]\n\n`;

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: contextPrefix + message },
  ];

  // ---- Tools — cache_control on last entry caches all schemas ----------
  const rawTools = getToolSchemas() as Anthropic.Tool[];
  const tools: any[] = rawTools.length > 0
    ? [
        ...rawTools.slice(0, -1),
        { ...rawTools[rawTools.length - 1], cache_control: { type: 'ephemeral' } },
      ]
    : rawTools;

  const toolDefinitions = getToolDefinitions();
  const toolCalls: ToolCallRecord[] = [];
  const toolCallCounts: Record<string, number> = {};
  let currentMessages = [...messages];

  logger.info(`[tool-loop] start — system ${systemPromptText.length} chars, ${rawTools.length} tools`);

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const roundStart = Date.now();

    // ---- Claude API call (streaming, with prompt caching) ---------------
    // Streaming means the final-round text reaches onTextChunk in real-time.
    // Tool-calling rounds produce no user-visible text, so streaming is
    // transparent there. finalMessage() gives us the complete tool inputs.
    let response: Anthropic.Message;
    try {
      const stream = (client as any).messages.stream(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: systemParam,
          tools,
          messages: currentMessages,
        },
        { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } },
      );

      // Forward text deltas — visible to user only on the final (no-tool) round
      if (opts.onTextChunk) {
        stream.on('text', (chunk: string) => opts.onTextChunk!(chunk));
      }

      response = await stream.finalMessage();
    } catch (err) {
      logger.error(`[tool-loop] round ${round} Claude API failed`, err);
      throw err;
    }

    const claudeMs = Date.now() - roundStart;
    const usage = (response as any).usage ?? {};
    logger.info(
      `[tool-loop] round ${round} Claude: ${claudeMs}ms | ` +
      `in=${usage.input_tokens ?? '?'} out=${usage.output_tokens ?? '?'} ` +
      `cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0}`,
    );

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ContentBlock & {
        type: 'tool_use'; id: string; name: string; input: Record<string, unknown>;
      } => block.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find((block) => block.type === 'text');
      const responseText = textBlock && 'text' in textBlock
        ? (textBlock as { text: string }).text
        : 'No response generated.';
      logger.info(`[tool-loop] done in ${Date.now() - loopStart}ms after ${round + 1} round(s)`);
      return { responseText, toolCalls, reachedMaxRounds: false };
    }

    logger.info(`[tool-loop] round ${round} calling ${toolUseBlocks.length} tool(s) in parallel: ${toolUseBlocks.map(t => t.name).join(', ')}`);

    // ---- Execute all tools in PARALLEL ----------------------------------
    const toolStart = Date.now();
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const toolDef = toolDefinitions.find((t) => t.name === toolUse.name);
        let result: unknown;
        const t0 = Date.now();

        // Enforce per-tool call limits to prevent runaway search loops
        const callLimit = TOOL_CALL_LIMITS[toolUse.name];
        const callCount = toolCallCounts[toolUse.name] ?? 0;
        if (callLimit && callCount >= callLimit) {
          result = {
            limitReached: true,
            message: `${toolUse.name} already called ${callCount} time(s). Use the context already retrieved to generate your answer — do not search again.`,
          };
          logger.info(`[tool-loop]   ${toolUse.name}: BLOCKED (limit ${callLimit} reached)`);
        } else if (toolDef) {
          toolCallCounts[toolUse.name] = callCount + 1;
          try {
            result = await toolDef.handler(toolUse.input as Record<string, unknown>);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Tool execution failed';
            result = { error: msg };
            logger.error(`[tool-loop] ${toolUse.name} failed`, err);
          }
        } else {
          result = { error: `Unknown tool: ${toolUse.name}` };
        }

        logger.info(`[tool-loop]   ${toolUse.name}: ${Date.now() - t0}ms`);

        const record: ToolCallRecord = {
          name: toolUse.name,
          input: toolUse.input as Record<string, unknown>,
          output: result,
        };
        toolCalls.push(record);
        if (onToolCall) onToolCall(record);

        return {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        };
      }),
    );

    logger.info(`[tool-loop] round ${round} tools done: ${Date.now() - toolStart}ms`);

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

  logger.info(`[tool-loop] reached max rounds after ${Date.now() - loopStart}ms`);
  return { responseText: '', toolCalls, reachedMaxRounds: true };
}
