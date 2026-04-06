import mongoose from 'mongoose';

export interface DataGap {
  gap_description: string;
  domain: string;
  country_code: string;
  sector: string;
  frequency: number;
  first_seen: Date;
  last_seen: Date;
  resolved: boolean;
  resolved_date: Date | null;
}

export async function trackDataGaps(gaps: string[], context?: { country?: string; sector?: string }): Promise<void> {
  if (gaps.length === 0) return;
  const db = mongoose.connection.db;
  if (!db) return;
  const col = db.collection('kb_data_gaps');

  for (const gap of gaps) {
    // Extract domain hint from gap text
    let domain = 'unknown';
    if (gap.includes('K1') || gap.includes('catalog')) domain = 'K1';
    else if (gap.includes('K2') || gap.includes('climate') || gap.includes('emission')) domain = 'K2';
    else if (gap.includes('K3') || gap.includes('regulatory')) domain = 'K3';
    else if (gap.includes('K6') || gap.includes('labour') || gap.includes('slavery')) domain = 'K6';

    const now = new Date();
    await col.updateOne(
      { gap_description: gap.substring(0, 200), domain },
      {
        $set: { last_seen: now, country_code: context?.country || '', sector: context?.sector || '' },
        $inc: { frequency: 1 },
        $setOnInsert: { first_seen: now, resolved: false, resolved_date: null },
      },
      { upsert: true }
    );
  }
}

export async function getTopGaps(options?: { domain?: string; country?: string; limit?: number }): Promise<DataGap[]> {
  const db = mongoose.connection.db;
  if (!db) return [];
  const filter: Record<string, unknown> = { resolved: false };
  if (options?.domain) filter.domain = options.domain;
  if (options?.country) filter.country_code = options.country;

  return db.collection('kb_data_gaps')
    .find(filter)
    .sort({ frequency: -1 })
    .limit(options?.limit || 20)
    .toArray() as unknown as Promise<DataGap[]>;
}

export async function getGapStats(): Promise<{ total: number; resolved: number; unresolved: number; topCountries: unknown[]; topDomains: unknown[] }> {
  const db = mongoose.connection.db;
  if (!db) return { total: 0, resolved: 0, unresolved: 0, topCountries: [], topDomains: [] };
  const col = db.collection('kb_data_gaps');

  const total = await col.countDocuments();
  const resolved = await col.countDocuments({ resolved: true });

  const topCountries = await col.aggregate([
    { $match: { resolved: false, country_code: { $ne: '' } } },
    { $group: { _id: '$country_code', count: { $sum: 1 }, totalFreq: { $sum: '$frequency' } } },
    { $sort: { totalFreq: -1 } },
    { $limit: 10 },
  ]).toArray();

  const topDomains = await col.aggregate([
    { $match: { resolved: false } },
    { $group: { _id: '$domain', count: { $sum: 1 }, totalFreq: { $sum: '$frequency' } } },
    { $sort: { totalFreq: -1 } },
  ]).toArray();

  return { total, resolved, unresolved: total - resolved, topCountries, topDomains };
}
