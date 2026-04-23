/**
 * Voyage AI Embedding Service
 *
 * Wraps the Voyage AI REST API for dense vector embeddings.
 * Model: voyage-large-2 — 1024-dim vectors, optimised for retrieval.
 */

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-large-2';

// ============================================================
// Types
// ============================================================

interface VoyageResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

// ============================================================
// Core embedding call
// ============================================================

/**
 * Embed a batch of texts. Max 128 texts per call (Voyage API limit).
 * Returns vectors in the same order as the input array.
 */
export async function embedBatch(
  texts: string[],
  apiKey: string,
  inputType: 'document' | 'query' = 'document'
): Promise<{ vectors: number[][]; tokensUsed: number }> {
  if (texts.length === 0) return { vectors: [], tokensUsed: 0 };
  if (texts.length > 128) {
    throw new Error('embedBatch: max 128 texts per call');
  }

  const body = JSON.stringify({
    input: texts,
    model: VOYAGE_MODEL,
    input_type: inputType,
  });

  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Voyage AI API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as VoyageResponse;

  // Sort by index to guarantee order matches input
  const sorted = [...data.data].sort((a, b) => a.index - b.index);
  const vectors = sorted.map((d) => d.embedding);

  return { vectors, tokensUsed: data.usage?.total_tokens ?? 0 };
}

/**
 * Embed a single query string (uses input_type: 'query' for better retrieval).
 */
export async function embedQuery(query: string, apiKey: string): Promise<number[]> {
  const { vectors } = await embedBatch([query], apiKey, 'query');
  const v = vectors[0];
  if (!v) throw new Error('Voyage AI returned no vector for query');
  return v;
}

/**
 * Cosine similarity between two equal-length vectors.
 */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export const VOYAGE_MODEL_NAME = VOYAGE_MODEL;
