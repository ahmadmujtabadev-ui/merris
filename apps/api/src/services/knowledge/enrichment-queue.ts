import mongoose from 'mongoose';

export interface EnrichmentTask {
  type: 'country' | 'company' | 'sector' | 'regulation';
  target: string;
  domain: string;
  priority: 'high' | 'medium' | 'low';
  source_apis: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created: Date;
  completed: Date | null;
}

export async function createEnrichmentTask(task: Omit<EnrichmentTask, 'status' | 'created' | 'completed'>): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  await db.collection('kb_enrichment_queue').updateOne(
    { type: task.type, target: task.target, domain: task.domain, status: { $in: ['pending', 'in_progress'] } },
    {
      $setOnInsert: {
        ...task,
        status: 'pending',
        created: new Date(),
        completed: null,
      },
    },
    { upsert: true }
  );
}

export async function getPendingTasks(limit?: number): Promise<EnrichmentTask[]> {
  const db = mongoose.connection.db;
  if (!db) return [];

  return db.collection('kb_enrichment_queue')
    .find({ status: 'pending' })
    .sort({ priority: 1, created: 1 })
    .limit(limit || 20)
    .toArray() as unknown as Promise<EnrichmentTask[]>;
}

export async function getQueueStats(): Promise<{ pending: number; in_progress: number; completed: number; failed: number }> {
  const db = mongoose.connection.db;
  if (!db) return { pending: 0, in_progress: 0, completed: 0, failed: 0 };
  const col = db.collection('kb_enrichment_queue');

  return {
    pending: await col.countDocuments({ status: 'pending' }),
    in_progress: await col.countDocuments({ status: 'in_progress' }),
    completed: await col.countDocuments({ status: 'completed' }),
    failed: await col.countDocuments({ status: 'failed' }),
  };
}
