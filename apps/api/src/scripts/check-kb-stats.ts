/**
 * Quick diagnostic: chunk counts per module in kb_dense_embeddings
 * Run: pnpm --filter "@merris/api" tsx src/scripts/check-kb-stats.ts
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import mongoose from 'mongoose';
import { DenseEmbeddingModel } from '../models/dense-embedding.model.js';

async function main() {
  const uri = process.env['MONGODB_URI'];
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  const agg = await DenseEmbeddingModel.aggregate([
    {
      $group: {
        _id: '$module',
        chunks: { $sum: 1 },
        files:  { $addToSet: '$filename' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const totalChunks = agg.reduce((s, r) => s + r.chunks, 0);
  const allModules  = ['M01-regulatory','M02-frameworks','M03-emission-factors','M04-benchmarks',
                       'M05-climate','M06-carbon-markets','M07-environmental','M08-social',
                       'M09-financial','M10-sector','M11-jurisdictions','M12-templates',
                       'M13-caselaw','M14-research'];

  const indexed = new Map(agg.map(r => [r._id as string, { chunks: r.chunks as number, files: (r.files as string[]).length }]));

  console.log('='.repeat(65));
  console.log('  MODULE                   FILES    CHUNKS    STATUS');
  console.log('='.repeat(65));

  for (const mod of allModules) {
    const data = indexed.get(mod);
    if (data) {
      console.log(`  ✅ ${mod.padEnd(24)} ${String(data.files).padStart(4)}     ${String(data.chunks).padStart(6)}    INDEXED`);
    } else {
      console.log(`  ❌ ${mod.padEnd(24)}    0          0    NOT INDEXED`);
    }
  }

  console.log('='.repeat(65));
  console.log(`  TOTAL: ${totalChunks.toLocaleString()} chunks across ${agg.length} modules`);
  console.log('='.repeat(65));

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
