import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL    = process.env['QDRANT_URL']    ?? '';
const QDRANT_API_KEY = process.env['QDRANT_API_KEY'] ?? '';

export const COLLECTION = 'kb_dense';
export const VECTOR_SIZE = 1536;

let _client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!_client) {
    if (!QDRANT_URL) throw new Error('QDRANT_URL env var is not set');
    _client = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY || undefined });
  }
  return _client;
}

export async function ensureCollection(): Promise<void> {
  const client = getQdrantClient();
  const exists = await client.collectionExists(COLLECTION);
  if (!exists) {
    await client.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
  }
}
