/**
 * Generate TF-IDF Embeddings for all KB entries
 *
 * Usage:
 *   pnpm --filter @merris/api generate:embeddings
 *   pnpm --filter @merris/api generate:embeddings -- --domain K2
 *   pnpm --filter @merris/api generate:embeddings -- --rebuild
 */

import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import mongoose from 'mongoose';
import { logger } from '../lib/logger.js';
import { connectDB } from '../lib/db.js';
import {
  CorporateDisclosureModel,
  ClimateScienceModel,
  RegulatoryModel,
  SustainableFinanceModel,
  EnvironmentalScienceModel,
  SupplyChainModel,
  ResearchModel,
  type ICorporateDisclosure,
  type IClimateScienceEntry,
  type IRegulatoryEntry,
  type ISustainableFinanceEntry,
  type IEnvironmentalScienceEntry,
  type ISupplyChainEntry,
  type IResearchEntry,
} from '../models/knowledge-base.model.js';
import {
  EmbeddingModel,
  type KBDomain,
  DOMAIN_COLLECTION_MAP,
} from '../models/embedding.model.js';
import { TFIDFEngine } from '../modules/knowledge-base/tfidf-engine.js';

// ============================================================
// CLI Args
// ============================================================

const args = process.argv.slice(2);
const domainFlag = args.indexOf('--domain');
const targetDomain = domainFlag >= 0 ? (args[domainFlag + 1] as KBDomain | undefined) : undefined;
const rebuild = args.includes('--rebuild');

// ============================================================
// Text Extraction per Domain
// ============================================================

function extractTextK1(doc: ICorporateDisclosure): string {
  const parts = [
    doc.company,
    doc.reportTitle,
    doc.sector,
    doc.country,
    doc.region,
    doc.reportType,
    ...(doc.tags || []),
  ].filter(Boolean);
  return parts.join(' ');
}

function extractTextK2(doc: IClimateScienceEntry): string {
  const parts = [
    doc.title,
    doc.description,
    doc.source,
    doc.category,
    doc.subcategory,
    ...(doc.tags || []),
  ];
  if (doc.data) {
    parts.push(JSON.stringify(doc.data).substring(0, 2000));
  }
  return parts.filter(Boolean).join(' ');
}

function extractTextK3(doc: IRegulatoryEntry): string {
  const parts = [
    doc.name,
    doc.shortName,
    doc.description,
    doc.jurisdiction,
    doc.category,
    ...(doc.applicableTo || []),
    ...(doc.tags || []),
  ];
  if (doc.requirements) {
    for (const req of doc.requirements) {
      parts.push(req.title);
      parts.push(req.description);
    }
  }
  if (doc.data) {
    parts.push(JSON.stringify(doc.data).substring(0, 2000));
  }
  return parts.filter(Boolean).join(' ');
}

function extractTextK4(doc: ISustainableFinanceEntry): string {
  const parts = [
    doc.title,
    doc.description,
    doc.source,
    doc.category,
    doc.subcategory,
    ...(doc.tags || []),
  ];
  if (doc.data) {
    parts.push(JSON.stringify(doc.data).substring(0, 2000));
  }
  return parts.filter(Boolean).join(' ');
}

function extractTextK5(doc: IEnvironmentalScienceEntry): string {
  const parts = [
    doc.title,
    doc.description,
    doc.source,
    doc.category,
    doc.subcategory,
    ...(doc.tags || []),
  ];
  if (doc.data) {
    parts.push(JSON.stringify(doc.data).substring(0, 2000));
  }
  return parts.filter(Boolean).join(' ');
}

function extractTextK6(doc: ISupplyChainEntry): string {
  const parts = [
    doc.title,
    doc.description,
    doc.source,
    doc.category,
    doc.subcategory,
    ...(doc.tags || []),
  ];
  if (doc.data) {
    parts.push(JSON.stringify(doc.data).substring(0, 2000));
  }
  return parts.filter(Boolean).join(' ');
}

function extractTextK7(doc: IResearchEntry): string {
  const parts = [
    doc.title,
    doc.abstract,
    doc.source,
    doc.category,
    doc.publication || '',
    ...(doc.authors || []),
    ...(doc.keyFindings || []),
    ...(doc.relevantSectors || []),
    ...(doc.tags || []),
  ];
  if (doc.data) {
    parts.push(JSON.stringify(doc.data).substring(0, 2000));
  }
  return parts.filter(Boolean).join(' ');
}

// ============================================================
// Domain Configs
// ============================================================

interface DomainConfig {
  domain: KBDomain;
  collection: string;
  model: mongoose.Model<any>;
  extractText: (doc: any) => string;
}

const DOMAIN_CONFIGS: DomainConfig[] = [
  { domain: 'K1', collection: DOMAIN_COLLECTION_MAP.K1, model: CorporateDisclosureModel, extractText: extractTextK1 },
  { domain: 'K2', collection: DOMAIN_COLLECTION_MAP.K2, model: ClimateScienceModel, extractText: extractTextK2 },
  { domain: 'K3', collection: DOMAIN_COLLECTION_MAP.K3, model: RegulatoryModel, extractText: extractTextK3 },
  { domain: 'K4', collection: DOMAIN_COLLECTION_MAP.K4, model: SustainableFinanceModel, extractText: extractTextK4 },
  { domain: 'K5', collection: DOMAIN_COLLECTION_MAP.K5, model: EnvironmentalScienceModel, extractText: extractTextK5 },
  { domain: 'K6', collection: DOMAIN_COLLECTION_MAP.K6, model: SupplyChainModel, extractText: extractTextK6 },
  { domain: 'K7', collection: DOMAIN_COLLECTION_MAP.K7, model: ResearchModel, extractText: extractTextK7 },
];

