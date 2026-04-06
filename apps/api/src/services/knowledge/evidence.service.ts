// src/services/knowledge/evidence.service.ts
//
// Wraps raw KB search results with structured citations.

export interface Evidence {
  claim: string;
  source: {
    domain: string;
    collection: string;
    entryId: string;
  };
  citation: string;
  url?: string;
  confidence: number;
  jurisdiction?: string;
  sector?: string;
  validityPeriod?: {
    from: string;
    to: string;
  };
}

export function packageEvidence(
  claim: string,
  searchResult: {
    id: string;
    domain: string;
    collection: string;
    title: string;
    source: string;
    year: number;
    score: number;
    data?: Record<string, unknown>;
  }
): Evidence {
  return {
    claim,
    source: {
      domain: searchResult.domain,
      collection: searchResult.collection,
      entryId: searchResult.id,
    },
    citation: `${searchResult.source}, ${searchResult.title}, ${searchResult.year}`,
    url: (searchResult.data as any)?.sourceUrl || undefined,
    confidence: Math.min(searchResult.score, 1.0),
    jurisdiction: (searchResult.data as any)?.jurisdiction || (searchResult.data as any)?.country || undefined,
    sector: (searchResult.data as any)?.sector || undefined,
    validityPeriod: {
      from: `${searchResult.year}-01-01`,
      to: `${searchResult.year + 1}-12-31`,
    },
  };
}

export function packageMultipleEvidence(
  claim: string,
  results: Array<{
    id: string;
    domain: string;
    collection: string;
    title: string;
    source: string;
    year: number;
    score: number;
    data?: Record<string, unknown>;
  }>
): Evidence[] {
  return results.map((r) => packageEvidence(claim, r));
}
