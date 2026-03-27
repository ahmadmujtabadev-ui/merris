/**
 * Semantic Search Service
 *
 * Provides TF-IDF-based semantic search across all 7 KB domains.
 * Caches embeddings and the IDF model in memory for fast search (<100ms).
 */

import { logger } from '../../lib/logger.js';
import {
  EmbeddingModel,
  type IEmbedding,
  type KBDomain,
  DOMAIN_COLLECTION_MAP,
} from '../../models/embedding.model.js';
import {
  CorporateDisclosureModel,
  ClimateScienceModel,
  RegulatoryModel,
  SustainableFinanceModel,
  EnvironmentalScienceModel,
  SupplyChainModel,
  ResearchModel,
} from '../../models/knowledge-base.model.js';
import { TFIDFEngine, type SparseVector } from './tfidf-engine.js';
import mongoose from 'mongoose';

// ============================================================
// Types
// ============================================================

export interface SearchResult {
  id: string;
  domain: string;
  collection: string;
  title: string;
  description: string;
  score: number;
  source: string;
  year: number;
  data?: Record<string, unknown>;
}

export interface SearchOptions {
  query: string;
  domains?: string[];
  limit?: number;
  minScore?: number;
}

interface CachedEmbedding {
  id: string;
  sourceId: string;
  domain: KBDomain;
  sourceCollection: string;
  terms: string[];
  weights: number[];
  magnitude: number;
}

// ============================================================
// Singleton Cache
// ============================================================

let cachedEngine: TFIDFEngine | null = null;
let cachedEmbeddings: CachedEmbedding[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================
// Model map for fetching source entries
// ============================================================

function getModelForCollection(collection: string): mongoose.Model<any> | null {
  const map: Record<string, mongoose.Model<any>> = {
    kb_corporate_disclosures: CorporateDisclosureModel,
    kb_climate_science: ClimateScienceModel,
    kb_regulatory: RegulatoryModel,
    kb_sustainable_finance: SustainableFinanceModel,
    kb_environmental_science: EnvironmentalScienceModel,
    kb_supply_chain: SupplyChainModel,
    kb_research: ResearchModel,
  };
  return map[collection] ?? null;
}

// ============================================================
// Load engine and embeddings from database
// ============================================================

async function loadEngineAndEmbeddings(): Promise<{
  engine: TFIDFEngine;
  embeddings: CachedEmbedding[];
}> {
  const now = Date.now();

  // Return cache if fresh
  if (cachedEngine && cachedEmbeddings && now - cacheTimestamp < CACHE_TTL_MS) {
    return { engine: cachedEngine, embeddings: cachedEmbeddings };
  }

  logger.info('Loading TF-IDF engine and embeddings into memory...');
  const startTime = Date.now();

  // Load all embeddings
  const embeddings = await EmbeddingModel.find({})
    .select('sourceId domain sourceCollection denseTerms denseWeights magnitude')
    .lean();

  if (embeddings.length === 0) {
    logger.warn('No embeddings found. Run generate:embeddings first.');
    const engine = new TFIDFEngine();
    engine.buildIDF([]);
    return { engine, embeddings: [] };
  }

  // Build the engine from the stored text (we rebuild IDF from embeddings' text)
  // For search, we only need the engine's tokenizer and IDF. We rebuild IDF from all embeddings.
  // Load full texts for IDF building
  const fullEmbeddings = await EmbeddingModel.find({}).select('text').lean();
  const texts = fullEmbeddings.map((e) => e.text);

  const engine = new TFIDFEngine();
  engine.buildIDF(texts);

  // Cache the dense vectors
  const cached: CachedEmbedding[] = embeddings.map((e) => ({
    id: (e._id as mongoose.Types.ObjectId).toString(),
    sourceId: e.sourceId.toString(),
    domain: e.domain,
    sourceCollection: e.sourceCollection,
    terms: e.denseTerms,
    weights: e.denseWeights,
    magnitude: e.magnitude,
  }));

  cachedEngine = engine;
  cachedEmbeddings = cached;
  cacheTimestamp = now;

  const elapsed = Date.now() - startTime;
  logger.info(`Loaded ${cached.length} embeddings in ${elapsed}ms (vocab: ${engine.getVocabSize()} terms)`);

  return { engine, embeddings: cached };
}

// ============================================================
// Semantic Search
// ============================================================

export async function semanticSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query, domains, limit = 10, minScore = 0.1 } = options;

  const { engine, embeddings } = await loadEngineAndEmbeddings();

  if (embeddings.length === 0) {
    return [];
  }

  // Filter by domain if specified
  let candidates = embeddings;
  if (domains && domains.length > 0) {
    const domainSet = new Set(domains);
    candidates = embeddings.filter((e) => domainSet.has(e.domain));
  }

  // Run TF-IDF search
  const searchCandidates = candidates.map((c) => ({
    terms: c.terms,
    weights: c.weights,
    magnitude: c.magnitude,
    id: c.id,
  }));

  const scored = engine.search(query, searchCandidates, limit, minScore);

  if (scored.length === 0) {
    return [];
  }

  // Build a lookup for scored items
  const scoreMap = new Map(scored.map((s) => [s.id, s.score]));
  const matchedEmbeddings = candidates.filter((c) => scoreMap.has(c.id));

  // Fetch source documents for matched embeddings
  const results: SearchResult[] = [];

  // Group by collection for efficient batch queries
  const byCollection = new Map<string, Array<{ embeddingId: string; sourceId: string; score: number }>>();
  for (const emb of matchedEmbeddings) {
    const score = scoreMap.get(emb.id)!;
    if (!byCollection.has(emb.sourceCollection)) {
      byCollection.set(emb.sourceCollection, []);
    }
    byCollection.get(emb.sourceCollection)!.push({
      embeddingId: emb.id,
      sourceId: emb.sourceId,
      score,
    });
  }

  for (const [collection, items] of byCollection) {
    const model = getModelForCollection(collection);
    if (!model) continue;

    const sourceIds = items.map((i) => new mongoose.Types.ObjectId(i.sourceId));
    const docs = await model.find({ _id: { $in: sourceIds } }).lean();

    const docMap = new Map(docs.map((d: any) => [d._id.toString(), d]));

    for (const item of items) {
      const doc = docMap.get(item.sourceId) as Record<string, any> | undefined;
      if (!doc) continue;

      const domain = candidates.find((c) => c.id === item.embeddingId)?.domain || 'K1';

      results.push({
        id: doc['_id'].toString(),
        domain,
        collection,
        title: doc['title'] || doc['reportTitle'] || doc['name'] || doc['company'] || 'Untitled',
        description: doc['description'] || doc['abstract'] || '',
        score: Math.round(item.score * 1000) / 1000,
        source: doc['source'] || doc['jurisdiction'] || doc['company'] || '',
        year: doc['year'] || doc['reportYear'] || 0,
        data: doc,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

// ============================================================
// Cache Invalidation
// ============================================================

export function invalidateSearchCache(): void {
  cachedEngine = null;
  cachedEmbeddings = null;
  cacheTimestamp = 0;
  logger.info('Search cache invalidated');
}
