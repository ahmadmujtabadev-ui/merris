/**
 * Dense Vector Search Service
 *
 * Loads Voyage AI vectors from kb_dense_embeddings into memory and
 * runs cosine similarity for semantic search across M01-M14 KB documents.
 *
 * Cache TTL: 10 minutes. Invalidate on new embeddings via invalidateDenseCache().
 */

import { logger } from '../../lib/logger.js';
import { DenseEmbeddingModel } from '../../models/dense-embedding.model.js';
import { embedQuery, cosine } from '../../services/voyage.service.js';

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

interface CachedChunk {
  id: string;
  module: string;
  filename: string;
  filePath: string;
  fileType: string;
  chunkIndex: number;
  totalChunks: number;
  text: string;
  vector: number[];
}

function matchesModuleFilter(moduleName: string, filters: string[]): boolean {
  return filters.some((filter) =>
    moduleName === filter ||
    moduleName.startsWith(`${filter}-`) ||
    moduleName.startsWith(`${filter}_`)
  );
}

// ============================================================
// In-memory cache
// ============================================================

let cachedChunks: CachedChunk[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function loadChunks(): Promise<CachedChunk[]> {
  const now = Date.now();
  if (cachedChunks && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedChunks;
  }

  logger.info('[dense-search] Loading dense vectors into memory cache…');
  const start = Date.now();

  const docs = await DenseEmbeddingModel.find({})
    .select('module filename filePath fileType chunkIndex totalChunks text vector')
    .lean();

  cachedChunks = docs.map((d) => ({
    id:          d._id.toString(),
    module:      d.module,
    filename:    d.filename,
    filePath:    d.filePath,
    fileType:    d.fileType,
    chunkIndex:  d.chunkIndex,
    totalChunks: d.totalChunks,
    text:        d.text,
    vector:      d.vector,
  }));

  cacheTimestamp = now;
  logger.info(`[dense-search] Loaded ${cachedChunks.length} chunks in ${Date.now() - start}ms`);
  return cachedChunks;
}

export function invalidateDenseCache(): void {
  cachedChunks = null;
  cacheTimestamp = 0;
}

// ============================================================
// Dense semantic search
// ============================================================

export async function denseSearch(options: DenseSearchOptions): Promise<DenseSearchResult[]> {
  const { query, modules, limit = 10, minScore = 0.3 } = options;

  const apiKey = process.env.VOYAGE_API_KEY ?? '';
  if (!apiKey) {
    logger.warn('[dense-search] VOYAGE_API_KEY not set — skipping dense search');
    return [];
  }

  const allChunks = await loadChunks();
  if (allChunks.length === 0) {
    logger.warn('[dense-search] No dense embeddings in DB. Run embed:kb-dense first.');
    return [];
  }

  // Embed the query
  let queryVector: number[];
  try {
    queryVector = await embedQuery(query, apiKey);
  } catch (err) {
    logger.error('[dense-search] Failed to embed query', err);
    return [];
  }

  // Filter by module if specified
  const candidates = modules && modules.length > 0
    ? allChunks.filter((c) => matchesModuleFilter(c.module, modules))
    : allChunks;

  // Cosine similarity scoring
  const scored = candidates
    .map((chunk) => ({
      chunk,
      score: cosine(queryVector, chunk.vector),
    }))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ chunk, score }) => ({
    id:          chunk.id,
    module:      chunk.module,
    filename:    chunk.filename,
    filePath:    chunk.filePath,
    fileType:    chunk.fileType,
    chunkIndex:  chunk.chunkIndex,
    totalChunks: chunk.totalChunks,
    text:        chunk.text,
    score:       Math.round(score * 1000) / 1000,
  }));
}

/**
 * Count total dense embeddings in DB (used for health/status checks).
 */
export async function getDenseEmbeddingCount(): Promise<number> {
  return DenseEmbeddingModel.countDocuments();
}

/**
 * Count per module.
 */
export async function getDenseEmbeddingStats(): Promise<Record<string, number>> {
  const agg = await DenseEmbeddingModel.aggregate([
    { $group: { _id: '$module', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const result: Record<string, number> = {};
  for (const row of agg) {
    result[row._id as string] = row.count as number;
  }
  return result;
}
