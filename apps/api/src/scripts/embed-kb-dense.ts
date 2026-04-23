/**
 * Voyage AI Dense Embedding Pipeline — M01-M14 KB Folders
 *
 * Reads all files from your local KB directory (M01-M14 sub-folders),
 * uses .txt sidecars for PDFs and parses XLSX / JSON / DOCX in-process,
 * chunks the text, calls Voyage AI
 * for dense 1024-dim vectors, and stores them in kb_dense_embeddings.
 *
 * Usage:
 *   pnpm --filter "@merris/api" embed:kb-dense -- \
 *     --dir "C:/path/to/KB-root" \
 *     [--modules M01,M02,M03] \
 *     [--rebuild] \
 *     [--dry-run] \
 *     [--batch 32]
 *
 * Flags:
 *   --dir       Root folder that contains M01, M02, … sub-folders (required)
 *   --modules   Comma-separated list of modules to process (default: all)
 *   --rebuild   Delete existing embeddings for selected modules before running
 *   --dry-run   Parse and chunk only — no Voyage API calls, no DB writes
 *   --batch     Texts per Voyage API call (default 32, max 128)
 */

import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import dotenv from 'dotenv';
// pnpm sets cwd to apps/api/ — resolve to repo root
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { embedBatch, VOYAGE_MODEL_NAME } from '../services/voyage.service.js';
import { DenseEmbeddingModel } from '../models/dense-embedding.model.js';
import { parseDocx, parseExcel } from '../modules/ingestion/ingestion.parsers.js';

// ============================================================
// CLI Args
// ============================================================

function getArg(flag: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const kbRootDir  = getArg('--dir');
const modulesArg = getArg('--modules');
const batchSize  = parseInt(getArg('--batch', '32') ?? '32', 10);
const rebuild    = process.argv.includes('--rebuild');
const dryRun     = process.argv.includes('--dry-run');

if (!kbRootDir) {
  console.error('Usage: embed:kb-dense -- --dir <KB-root-path> [--modules M01,M02] [--rebuild] [--dry-run] [--batch 32]');
  process.exit(1);
}

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY ?? '';
if (!VOYAGE_API_KEY && !dryRun) {
  console.error('VOYAGE_API_KEY is not set in .env');
  process.exit(1);
}

// ============================================================
// Chunking
// ============================================================

const CHUNK_SIZE    = 2500;  // ~600 tokens
const CHUNK_OVERLAP = 200;   // ~50 tokens overlap for context continuity

/**
 * Split text into overlapping chunks.
 * Prefers splitting on paragraph breaks (double newline) or sentence ends.
 */
function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned.length <= CHUNK_SIZE) return cleaned.length > 20 ? [cleaned] : [];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + CHUNK_SIZE, cleaned.length);

    // Prefer to split at paragraph break
    if (end < cleaned.length) {
      const paraBreak = cleaned.lastIndexOf('\n\n', end);
      if (paraBreak > start + CHUNK_SIZE * 0.5) {
        end = paraBreak + 2;
      } else {
        // Fall back to sentence end
        const sentEnd = cleaned.lastIndexOf('. ', end);
        if (sentEnd > start + CHUNK_SIZE * 0.5) {
          end = sentEnd + 2;
        }
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 20) chunks.push(chunk);

    if (end >= cleaned.length) break;

    // Always move forward; otherwise the last window can repeat forever.
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

// ============================================================
// Text extraction — subprocess-free to avoid pdfjs-dist OOMs
// ============================================================

function stringifyJsonValue(value: unknown): string {
  if (typeof value === 'string') return value;
  const serialized = JSON.stringify(value);
  return serialized ?? String(value);
}

async function extractJsonText(filePath: string): Promise<string> {
  const raw = await fs.readFile(filePath, 'utf8');

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) =>
          typeof item === 'object' && item !== null
            ? Object.entries(item as Record<string, unknown>)
                .map(([key, value]) => `${key}: ${stringifyJsonValue(value)}`)
                .join('\n')
            : String(item)
        )
        .join('\n\n');
    }

    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed as Record<string, unknown>)
        .map(([key, value]) => `${key}: ${stringifyJsonValue(value)}`)
        .join('\n');
    }
  } catch {
    // Fall back to the raw file if the JSON is invalid.
  }

  return raw;
}

