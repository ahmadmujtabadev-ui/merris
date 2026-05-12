/**
 * Dense Vector Search Service — Qdrant backend
 *
 * Embeds the query with Voyage AI, then runs HNSW search on Qdrant.
 * Eliminates the 134MB cold-start load and O(n) brute-force cosine that
 * caused 15-20 s latency. Typical latency: embed 200ms + search 20ms = ~220ms.
 */

import { logger } from '../../lib/logger.js';
import { DenseEmbeddingModel } from '../../models/dense-embedding.model.js';
import { embedQuery } from '../../services/voyage.service.js';
import { getQdrantClient, COLLECTION } from '../../lib/qdrant.js';

// ============================================================
// Types
// ============================================================

export interface DenseSearchResult {
  id: string;
  module: string;
  filename: string;
  filePath: string;
  fileType: string;
  chunkIndex: number;
  totalChunks: number;
  text: string;
  score: number;
}

export interface DenseSearchOptions {
  query: string;
  modules?: string[];
  limit?: number;
  minScore?: number;
}

function matchesModuleFilter(moduleName: string, filters: string[]): boolean {
  return filters.some((f) =>
    moduleName === f || moduleName.startsWith(`${f}-`) || moduleName.startsWith(`${f}_`)
  );
}

// ============================================================
// Dense semantic search via Qdrant HNSW
// ============================================================

export async function denseSearch(options: DenseSearchOptions): Promise<DenseSearchResult[]> {
  const { query, modules, limit = 10, minScore = 0.3 } = options;

  const apiKey = process.env['VOYAGE_API_KEY'] ?? '';
  if (!apiKey) {
    logger.warn('[dense-search] VOYAGE_API_KEY not set — skipping dense search');
    return [];
  }

  // Embed the query (Voyage AI — ~200ms)
  let queryVector: number[];
  try {
    queryVector = await embedQuery(query, apiKey);
  } catch (err) {
    logger.error('[dense-search] Failed to embed query', err);
    return [];
  }

  // Qdrant pre-filter is intentionally NOT applied for module filtering.
  // Reason: document modules are stored with full names (e.g. "M04-benchmarks")
  // but the tool API accepts short codes ("M04"). Qdrant exact-match would
  // return 0 results for every module-scoped query. Instead we fetch a larger
  // probe set from Qdrant and apply the prefix-aware JS post-filter below.
  // When a module filter is requested, we fetch 4× more to compensate for the
  // lack of Qdrant-level pre-filtering.
  const probeLimit = modules && modules.length > 0
    ? Math.min(limit * 4, 80)
    : Math.max(limit, 10);

  let hits: Array<{ id: string | number; score: number; payload?: Record<string, unknown> | null }>;
  try {
    const client = getQdrantClient();
    hits = await client.search(COLLECTION, {
      vector: queryVector,
      limit: probeLimit,
      with_payload: true,
    });
  } catch (err) {
    logger.error('[dense-search] Qdrant search failed — falling back to empty', err);
    return [];
  }

  // Log raw Qdrant scores so we can see what the threshold is cutting off
  const rawScores = hits.map((h) => {
    const filename = (h.payload?.['filename'] as string | undefined) ?? 'unknown';
    const module   = (h.payload?.['module']   as string | undefined) ?? '?';
    return `${module}/${filename} → ${h.score.toFixed(4)}`;
  });
  logger.info(
    `[dense-search] query="${query}" modules=${JSON.stringify(modules ?? 'all')} minScore=${minScore} ` +
    `probeLimit=${probeLimit} rawHits=${hits.length}\n` +
    rawScores.map((s, i) => `  [${i + 1}] ${s}`).join('\n'),
  );

  // Apply minScore filter in JS (not in Qdrant) so raw scores are always visible above
  hits = hits.filter((h) => h.score >= minScore);
  logger.info(`[dense-search] after minScore(${minScore}) filter: ${hits.length} hits remaining`);

  if (hits.length === 0) return [];

  // If payload has all needed fields return immediately (avoids Mongo fetch)
  const results: DenseSearchResult[] = hits
    .filter((h) => h.payload && h.payload['mongoId'])
    .map((h) => {
      const p = h.payload as Record<string, unknown>;
      return {
        id:          String(p['mongoId']),
        module:      String(p['module'] ?? ''),
        filename:    String(p['filename'] ?? ''),
        filePath:    String(p['filePath'] ?? ''),
        fileType:    String(p['fileType'] ?? ''),
        chunkIndex:  Number(p['chunkIndex'] ?? 0),
        totalChunks: Number(p['totalChunks'] ?? 0),
        text:        String(p['text'] ?? ''),
        score:       Math.round(h.score * 1000) / 1000,
      };
    });

  // Apply module post-filter (Qdrant 'should' is OR; we need startsWith logic)
  const filtered = modules && modules.length > 0
    ? results.filter((r) => matchesModuleFilter(r.module, modules))
    : results;

  return filtered.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ============================================================
// Count / stats (unchanged — still reads from Mongo)
// ============================================================

export async function getDenseEmbeddingCount(): Promise<number> {
  return DenseEmbeddingModel.countDocuments();
}

export async function getDenseEmbeddingStats(): Promise<Record<string, number>> {
  const agg = await DenseEmbeddingModel.aggregate([
    { $group: { _id: '$module', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const result: Record<string, number> = {};
  for (const row of agg) result[row._id as string] = row.count as number;
  return result;
}

// No-op kept for API compatibility
export function invalidateDenseCache(): void {}
