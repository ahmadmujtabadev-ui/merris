/**
 * Merris Knowledge Base Seed Script
 *
 * Loads K1-K7 structured JSON data into MongoDB collections.
 * Idempotent — safe to run multiple times (upserts by unique key).
 *
 * Usage: pnpm --filter @merris/api seed:kb
 */

import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import {
  CorporateDisclosureModel,
  ClimateScienceModel,
  RegulatoryModel,
  SustainableFinanceModel,
  EnvironmentalScienceModel,
  SupplyChainModel,
  ResearchModel,
} from '../models/knowledge-base.model.js';

const KB_DATA_DIR = path.resolve(process.cwd(), '../../data/knowledge-base');

interface SeedResult {
  domain: string;
  file: string;
  total: number;
  upserted: number;
  errors: number;
}

async function seedCollection(
  model: mongoose.Model<any>,
  filePath: string,
  domain: string,
  uniqueKeys: string[]
): Promise<SeedResult> {
  const result: SeedResult = { domain, file: path.basename(filePath), total: 0, upserted: 0, errors: 0 };

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const entries = JSON.parse(raw);

    if (!Array.isArray(entries)) {
      console.error(`  [ERROR] ${domain}: expected array, got ${typeof entries}`);
      result.errors = 1;
      return result;
    }

    result.total = entries.length;

    for (const entry of entries) {
      try {
        // Build unique filter from specified keys
        const filter: Record<string, any> = {};
        for (const key of uniqueKeys) {
          if (entry[key] !== undefined) {
            filter[key] = entry[key];
          }
        }

        if (Object.keys(filter).length === 0) {
          // No unique keys found — use title + year as fallback
          filter.title = entry.title;
          filter.year = entry.year;
        }

        await model.updateOne(
          filter,
          { $set: entry },
          { upsert: true }
        );
        result.upserted++;
      } catch (err: any) {
        if (err.code === 11000) {
          // Duplicate — skip silently (already exists)
          result.upserted++;
        } else {
          console.error(`  [ERROR] ${domain} entry "${entry.title || 'unknown'}": ${err.message}`);
          result.errors++;
        }
      }
    }
  } catch (err: any) {
    console.error(`  [ERROR] Failed to read ${filePath}: ${err.message}`);
    result.errors = 1;
  }

  return result;
}

async function main() {
  console.log('============================================================');
  console.log('Merris Knowledge Base — Seed Script');
  console.log('============================================================');

  const uri = process.env['MONGODB_URI'];
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  console.log(`MongoDB URI: ${uri.replace(/\/\/.*@/, '//***@')}`);
  console.log('');

  await mongoose.connect(uri);
  console.log('[CONNECTED] MongoDB connection established');
  console.log('');

  const collections = [
    {
      domain: 'K1: Corporate Disclosures',
      file: 'k1-corporate-disclosures.json',
      model: CorporateDisclosureModel,
      uniqueKeys: ['company', 'reportYear'],
    },
    {
      domain: 'K2: Climate Science',
      file: 'k2-climate-science.json',
      model: ClimateScienceModel,
      uniqueKeys: ['source', 'subcategory', 'title'],
    },
    {
      domain: 'K3: Regulatory + Legal',
      file: 'k3-regulatory.json',
      model: RegulatoryModel,
      uniqueKeys: ['shortName', 'jurisdiction'],
    },
    {
      domain: 'K4: Sustainable Finance',
      file: 'k4-sustainable-finance.json',
      model: SustainableFinanceModel,
      uniqueKeys: ['source', 'subcategory', 'title'],
    },
    {
      domain: 'K5: Environmental Science',
      file: 'k5-environmental-science.json',
      model: EnvironmentalScienceModel,
      uniqueKeys: ['source', 'subcategory', 'title'],
    },
    {
      domain: 'K6: Supply Chain + Human Rights',
      file: 'k6-supply-chain.json',
      model: SupplyChainModel,
      uniqueKeys: ['source', 'subcategory', 'title'],
    },
    {
      domain: 'K7: Research + Thought Leadership',
      file: 'k7-research.json',
      model: ResearchModel,
      uniqueKeys: ['title', 'year'],
    },
  ];

  const results: SeedResult[] = [];

  for (const col of collections) {
    const filePath = path.join(KB_DATA_DIR, col.file);
    console.log(`--- Seeding ${col.domain} ---`);

    try {
      await fs.access(filePath);
    } catch {
      console.log(`  [SKIP] ${col.file} not found`);
      continue;
    }

    const result = await seedCollection(col.model, filePath, col.domain, col.uniqueKeys);
    results.push(result);
    console.log(`  [OK] ${result.upserted}/${result.total} entries${result.errors > 0 ? ` (${result.errors} errors)` : ''}`);
    console.log('');
  }

  // Summary
  console.log('============================================================');
  console.log('SEED COMPLETE');
  console.log('============================================================');

  let totalEntries = 0;
  let totalErrors = 0;

  for (const r of results) {
    console.log(`  ${r.domain}: ${r.upserted} entries`);
    totalEntries += r.upserted;
    totalErrors += r.errors;
  }

  console.log('------------------------------------------------------------');
  console.log(`  TOTAL: ${totalEntries} entries across ${results.length} domains`);
  if (totalErrors > 0) {
    console.log(`  ERRORS: ${totalErrors}`);
  }
  console.log('============================================================');

  await mongoose.disconnect();
  console.log('[DISCONNECTED] MongoDB connection closed');
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