async function extractText(filePath: string, ext: string): Promise<string> {
  // Prefer a pre-extracted .txt sidecar (produced by extract-kb-text.py)
  // This avoids pdfjs-dist entirely and is always faster when present.
  const txtPath = filePath.replace(/\.[^/.]+$/, '.txt');
  try {
    const txt = await fs.readFile(txtPath, 'utf8');
    if (txt && txt.trim().length > 20) {
      return txt;
    }
  } catch {
    // No .txt sidecar — fall through to in-process extraction
  }

  if (ext === 'pdf') {
    logger.warn(`  Skipping PDF without .txt sidecar: ${path.basename(filePath)}`);
    return '';
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await fs.readFile(filePath);
    const parsed = await parseExcel(buffer, 'xlsx');
    return parsed.text;
  }

  if (ext === 'csv') {
    const buffer = await fs.readFile(filePath);
    const parsed = await parseExcel(buffer, 'csv');
    return parsed.text;
  }

  if (ext === 'docx') {
    const buffer = await fs.readFile(filePath);
    const parsed = await parseDocx(buffer);
    return parsed.text;
  }

  if (ext === 'json') {
    return extractJsonText(filePath);
  }

  if (ext === 'txt' || ext === 'md') {
    return fs.readFile(filePath, 'utf8');
  }

  throw new Error(`Unsupported file type for text extraction: ${ext}`);
}

// ============================================================
// File discovery
// ============================================================

const SUPPORTED_EXTENSIONS = new Set(['pdf', 'xlsx', 'xls', 'csv', 'docx', 'json', 'txt', 'md']);

interface KBFile {
  module: string;
  filename: string;
  filePath: string;
  ext: string;
  relPath: string; // relative to kbRootDir — used as stable ID
}

async function discoverFiles(kbRoot: string, modules: string[]): Promise<KBFile[]> {
  const files: KBFile[] = [];
  const moduleFilter = modules.length > 0 ? new Set(modules) : null;

  let entries: string[];
  try {
    entries = await fs.readdir(kbRoot);
  } catch {
    logger.error(`Cannot read KB root directory: ${kbRoot}`);
    process.exit(1);
  }

  // Find module folders — skip utility folders starting with _ or .
  // moduleFilter entries like "M01" match folders like "M01-regulatory" (prefix match)
  const moduleFolders = entries.filter((e) => {
    if (e.startsWith('_') || e.startsWith('.')) return false;
    if (moduleFilter) {
      return [...moduleFilter].some((m) => e === m || e.startsWith(m + '-') || e.startsWith(m + '_'));
    }
    return true;
  });

  for (const moduleFolder of moduleFolders) {
    const modulePath = path.join(kbRoot, moduleFolder);
    const stat = await fs.stat(modulePath).catch(() => null);
    if (!stat?.isDirectory()) continue;

    // Walk the module folder recursively
    const fileEntries = await walkDir(modulePath);

    // Build a set of base paths (without extension) that have a non-txt source file,
    // so we can skip .txt sidecar files that were generated by the Python extractor.
    const sourceBasePaths = new Set<string>();
    const SOURCE_EXTS = new Set(['pdf', 'xlsx', 'xls', 'csv', 'docx', 'json']);
    for (const fp of fileEntries) {
      const ext = fp.split('.').pop()?.toLowerCase() ?? '';
      if (SOURCE_EXTS.has(ext)) {
        sourceBasePaths.add(fp.replace(/\.[^/.]+$/, ''));
      }
    }

    for (const fp of fileEntries) {
      const ext = fp.split('.').pop()?.toLowerCase() ?? '';
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

      // Skip .txt/.md files that are Python-extracted sidecars (source file exists alongside)
      if ((ext === 'txt' || ext === 'md') && sourceBasePaths.has(fp.replace(/\.[^/.]+$/, ''))) {
        continue;
      }

      const relPath = path.relative(kbRoot, fp).replace(/\\/g, '/');
      files.push({
        module: moduleFolder,
        filename: path.basename(fp),
        filePath: fp,
        ext,
        relPath,
      });
    }
  }

  return files;
}

