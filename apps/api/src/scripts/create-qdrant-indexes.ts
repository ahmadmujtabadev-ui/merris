import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { getQdrantClient, COLLECTION } from '../lib/qdrant.js';

async function main() {
  const client = getQdrantClient();

  const fields = ['module', 'filename', 'fileType'];
  for (const field of fields) {
    try {
      await client.createPayloadIndex(COLLECTION, {
        field_name: field,
        field_schema: 'keyword',
      });
      console.log(`✓ Index created: ${field}`);
    } catch (err: any) {
      const msg: string = err?.data?.status?.error ?? err?.message ?? '';
      if (msg.toLowerCase().includes('already exists')) {
        console.log(`  Index already exists: ${field}`);
      } else {
        console.error(`✗ Failed to create index for ${field}:`, msg);
      }
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
