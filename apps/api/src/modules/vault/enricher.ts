import { sendMessage } from "../../lib/claude.js";
import { logger } from "../../lib/logger.js";
import type { ChunkInput, EnrichedChunk } from "./types.js";

const BATCH_SIZE = 10;
const HAIKU_MODEL = "claude-haiku-4-5-20241022";

export async function enrichChunks(
  chunks: ChunkInput[],
  documentTitle: string
): Promise<EnrichedChunk[]> {
  const enriched: EnrichedChunk[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((chunk) => enrichSingle(chunk, documentTitle))
    );
    enriched.push(...results);
  }

  return enriched;
}

async function enrichSingle(
  chunk: ChunkInput,
  documentTitle: string
): Promise<EnrichedChunk> {
  const sectionLabel =
    chunk.sectionPath.length > 0
      ? `Section: ${chunk.sectionPath.join(" > ")}`
      : "Document root";

  const prompt = `Document: ${documentTitle}
${sectionLabel}

Generate a 1-2 sentence context describing what this chunk discusses and how it relates to the document. Do not summarise the content; situate it within the document structure. Be concise.

Chunk:
${chunk.content.slice(0, 2000)}`;

  try {
    const context = await sendMessage({
      model: HAIKU_MODEL,
      maxTokens: 150,
      system:
        "You generate brief contextual headers for document chunks to improve search retrieval. Output only the 1-2 sentence context, nothing else.",
      messages: [{ role: "user", content: prompt }],
    });

    const header = context?.trim() || "";
    return {
      ...chunk,
      contextualHeader: header,
      enrichedContent: header ? `${header}\n\n${chunk.content}` : chunk.content,
    };
  } catch (error) {
    logger.warn("Chunk enrichment failed, using raw content", error);
    return {
      ...chunk,
      contextualHeader: "",
      enrichedContent: chunk.content,
    };
  }
}