async function walkDir(dir: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkDir(fullPath);
      result.push(...nested);
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

// ============================================================
// Hash helper
// ============================================================

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
}

// ============================================================
// Sleep helper for rate limiting
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const startTime = Date.now();

  logger.info('=== Merris Dense Embedding Pipeline (Voyage AI) ===');
  logger.info(`KB root        : ${kbRootDir}`);
  logger.info(`Voyage model   : ${VOYAGE_MODEL_NAME}`);
  logger.info(`Batch size     : ${batchSize}`);
  logger.info(`Rebuild        : ${rebuild}`);
  logger.info(`Dry run        : ${dryRun}`);

  // Parse --modules flag
  const moduleFilter = modulesArg
    ? modulesArg.split(',').map((m) => m.trim()).filter(Boolean)
    : [];

  if (moduleFilter.length > 0) {
    logger.info(`Modules filter : ${moduleFilter.join(', ')}`);
  }

  // Connect to MongoDB
  if (!dryRun) {
    const db = await connectDB();
    if (!db) {
      logger.error('Cannot connect to MongoDB. Check MONGODB_URI in .env');
      process.exit(1);
    }
  }

  // Rebuild: clear existing embeddings for selected modules
  if (rebuild && !dryRun) {
    const filter = moduleFilter.length > 0 ? { module: { $in: moduleFilter } } : {};
    const deleted = await DenseEmbeddingModel.deleteMany(filter);
    logger.info(`Rebuild: deleted ${deleted.deletedCount} existing dense embeddings`);
  }

  // Load existing filePath+chunkIndex keys for dedup (skip already-done chunks)
  const existingKeys = new Set<string>();
  if (!rebuild && !dryRun) {
    const existing = await DenseEmbeddingModel.find(
      moduleFilter.length > 0 ? { module: { $in: moduleFilter } } : {}
    )
      .select('filePath chunkIndex')
      .lean();
    for (const e of existing) {
      existingKeys.add(`${e.filePath}::${e.chunkIndex}`);
    }
    if (existingKeys.size > 0) {
      logger.info(`Found ${existingKeys.size} already-embedded chunks — will skip them`);
    }
  }

  // Discover files
  logger.info('\nDiscovering files…');
  const files = await discoverFiles(kbRootDir!, moduleFilter);
  logger.info(`Found ${files.length} files across ${new Set(files.map((f) => f.module)).size} module(s)`);

  if (files.length === 0) {
    logger.warn('No supported files found. Check --dir path and sub-folder structure.');
    await mongoose.disconnect();
    return;
  }

  // Summary by module
  const byModule = new Map<string, number>();
  for (const f of files) byModule.set(f.module, (byModule.get(f.module) ?? 0) + 1);
  for (const [mod, count] of byModule.entries()) {
    logger.info(`  ${mod}: ${count} file(s)`);
  }

  // Process files: extract text → chunk → batch embed → store
  let totalChunks    = 0;
  let skippedChunks  = 0;
  let embeddedChunks = 0;
  let failedFiles    = 0;
  let totalTokens    = 0;

  // We'll accumulate chunks across files and flush in batches
  interface PendingChunk {
    file: KBFile;
    chunkIndex: number;
    totalChunks: number;
    text: string;
    textHash: string;
  }

  const pending: PendingChunk[] = [];

  async function flushPending(): Promise<void> {
    if (pending.length === 0) return;

    const texts = pending.map((p) => p.text);
    let vectors: number[][] = [];

    if (!dryRun) {
      const result = await embedBatch(texts, VOYAGE_API_KEY, 'document');
      vectors = result.vectors;
      totalTokens += result.tokensUsed;
    } else {
      // Dry run: fake vectors
      vectors = texts.map(() => new Array(1024).fill(0) as number[]);
    }

    if (!dryRun) {
      const bulkOps = pending.map((p, i) => ({
        updateOne: {
          filter: { filePath: p.file.relPath, chunkIndex: p.chunkIndex },
          update: {
            $set: {
              module:      p.file.module,
              filename:    p.file.filename,
              filePath:    p.file.relPath,
              fileType:    p.file.ext,
              chunkIndex:  p.chunkIndex,
              totalChunks: p.totalChunks,
              text:        p.text,
              textHash:    p.textHash,
              vector:      vectors[i]!,
              embeddingModel: VOYAGE_MODEL_NAME,
              updatedAt:   new Date(),
            },
          },
          upsert: true,
        },
      }));

      await DenseEmbeddingModel.bulkWrite(bulkOps);
    }

    embeddedChunks += pending.length;
    pending.length = 0;

    // Polite rate-limit pause (Voyage allows ~300 req/min on paid tier)
    await sleep(200);
  }

  logger.info('\nProcessing files…\n');
  let fileIndex = 0;

  for (const file of files) {
    fileIndex++;
    const prefix = `[${fileIndex}/${files.length}] ${file.module}/${file.filename}`;

    let rawText: string;
    try {
      rawText = await extractText(file.filePath, file.ext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`${prefix} — parse FAILED: ${msg}`);
      failedFiles++;
      continue;
    }

    if (!rawText || rawText.trim().length < 20) {
      logger.warn(`${prefix} — skipped (empty or too short after parse)`);
      continue;
    }

    const chunks = chunkText(rawText);
    // Free the large text string before processing chunks
    (rawText as unknown) = null;
    if (chunks.length === 0) {
      logger.warn(`${prefix} — skipped (no usable chunks)`);
      continue;
    }

    totalChunks += chunks.length;
    logger.info(`${prefix} — ${chunks.length} chunk(s)`);

    for (let i = 0; i < chunks.length; i++) {
      const key = `${file.relPath}::${i}`;
      if (existingKeys.has(key)) {
        skippedChunks++;
        continue;
      }

      pending.push({
        file,
        chunkIndex:  i,
        totalChunks: chunks.length,
        text:        chunks[i]!,
        textHash:    hashText(chunks[i]!),
      });

      // Flush when batch is full
      if (pending.length >= batchSize) {
        await flushPending();
        const pct = Math.round((embeddedChunks / Math.max(totalChunks - skippedChunks, 1)) * 100);
        logger.info(`  Progress: ${embeddedChunks} embedded, ${skippedChunks} skipped (${pct}%)`);
      }
    }
  }

  // Flush remaining
  await flushPending();

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const estimatedCostUSD = (totalTokens / 1_000_000) * 0.12;

  logger.info('\n=== Done ===');
  logger.info(`Files processed  : ${fileIndex} (${failedFiles} failed)`);
  logger.info(`Total chunks     : ${totalChunks}`);
  logger.info(`Embedded         : ${embeddedChunks}`);
  logger.info(`Skipped (exist.) : ${skippedChunks}`);
  logger.info(`Voyage tokens    : ${totalTokens.toLocaleString()}`);
  logger.info(`Est. cost (USD)  : $${estimatedCostUSD.toFixed(4)}`);
  logger.info(`Total time       : ${elapsed}s`);

  if (!dryRun) {
    await mongoose.disconnect();
  }

  process.exit(failedFiles > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error('Dense embedding pipeline failed', err);
  process.exit(1);
});
