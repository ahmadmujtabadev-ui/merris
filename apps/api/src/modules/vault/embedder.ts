import { embedBatch, VOYAGE_MODEL_NAME } from "../../services/voyage.service.js";
import { logger } from "../../lib/logger.js";
import type { EnrichedChunk, EmbeddedChunk } from "./types.js";

const MAX_BATCH = 128;

export async function embedChunks(
  chunks: EnrichedChunk[]
): Promise<EmbeddedChunk[]> {
  const apiKey = process.env["VOYAGE_API_KEY"];
  if (!apiKey) {
    logger.warn("VOYAGE_API_KEY not set — skipping vault embedding");
    return chunks.map((c) => ({
      ...c,
      vector: [],
      embeddingModel: VOYAGE_MODEL_NAME,
    }));
  }

  const embedded: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i += MAX_BATCH) {
    const batch = chunks.slice(i, i + MAX_BATCH);
    const texts = batch.map((c) => c.enrichedContent);

    try {
      const { vectors } = await embedBatch(texts, apiKey, "document");

      for (let j = 0; j < batch.length; j++) {
        embedded.push({
          ...batch[j],
          vector: vectors[j] || [],
          embeddingModel: VOYAGE_MODEL_NAME,
        });
      }
    } catch (error) {
      logger.error(
        `Vault embedding batch failed (offset ${i}, size ${batch.length})`,
        error
      );
      for (const chunk of batch) {
        embedded.push({
          ...chunk,
          vector: [],
          embeddingModel: VOYAGE_MODEL_NAME,
        });
      }
    }
  }

  return embedded;
}
