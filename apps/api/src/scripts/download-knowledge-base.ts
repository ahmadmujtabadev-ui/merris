/**
 * Merris Unified Knowledge Base Downloader
 *
 * Downloads ~475 files across 7 ESG domains (K1-K7).
 *
 * Phase A (K2-K7): Frameworks, standards, research, regulations
 * Phase B (K1): Corporate sustainability reports (~260 entries)
 *
 * Usage:
 *   pnpm --filter @merris/api download:kb                    # All domains, Phase A then B
 *   pnpm --filter @merris/api download:kb -- --domain k2     # Single domain
 *   pnpm --filter @merris/api download:kb -- --phase a       # Phase A only (K2-K7)
 *   pnpm --filter @merris/api download:kb -- --phase b       # Phase B only (K1)
 *   pnpm --filter @merris/api download:kb -- --limit 5       # Max 5 per domain
 *   pnpm --filter @merris/api download:kb -- --priority 1    # Only priority-1 sources
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import {
  KB_DOWNLOAD_TARGETS,
  PHASE_A_DOMAINS,
  PHASE_B_DOMAINS,
  getTargetsByDomain,
  type DownloadTarget,
} from './kb-urls.js';

// ============================================================
// CLI argument parsing
// ============================================================

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

const DOMAIN_FILTER = getArg('domain')?.toLowerCase() as DownloadTarget['domain'] | undefined;
const PHASE_FILTER = getArg('phase')?.toLowerCase() as 'a' | 'b' | undefined;
const LIMIT = parseInt(getArg('limit') || '0', 10) || 0;
const PRIORITY_FILTER = parseInt(getArg('priority') || '0', 10) || 0;

// ============================================================
// Configuration
// ============================================================

const BASE_DIR = path.resolve(__dirname, '../../data/downloads');
const RATE_LIMIT_MS = 3000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 3000;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_CONCURRENT = 2;

// ============================================================
// Helpers
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    const stat = await fsp.stat(filepath);
    return stat.size > 500; // ignore empty/corrupt stubs
  } catch {
    return false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// Download engine
// ============================================================

function downloadUrl(url: string, destPath: string, redirectCount = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error(`Too many redirects for ${url}`));
      return;
    }

    const opts = {
      headers: {
        'User-Agent': 'Merris ESG Platform (research use)',
        Accept: 'application/pdf,text/csv,application/json,text/html,*/*',
      },
    };

    const callback = (response: http.IncomingMessage) => {
      // Follow redirects
      if (
        response.statusCode &&
        [301, 302, 303, 307, 308].includes(response.statusCode) &&
        response.headers.location
      ) {
        response.resume();
        let redirectUrl = response.headers.location;
        // Handle relative redirects
        if (redirectUrl.startsWith('/')) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        downloadUrl(redirectUrl, destPath, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (!response.statusCode || response.statusCode >= 400) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', (err: Error) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };

    const request = url.startsWith('https')
      ? https.get(url, opts, callback)
      : http.get(url, opts, callback);

    request.on('error', (err: Error) => reject(err));
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

async function downloadWithRetry(
  target: DownloadTarget,
  destPath: string,
): Promise<{ success: boolean; skipped: boolean; error?: string }> {
  // Skip if already downloaded
  if (await fileExists(destPath)) {
    return { success: true, skipped: true };
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await downloadUrl(target.url, destPath);
      return { success: true, skipped: false };
    } catch (err: any) {
      const msg = err.message || String(err);
      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * attempt;
        console.warn(`    Attempt ${attempt}/${MAX_RETRIES} failed: ${msg}. Retrying in ${backoff}ms...`);
        await sleep(backoff);
      } else {
        return { success: false, skipped: false, error: msg };
      }
    }
  }

  return { success: false, skipped: false, error: 'Unknown error' };
}

// ============================================================
// Concurrency-limited pool
// ============================================================

async function downloadBatch(
  targets: DownloadTarget[],
  domainDir: string,
): Promise<{ downloaded: number; skipped: number; failed: number; errors: string[] }> {
  const results = { downloaded: 0, skipped: 0, failed: 0, errors: [] as string[] };
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < targets.length) {
      const currentIdx = idx++;
      const target = targets[currentIdx]!;
      const destPath = path.join(domainDir, target.filename);

      const result = await downloadWithRetry(target, destPath);

      if (result.skipped) {
        const stat = fs.statSync(destPath);
        console.log(`  [SKIP] ${target.filename} (${formatBytes(stat.size)} on disk)`);
        results.skipped++;
      } else if (result.success) {
        const stat = fs.statSync(destPath);
        console.log(`  [OK]   ${target.filename} (${formatBytes(stat.size)})`);
        results.downloaded++;
      } else {
        console.error(`  [FAIL] ${target.filename}: ${result.error}`);
        results.failed++;
        results.errors.push(`${target.id}: ${result.error}`);
        // Clean up partial file
        try {
          await fsp.unlink(destPath);
        } catch {
          // ignore
        }
      }

      // Rate limit between downloads
      await sleep(RATE_LIMIT_MS);
    }
  }

  // Run up to MAX_CONCURRENT workers
  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(MAX_CONCURRENT, targets.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}

// ============================================================
// MongoDB status tracking
// ============================================================

