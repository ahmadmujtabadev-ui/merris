import mongoose from 'mongoose';

export interface ResponseMetric {
  date: string;
  total_responses: number;
  total_score: number;
  pass_count: number;
  fix_count: number;
  reject_count: number;
  hard_block_count: number;
}

export async function trackResponseMetric(
  score: number,
  decision: 'PASS' | 'FIX' | 'REJECT',
  hardBlocked: boolean
): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const today = new Date().toISOString().split('T')[0];

  await db.collection('assistant_metrics').updateOne(
    { date: today },
    {
      $inc: {
        total_responses: 1,
        total_score: score,
        pass_count: decision === 'PASS' ? 1 : 0,
        fix_count: decision === 'FIX' ? 1 : 0,
        reject_count: decision === 'REJECT' ? 1 : 0,
        hard_block_count: hardBlocked ? 1 : 0,
      },
      $setOnInsert: { date: today },
    },
    { upsert: true }
  );
}

export async function getDailyMetrics(days?: number): Promise<any[]> {
  const db = mongoose.connection.db;
  if (!db) return [];

  return db.collection('assistant_metrics')
    .find({})
    .sort({ date: -1 })
    .limit(days || 30)
    .toArray();
}
