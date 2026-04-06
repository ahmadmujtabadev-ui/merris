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
import type { ToolCall } from '@merris/shared';

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

export interface Citation {
  id: string;
  title: string;
  source: string;
  year: number;
  url?: string;
  domain: string;
  entryId: string;
  excerpt: string;
  verified: boolean;
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
// Citation Extraction
// ============================================================

const TOOL_CITATION_MAP: Record<string, { title: string; source: string; year: number; url: string; domain: string; verified: boolean }> = {
  'get_water_stress': { title: 'WRI Aqueduct 4.0 Water Risk Atlas', source: 'World Resources Institute', year: 2023, url: 'https://www.wri.org/data/aqueduct-global-maps-40-data', domain: 'K5', verified: true },
  'get_climate_vulnerability': { title: 'ND-GAIN Country Index', source: 'Notre Dame Global Adaptation Initiative', year: 2023, url: 'https://gain.nd.edu/our-work/country-index/', domain: 'K2', verified: true },
  'get_forced_labour_risk': { title: 'Global Slavery Index 2023', source: 'Walk Free Foundation', year: 2023, url: 'https://www.walkfree.org/global-slavery-index/', domain: 'K6', verified: true },
  'get_sbti_status': { title: 'SBTi Companies Taking Action', source: 'Science Based Targets initiative', year: 2024, url: 'https://sciencebasedtargets.org/companies-taking-action', domain: 'K1', verified: true },
  'get_emission_factor': { title: 'IEA Emission Factors 2023', source: 'International Energy Agency', year: 2023, url: 'https://www.iea.org/data-and-statistics', domain: 'K2', verified: true },
  'get_product_labour_risk': { title: 'List of Goods Produced by Child Labor or Forced Labor', source: 'US Department of Labor, ILAB', year: 2024, url: 'https://www.dol.gov/agencies/ilab/reports/child-labor/list-of-goods', domain: 'K6', verified: true },
  'get_emission_factor_live': { title: 'Climatiq Emission Factor Database', source: 'Climatiq', year: 2024, url: 'https://www.climatiq.io/', domain: 'K2', verified: true },
  'get_threatened_species': { title: 'IUCN Red List of Threatened Species', source: 'International Union for Conservation of Nature', year: 2024, url: 'https://www.iucnredlist.org/', domain: 'K5', verified: true },
  'get_species_near': { title: 'GBIF Species Occurrences', source: 'Global Biodiversity Information Facility', year: 2024, url: 'https://www.gbif.org/', domain: 'K5', verified: true },
  'calculate': { title: 'GHG Protocol Calculation Methodology', source: 'GHG Protocol / WRI / WBCSD', year: 2024, url: 'https://ghgprotocol.org/', domain: 'K2', verified: true },
  'get_precedent': { title: 'Merris Precedent Case Library', source: 'Merris ESG Intelligence', year: 2024, url: '', domain: 'K3', verified: true },
  'get_anomaly_check': { title: 'Sector Benchmark Reference Data', source: 'worldsteel/IEA/GCCA/IOGP', year: 2024, url: '', domain: 'K2', verified: true },
  'get_partner_insight': { title: 'Merris Partner Intelligence', source: 'Domain expertise', year: 2024, url: '', domain: 'advisory', verified: true },
};

function extractCitations(toolCalls: ToolCall[]): { citations: Citation[]; references: string[]; data_gaps: string[] } {
  const citations: Citation[] = [];
  const references: string[] = [];
  const data_gaps: string[] = [];
  let citationCounter = 1;

  const evidenceTools = [
    'search_knowledge', 'get_regulatory_context', 'get_scientific_basis',
    'benchmark_metric', 'retrieve_best_disclosure', 'retrieve_similar_companies',
  ];

  for (const call of toolCalls) {
    if (!evidenceTools.includes(call.name)) continue;

    const output = call.output;
    if (!output) continue;

    try {
      const data = typeof output === 'string' ? JSON.parse(output) : output;
      const items: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : (data as Record<string, unknown>).results
          ? (data as Record<string, unknown>).results as Record<string, unknown>[]
          : (data as Record<string, unknown>).peers
            ? (data as Record<string, unknown>).peers as Record<string, unknown>[]
            : [data as Record<string, unknown>];

      if (items.length === 0) {
        data_gaps.push(`No results from ${call.name} for: ${JSON.stringify(call.input).substring(0, 100)}`);
        continue;
      }

      for (const item of items.slice(0, 5)) {
        const title = (item.title as string) || (item.reportTitle as string) || (item.name as string) || '';
        const source = (item.source as string) || (item.company as string) || '';
        const year = (item.year as number) || (item.reportYear as number) || (item.latestReportYear as number) || 0;
        const url = (item.sourceUrl as string) || ((item.data as any)?.sourceUrl as string) || undefined;
        const domain = (item.domain as string) || (item.collection as string) || '';
        const entryId = (item.id as string) || (item._id as string) || '';
        const description = (item.description as string) || (item.abstract as string) || '';
        const ingested = item.ingested as boolean;

        // RULE 1: Only cite entries that have actual content
        if (!title || !source) continue;

        // If ingested field exists and is false, skip — it's a catalog stub
        if (ingested === false) {
          data_gaps.push(`${title} (${source}, ${year}) exists in catalog but has not been ingested — not cited`);
          continue;
        }

        citations.push({
          id: `cite-${citationCounter++}`,
          title,
          source,
          year,
          url,
          domain,
          entryId,
          excerpt: description.substring(0, 200),
          verified: ingested === true,
        });
      }
    } catch {
      // Non-JSON output, skip
    }
  }

  // Generate citations from tools with known authoritative sources
  for (const call of toolCalls) {
    const template = TOOL_CITATION_MAP[call.name];
    if (!template) continue;

    const output = call.output;
    if (!output) continue;

    try {
      const data = typeof output === 'string' ? JSON.parse(output) : output;
      // Skip error/empty responses
      if ((data as any).error || (data as any).available === false || (data as any).found === false) continue;

      // Build excerpt from returned data
      let excerpt = '';
      const d = data as Record<string, unknown>;
      if (call.name === 'get_water_stress') {
        excerpt = `${d.country}: water stress score ${d.waterStressScore}/5, ${d.label}`;
      } else if (call.name === 'get_climate_vulnerability') {
        excerpt = `${d.country}: ND-GAIN score ${d.ndGainScore}, vulnerability ${d.vulnerabilityScore}, readiness ${d.readinessScore}, rank ${d.ranking}`;
      } else if (call.name === 'get_forced_labour_risk') {
        excerpt = `${d.country}: ${d.prevalencePer1000} per 1,000 prevalence, ${d.estimatedVictims} estimated victims`;
      } else if (call.name === 'get_sbti_status') {
        const companies = (d.companies as any[]) || [];
        excerpt = companies.map((c: any) => `${c.companyName}: ${c.targetStatus}`).join('; ');
      } else if (call.name === 'get_emission_factor') {
        const factors = (d.factors as any[]) || [];
        if (factors.length > 0) {
          excerpt = `${factors[0].country || ''}: ${factors[0].factor} ${factors[0].unit || 'kgCO2e/kWh'} (${factors[0].source || 'IEA'} ${factors[0].year || ''})`;
        } else if (d.factor) {
          excerpt = `${d.country || ''}: ${d.factor} ${d.unit || ''} (${d.source || 'IEA'})`;
        }
      } else if (call.name === 'get_product_labour_risk') {
        const goods = (d.goods as any[]) || [];
        excerpt = goods.slice(0, 3).map((g: any) => `${g.good} (${g.country}): ${g.exploitationType}`).join('; ');
      } else if (call.name === 'calculate') {
        excerpt = `Calculation: ${(d as any).method || ''} = ${(d as any).result || ''} ${(d as any).unit || ''}`;
      } else {
        excerpt = JSON.stringify(d).substring(0, 150);
      }

      if (!excerpt) continue;

      citations.push({
        id: `cite-${citationCounter++}`,
        title: template.title,
        source: template.source,
        year: template.year,
        url: template.url,
        domain: template.domain,
        entryId: call.name,
        excerpt,
        verified: template.verified,
      });
    } catch {
      // skip
    }
  }

  return { citations, references, data_gaps };
}

function determineConfidence(
  citations: Citation[],
  toolCalls: ToolCall[]
): 'high' | 'medium' | 'low' {
  if (citations.length >= 3) return 'high';
  if (citations.length >= 1 || toolCalls.length >= 2) return 'medium';
  return 'low';
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