async function updateDownloadStatus(
  db: mongoose.mongo.Db,
  domain: DownloadTarget['domain'],
  targetId: string,
  status: 'downloaded' | 'failed',
  error?: string,
): Promise<void> {
  try {
    const collection = domain === 'k1'
      ? db.collection('kb_corporate_disclosures')
      : db.collection('kb_download_status');

    if (domain === 'k1') {
      // For K1, try to match by source URL or title
      // This is a best-effort link to existing catalog entries
      await collection.updateOne(
        { sourceUrl: { $exists: true }, status: 'pending_download' },
        { $set: { downloadAttempted: new Date(), downloadResult: status } },
      );
    } else {
      // For K2-K7, upsert into a tracking collection
      await collection.updateOne(
        { targetId },
        {
          $set: {
            targetId,
            domain,
            status,
            error: error || null,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
    }
  } catch {
    // Non-fatal: log and continue
  }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  console.log('============================================================');
  console.log('  Merris Unified Knowledge Base Downloader');
  console.log('============================================================');
  console.log(`  Base directory : ${BASE_DIR}`);
  console.log(`  Total targets  : ${KB_DOWNLOAD_TARGETS.length}`);
  if (DOMAIN_FILTER) console.log(`  Domain filter  : ${DOMAIN_FILTER}`);
  if (PHASE_FILTER) console.log(`  Phase filter   : ${PHASE_FILTER}`);
  if (LIMIT) console.log(`  Limit/domain   : ${LIMIT}`);
  if (PRIORITY_FILTER) console.log(`  Priority filter: <=${PRIORITY_FILTER}`);
  console.log('============================================================\n');

  // Ensure output directories
  for (const d of ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7']) {
    ensureDir(path.join(BASE_DIR, d));
  }

  // Determine which domains to process
  let domains: DownloadTarget['domain'][];

  if (DOMAIN_FILTER) {
    domains = [DOMAIN_FILTER];
  } else if (PHASE_FILTER === 'a') {
    domains = [...PHASE_A_DOMAINS];
  } else if (PHASE_FILTER === 'b') {
    domains = [...PHASE_B_DOMAINS];
  } else {
    domains = [...PHASE_A_DOMAINS, ...PHASE_B_DOMAINS];
  }

  // Connect to MongoDB (optional — script works without it)
  let db: mongoose.mongo.Db | null = null;
  const mongoUri = process.env['MONGODB_URI'] || process.env['MONGO_URI'];

  if (mongoUri) {
    try {
      console.log('Connecting to MongoDB for status tracking...');
      await mongoose.connect(mongoUri);
      db = mongoose.connection.db ?? null;
      console.log('Connected.\n');
    } catch (err: any) {
      console.warn(`MongoDB connection failed (${err.message}). Continuing without status tracking.\n`);
    }
  } else {
    console.log('No MONGODB_URI set. Skipping status tracking.\n');
  }

  // Aggregate stats
  const stats: Record<string, { downloaded: number; skipped: number; failed: number }> = {};
  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];
  const startTime = Date.now();

  for (const domain of domains) {
    let targets = getTargetsByDomain(domain);

    // Apply priority filter
    if (PRIORITY_FILTER > 0) {
      targets = targets.filter((t) => t.priority <= PRIORITY_FILTER);
    }

    // Apply limit
    if (LIMIT > 0 && targets.length > LIMIT) {
      targets = targets.slice(0, LIMIT);
    }

    const domainDir = path.join(BASE_DIR, domain);
    const domainLabel = domain.toUpperCase();

    console.log(`--- ${domainLabel}: ${targets.length} targets ---`);

    if (targets.length === 0) {
      console.log('  (no targets after filtering)\n');
      continue;
    }

    const result = await downloadBatch(targets, domainDir);

    stats[domain] = {
      downloaded: result.downloaded,
      skipped: result.skipped,
      failed: result.failed,
    };

    totalDownloaded += result.downloaded;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
    allErrors.push(...result.errors);

    // Update MongoDB status
    if (db) {
      for (const target of targets) {
        const destPath = path.join(domainDir, target.filename);
        const exists = await fileExists(destPath);
        await updateDownloadStatus(
          db,
          domain,
          target.id,
          exists ? 'downloaded' : 'failed',
          exists ? undefined : 'File not found after download',
        );
      }
    }

    console.log(
      `  Summary: ${result.downloaded} new, ${result.skipped} skipped, ${result.failed} failed\n`,
    );
  }

  // Final summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('============================================================');
  console.log('  DOWNLOAD COMPLETE');
  console.log('============================================================');

  for (const [domain, s] of Object.entries(stats)) {
    console.log(
      `  ${domain.toUpperCase()}: ${s.downloaded} new | ${s.skipped} cached | ${s.failed} failed`,
    );
  }

  console.log('------------------------------------------------------------');
  console.log(`  TOTAL: ${totalDownloaded} downloaded, ${totalSkipped} cached, ${totalFailed} failed`);
  console.log(`  TIME:  ${elapsed}s`);

  if (allErrors.length > 0) {
    console.log('\n  ERRORS:');
    for (const e of allErrors.slice(0, 20)) {
      console.log(`    - ${e}`);
    }
    if (allErrors.length > 20) {
      console.log(`    ... and ${allErrors.length - 20} more`);
    }
  }

  console.log('============================================================');

  // Disconnect MongoDB
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  // Exit with error code if everything failed
  if (totalDownloaded === 0 && totalSkipped === 0 && totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
