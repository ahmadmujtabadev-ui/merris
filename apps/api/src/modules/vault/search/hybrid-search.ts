import { vectorSearch, type VaultSearchResult } from "./vector-search.js";
import { bm25Search } from "./bm25-search.js";
import { rerank } from "./reranker.js";
import { logger } from "../../../lib/logger.js";

export interface HybridSearchOptions {
  query: string;
  workspaceId: string;
  documentIds?: string[];
  limit?: number;
  enableRerank?: boolean;
}

const RRF_K = 60;

export async function hybridSearch(
  opts: HybridSearchOptions
): Promise<VaultSearchResult[]> {
  const { query, workspaceId, documentIds, limit = 15, enableRerank = true } = opts;

  const [vectorResults, bm25Results] = await Promise.all([
    vectorSearch({ query, workspaceId, documentIds, limit: 30 }),
    bm25Search({ query, workspaceId, documentIds, limit: 30 }),
  ]);

  const fused = reciprocalRankFusion(vectorResults, bm25Results);
  const topFused = fused.slice(0, 40);

  if (!enableRerank || topFused.length === 0) {
    return topFused.slice(0, limit);
  }

  try {
    const reranked = await rerank(
      query,
      topFused.map((r) => r.content),
    );

    const rerankedResults = reranked
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .flatMap((r): VaultSearchResult[] => {
        const item = topFused[r.index];
        if (!item) return [];
        return [{ ...item, score: r.score }];
      });

    return rerankedResults;
  } catch (error) {
    logger.warn("Reranking failed — returning RRF results", error);
    return topFused.slice(0, limit);
  }
}

function reciprocalRankFusion(
  ...resultSets: VaultSearchResult[][]
): VaultSearchResult[] {
  const scoreMap = new Map<string, { result: VaultSearchResult; score: number }>();

  for (const results of resultSets) {
    for (let rank = 0; rank < results.length; rank++) {
      const r = results[rank];
      if (!r) continue;
      const rrfScore = 1 / (RRF_K + rank + 1);
      const key = r.chunkId;

      const existing = scoreMap.get(key);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(key, { result: r, score: rrfScore });
      }
    }
  }

  return [...scoreMap.values()]
    .sort((a, b) => b.score - a.score)
    .map((entry) => ({ ...entry.result, score: entry.score }));
}
