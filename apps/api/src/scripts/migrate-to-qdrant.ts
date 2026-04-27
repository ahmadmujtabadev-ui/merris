/**
 * One-time migration: MongoDB kb_dense_embeddings → Qdrant
 *
 * Run: pnpm --filter @merris/api migrate:qdrant
 *
 * Reads all existing vectors from MongoDB and upserts them to Qdrant in
 * batches of 100. No re-embedding needed — reuses stored Voyage AI vectors.
 * Takes ~2-5 minutes for 22K chunks.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { connectDB } from '../lib/db.js';
import { DenseEmbeddingModel } from '../models/dense-embedding.model.js';
import { getQdrantClient, ensureCollection, COLLECTION } from '../lib/qdrant.js';

const BATCH_SIZE = 100;

async function main() {
  await connectDB();
  await ensureCollection();

  const client = getQdrantClient();
  const total = await DenseEmbeddingModel.countDocuments();
  console.log(`\nMigrating ${total} chunks to Qdrant collection "${COLLECTION}"…\n`);

  let offset = 0;
  let migrated = 0;

  while (offset < total) {
    const batch = await DenseEmbeddingModel.find({})
      .skip(offset)
      .limit(BATCH_SIZE)
      .select('_id module filename filePath fileType chunkIndex totalChunks text vector')
      .lean();

    if (batch.length === 0) break;

    const points = batch.map((doc, i) => ({
      id: offset + i + 1,          // Qdrant needs integer or UUID
      vector: doc.vector as number[],
      payload: {
        mongoId:     doc._id.toString(),
        module:      doc.module,
        filename:    doc.filename,
        filePath:    doc.filePath,
        fileType:    doc.fileType,
        chunkIndex:  doc.chunkIndex,
        totalChunks: doc.totalChunks,
        text:        doc.text,
      },
    }));

    await client.upsert(COLLECTION, { points, wait: true });

    migrated += batch.length;
    offset   += BATCH_SIZE;

    const pct = Math.round((migrated / total) * 100);
    process.stdout.write(`\r  Progress: ${migrated}/${total} (${pct}%)`);
  }

  console.log(`\n\n✓ Done. ${migrated} vectors migrated to Qdrant.\n`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
