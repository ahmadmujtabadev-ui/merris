import { QdrantClient } from '@qdrant/js-client-rest';

export const COLLECTION = 'kb_dense';
export const VECTOR_SIZE = 1536;

let _client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!_client) {
    // Read lazily so dotenv.config() in caller scripts runs first
    const url    = process.env['QDRANT_URL']    ?? '';
    const apiKey = process.env['QDRANT_API_KEY'] ?? '';
    if (!url) throw new Error('QDRANT_URL env var is not set');
    _client = new QdrantClient({ url, apiKey: apiKey || undefined });
  }
  return _client;
}

export async function ensureCollection(): Promise<void> {
  const client = getQdrantClient();

  // Create collection (no-op if it already exists)
  try {
    await client.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
    console.log(`Created Qdrant collection "${COLLECTION}"`);
  } catch (err: any) {
    const msg: string = err?.data?.status?.error ?? err?.message ?? '';
    if (!msg.toLowerCase().includes('already exists')) throw err;
  }

  // Create payload index for `module` field so filtered searches work.
  // Qdrant requires a keyword index to filter by string payload fields.
  try {
    await client.createPayloadIndex(COLLECTION, {
      field_name: 'module',
      field_schema: 'keyword',
    });
    console.log(`Created payload index on "${COLLECTION}.module"`);
  } catch (err: any) {
    const msg: string = err?.data?.status?.error ?? err?.message ?? '';
    if (!msg.toLowerCase().includes('already exists')) throw err;
    // Index already exists — continue
  }
}
