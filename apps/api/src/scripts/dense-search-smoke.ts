import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../lib/db.js';
import { denseSearch } from '../modules/knowledge-base/dense-search.service.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

async function main(): Promise<void> {
  await connectDB();

  const results = await denseSearch({
    query: 'CBAM transitional period compliance obligations requirements reporting',
    modules: ['M01'],
    limit: 5,
    minScore: 0.25,
  });

  console.log(JSON.stringify({
    found: results.length,
    results: results.map((r) => ({
      module: r.module,
      filename: r.filename,
      score: r.score,
      chunkIndex: r.chunkIndex,
      excerpt: r.text.slice(0, 220),
    })),
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors in smoke test cleanup.
  }
  process.exit(1);
});
