/**
 * Load Local KB Documents into MongoDB
 *
 * Reads all PDFs from a local folder and ingests them into the
 * knowledge base (kb_knowledge_reports + auto-embedding).
 *
 * Usage:
 *   pnpm --filter "@merris/api" tsx src/scripts/load-local-kb.ts \
 *     --dir "C:/Users/You/Documents/kb-docs" \
 *     --sector "Petrochemicals" \
 *     --country "Qatar"
 *
 * Optional per-file metadata can be placed in a sidecar JSON file:
 *   C:/path/to/docs/metadata.json
 *   [
 *     { "filename": "qapco-2024.pdf", "company": "QAPCO", "reportYear": 2024, "sector": "Petrochemicals", "country": "Qatar" },
 *     ...
 *   ]
 *
 * Any PDF not listed in metadata.json will use the CLI defaults for
 * sector/country and will derive company + year from the filename.
 */

import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
// pnpm sets cwd to apps/api/ — go up 2 levels to reach repo root where .env lives
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { connectDB } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { ingestReport } from '../modules/knowledge-base/knowledge-base.service.js';
import mongoose from 'mongoose';

// ============================================================
// CLI Argument Parsing
// ============================================================

function getArg(flag: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const docsDir    = getArg('--dir');
const defaultSector  = getArg('--sector',  'ESG');
const defaultCountry = getArg('--country', 'Global');
const dryRun     = process.argv.includes('--dry-run');

if (!docsDir) {
  console.error('Usage: load-local-kb.ts --dir <path> [--sector <s>] [--country <c>] [--dry-run]');
  process.exit(1);
}

// ============================================================
// Metadata sidecar types
// ============================================================

interface DocMeta {
  filename: string;
  company: string;
  reportYear: number;
  sector: string;
  country: string;
}

// ============================================================
// Derive company + year from filename
// e.g. "qapco-sustainability-2024.pdf" → { company: "qapco", year: 2024 }
// ============================================================

function deriveMetaFromFilename(filename: string): { company: string; reportYear: number } {
  const base = path.basename(filename, '.pdf').replace(/[-_]/g, ' ');
  const yearMatch = base.match(/\b(20\d{2})\b/);
  const reportYear = yearMatch ? parseInt(yearMatch[1] ?? '0', 10) : new Date().getFullYear();
  // company = first word(s) before the year (or whole name if no year)
  const company = base.replace(/\b20\d{2}\b.*/, '').trim() || base;
  return { company, reportYear };
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  logger.info('=== Merris Local KB Loader ===');
  logger.info(`Source folder : ${docsDir}`);
  logger.info(`Default sector: ${defaultSector}`);
  logger.info(`Default country: ${defaultCountry}`);
  if (dryRun) logger.info('DRY RUN — no data will be written');

  // Connect to MongoDB
  const db = await connectDB();
  if (!db) {
    logger.error('Cannot connect to MongoDB. Check MONGODB_URI in .env');
    process.exit(1);
  }

  // Read folder
  let files: string[];
  try {
    const entries = await fs.readdir(docsDir!);
    files = entries.filter((f) => f.toLowerCase().endsWith('.pdf'));
  } catch (err) {
    logger.error(`Cannot read directory: ${docsDir}`, err);
    process.exit(1);
  }

  if (files.length === 0) {
    logger.warn('No PDF files found in the specified folder.');
    await mongoose.disconnect();
    return;
  }

  logger.info(`Found ${files.length} PDF file(s)`);

  // Load optional sidecar metadata
  let sidecarMap: Map<string, DocMeta> = new Map();
  const sidecarPath = path.join(docsDir!, 'metadata.json');
  try {
    const raw = await fs.readFile(sidecarPath, 'utf8');
    const entries: DocMeta[] = JSON.parse(raw);
    for (const e of entries) sidecarMap.set(e.filename, e);
    logger.info(`Loaded ${sidecarMap.size} metadata entries from metadata.json`);
  } catch {
    logger.info('No metadata.json found — deriving metadata from filenames');
  }

  // Process each file
  let success = 0;
  let failed  = 0;

  let i = 0;
  for (const filename of files) {
    const filePath = path.join(docsDir!, filename);

    // Resolve metadata
    const sidecar = sidecarMap.get(filename);
    const derived  = deriveMetaFromFilename(filename);
    const meta = {
      company   : sidecar?.company    ?? derived.company,
      reportYear: sidecar?.reportYear ?? derived.reportYear,
      sector    : sidecar?.sector     ?? defaultSector!,
      country   : sidecar?.country    ?? defaultCountry!,
    };

    logger.info(`[${i + 1}/${files.length}] ${filename}`);
    logger.info(`  → company=${meta.company}, year=${meta.reportYear}, sector=${meta.sector}, country=${meta.country}`);

    if (dryRun) {
      success++;
      continue;
    }

    try {
      const buffer = await fs.readFile(filePath);
      const result = await ingestReport(buffer, meta);
      logger.info(
        `  ✓ ingested — reportId=${result.reportId}, ` +
        `metrics=${result.metricsCount}, narratives=${result.narrativesCount}, ` +
        `quality=${result.quality.overallScore}, time=${result.processingTime}s`
      );
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`  ✗ FAILED: ${msg}`);
      failed++;
    }
    i++;
  }

  logger.info('=== Done ===');
  logger.info(`Success: ${success}  Failed: ${failed}  Total: ${files.length}`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error('Unhandled error', err);
  process.exit(1);
});
