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

  // Build optional module filter for Qdrant
  const qdrantFilter = modules && modules.length > 0
    ? {
        should: modules.map((m) => ({
          key: 'module',
          match: { value: m },
        })),
      }
    : undefined;

  // HNSW search on Qdrant (~10-50ms for 22K vectors)
  let hits: Array<{ id: string | number; score: number; payload?: Record<string, unknown> | null }>;
  try {
    const client = getQdrantClient();
    hits = await client.search(COLLECTION, {
      vector: queryVector,
      limit,
      score_threshold: minScore,
      with_payload: true,
      ...(qdrantFilter ? { filter: qdrantFilter } : {}),
    });
  } catch (err) {
    logger.error('[dense-search] Qdrant search failed — falling back to empty', err);
    return [];
  }

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