// ============================================================
// Hash helper
// ============================================================

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const startTime = Date.now();
  logger.info('=== Merris KB Embedding Generator ===');

  const db = await connectDB();
  if (!db) {
    logger.error('Cannot connect to MongoDB. Check MONGODB_URI.');
    process.exit(1);
  }

  // Determine which domains to process
  const configs = targetDomain
    ? DOMAIN_CONFIGS.filter((c) => c.domain === targetDomain)
    : DOMAIN_CONFIGS;

  if (configs.length === 0) {
    logger.error(`Unknown domain: ${targetDomain}. Valid: K1-K7`);
    process.exit(1);
  }

  // If rebuild, clear existing embeddings for targeted domains
  if (rebuild) {
    const domains = configs.map((c) => c.domain);
    logger.info(`Rebuilding: deleting existing embeddings for domains: ${domains.join(', ')}`);
    await EmbeddingModel.deleteMany({ domain: { $in: domains } });
  }

  // Step 1: Collect all texts from all targeted domains
  logger.info('Step 1: Extracting text from KB entries...');

  interface DocEntry {
    id: string;
    domain: KBDomain;
    collection: string;
    text: string;
    textHash: string;
  }

  const allEntries: DocEntry[] = [];

  for (const config of configs) {
    const docs = await config.model.find({}).lean();
    logger.info(`  ${config.domain} (${config.collection}): ${docs.length} entries`);

    for (const doc of docs) {
      const text = config.extractText(doc);
      allEntries.push({
        id: (doc._id as mongoose.Types.ObjectId).toString(),
        domain: config.domain,
        collection: config.collection,
        text,
        textHash: hashText(text),
      });
    }
  }

  logger.info(`Total entries to process: ${allEntries.length}`);

  if (allEntries.length === 0) {
    logger.warn('No KB entries found. Run seed:kb first.');
    await mongoose.disconnect();
    return;
  }

  // Step 2: Check which embeddings already exist and are up-to-date
  if (!rebuild) {
    const existingEmbeddings = await EmbeddingModel.find({
      domain: { $in: configs.map((c) => c.domain) },
    })
      .select('sourceId textHash')
      .lean();

    const existingMap = new Map(
      existingEmbeddings.map((e) => [e.sourceId.toString(), e.textHash])
    );

    const unchanged = allEntries.filter(
      (entry) => existingMap.get(entry.id) === entry.textHash
    );

    if (unchanged.length > 0) {
      logger.info(`Skipping ${unchanged.length} unchanged entries`);
    }

    // Filter to only changed/new entries
    const toProcess = allEntries.filter(
      (entry) => existingMap.get(entry.id) !== entry.textHash
    );

    if (toProcess.length === 0) {
      logger.info('All embeddings are up-to-date. Nothing to do.');
      await mongoose.disconnect();
      return;
    }

    logger.info(`Processing ${toProcess.length} new/changed entries`);
  }

  // Step 3: Build global IDF from ALL texts (including unchanged, for accurate IDF)
  logger.info('Step 2: Building global TF-IDF model...');
  const engine = new TFIDFEngine();
  const allTexts = allEntries.map((e) => e.text);
  engine.buildIDF(allTexts);
  logger.info(`  IDF built: ${engine.getVocabSize()} terms from ${engine.getDocCount()} documents`);

  // Step 4: Compute vectors and store
  logger.info('Step 3: Computing TF-IDF vectors and storing embeddings...');

  let processed = 0;
  let domainCounts: Record<string, number> = {};
  const batchSize = 50;
  const bulkOps: mongoose.AnyBulkWriteOperation<any>[] = [];

  for (const entry of allEntries) {
    const vector = engine.computeVector(entry.text);

    // Build sparse tfidf map for storage
    const tfidfVector: Record<string, number> = {};
    for (let i = 0; i < vector.terms.length; i++) {
      tfidfVector[vector.terms[i]!] = vector.weights[i]!;
    }

    bulkOps.push({
      updateOne: {
        filter: {
          sourceCollection: entry.collection,
          sourceId: new mongoose.Types.ObjectId(entry.id),
        },
        update: {
          $set: {
            domain: entry.domain,
            text: entry.text,
            textHash: entry.textHash,
            tfidfVector,
            denseTerms: vector.terms,
            denseWeights: vector.weights,
            magnitude: vector.magnitude,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    });

    processed++;
    domainCounts[entry.domain] = (domainCounts[entry.domain] || 0) + 1;

    // Execute bulk operations in batches
    if (bulkOps.length >= batchSize) {
      await EmbeddingModel.bulkWrite(bulkOps);
      bulkOps.length = 0;

      // Log progress
      const domainStr = Object.entries(domainCounts)
        .map(([d, c]) => `${d}:${c}`)
        .join(' ');
      logger.info(`  Generated ${processed}/${allEntries.length} embeddings (${domainStr})`);
    }
  }

  // Flush remaining
  if (bulkOps.length > 0) {
    await EmbeddingModel.bulkWrite(bulkOps);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const domainStr = Object.entries(domainCounts)
    .map(([d, c]) => `${d}:${c}`)
    .join(' ');

  logger.info('=== Embedding Generation Complete ===');
  logger.info(`  Total: ${processed} embeddings`);
  logger.info(`  Domains: ${domainStr}`);
  logger.info(`  Vocab size: ${engine.getVocabSize()} terms`);
  logger.info(`  Time: ${elapsed}s`);

  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error('Embedding generation failed', err);
  process.exit(1);
});
