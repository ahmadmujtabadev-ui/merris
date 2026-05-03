import { logger } from "../../../lib/logger.js";

const VOYAGE_RERANK_URL = "https://api.voyageai.com/v1/reranking";
const VOYAGE_RERANK_MODEL = "rerank-2";

export interface RerankResult {
  index: number;
  score: number;
}

export async function rerank(
  query: string,
  documents: string[]
): Promise<RerankResult[]> {
  const apiKey = process.env["VOYAGE_API_KEY"];
  if (!apiKey) {
    logger.warn("VOYAGE_API_KEY not set — skipping reranking");
    return documents.map((_, i) => ({ index: i, score: 1 - i * 0.01 }));
  }

  if (documents.length === 0) return [];

  const truncated = documents.map((d) => d.slice(0, 4000));

  const res = await fetch(VOYAGE_RERANK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      documents: truncated,
      model: VOYAGE_RERANK_MODEL,
      top_k: Math.min(documents.length, 20),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Voyage Rerank API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    data: Array<{ index: number; relevance_score: number }>;
  };

  return data.data.map((d) => ({
    index: d.index,
    score: d.relevance_score,
  }));
}
