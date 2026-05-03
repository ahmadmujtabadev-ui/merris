import { sendMessage } from "../../../lib/claude.js";
import { logger } from "../../../lib/logger.js";
import type { IExtractedEntity } from "../vault-chunk.model.js";

const HAIKU_MODEL = "claude-haiku-4-5-20241022";

export async function extractEntities(
  text: string
): Promise<IExtractedEntity[]> {
  if (!text || text.length < 20) return [];

  try {
    const result = await sendMessage({
      model: HAIKU_MODEL,
      maxTokens: 500,
      system: `Extract named entities from the text. Return a JSON array of objects with fields: type (one of: company, person, date, metric, amount, percentage, framework, regulation, country, organization), value (exact text), normalizedValue (standardized form if applicable). Return ONLY the JSON array, no other text.`,
      messages: [
        {
          role: "user",
          content: text.slice(0, 3000),
        },
      ],
    });

    if (!result) return [];

    const cleaned = result
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const entities = JSON.parse(cleaned) as IExtractedEntity[];
    return Array.isArray(entities) ? entities.slice(0, 30) : [];
  } catch (error) {
    logger.warn("Entity extraction failed", error);
    return [];
  }
}
