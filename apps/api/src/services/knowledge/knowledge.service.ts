// src/services/knowledge/knowledge.service.ts
//
// Unified knowledge search across all 7 domains with evidence packaging.
//
// Note: semanticSearch returns SearchResult[] directly (not a paginated envelope),
// so totalCandidates is derived from the result array length.

import { semanticSearch } from '../../modules/knowledge-base/search.service.js';
import { packageEvidence, type Evidence } from './evidence.service.js';

// Re-export search
export { semanticSearch };

export interface KnowledgeSearchResult {
  results: Array<{
    id: string;
    domain: string;
    collection: string;
    title: string;
    description: string;
    score: number;
    source: string;
    year: number;
    data?: Record<string, unknown>;
    evidence: Evidence;
  }>;
  totalCandidates: number;
  searchTime: number;
}

export async function searchWithEvidence(
  query: string,
  options?: { domains?: string[]; limit?: number }
): Promise<KnowledgeSearchResult> {
  const start = Date.now();
  const raw = await semanticSearch({
    query,
    domains: options?.domains,
    limit: options?.limit || 10,
  });

  const results = raw.map((r) => ({
    ...r,
    evidence: packageEvidence(query, r),
  }));

  return {
    results,
    totalCandidates: results.length,
    searchTime: Date.now() - start,
  };
}

export async function searchRegulatory(
  jurisdiction: string,
  topic: string,
  options?: { limit?: number }
): Promise<KnowledgeSearchResult> {
  return searchWithEvidence(`${jurisdiction} ${topic} regulation requirements`, {
    domains: ['regulatory'],
    limit: options?.limit || 10,
  });
}

export async function searchScientific(
  query: string,
  options?: { limit?: number }
): Promise<KnowledgeSearchResult> {
  return searchWithEvidence(query, {
    domains: ['climate_science', 'environmental_science'],
    limit: options?.limit || 10,
  });
}

export async function searchPeer(
  sector: string,
  metric?: string,
  options?: { limit?: number }
): Promise<KnowledgeSearchResult> {
  const query = metric ? `${sector} ${metric} peer practice` : `${sector} ESG best practice`;
  return searchWithEvidence(query, {
    domains: ['corporate_disclosure'],
    limit: options?.limit || 10,
  });
}

export async function searchSupplyChain(
  query: string,
  options?: { limit?: number }
): Promise<KnowledgeSearchResult> {
  return searchWithEvidence(query, {
    domains: ['supply_chain'],
    limit: options?.limit || 10,
  });
}
