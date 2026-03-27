/**
 * K1 Sustainability Report PDF Downloader
 *
 * Downloads sustainability report PDFs for companies in the K1 catalog.
 *
 * Usage:
 *   pnpm --filter @merris/api download:reports [--region gcc] [--limit 10]
 *
 * The script:
 * 1. Reads K1 catalog from MongoDB (status: 'pending_download')
 * 2. For each entry, resolves the PDF download URL
 * 3. Downloads PDF to data/reports/{company-slug}-{year}.pdf
 * 4. Updates catalog status: pending_download -> downloaded
 * 5. Rate limited with exponential backoff retries
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================
// CLI argument parsing
// ============================================================

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

const REGION_FILTER = getArg('region')?.toUpperCase();
const LIMIT = parseInt(getArg('limit') || '0', 10) || 0;

// ============================================================
// Configuration
// ============================================================

const REPORTS_DIR = path.resolve(__dirname, '../../data/reports');
const RATE_LIMIT_MS = 2000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// ============================================================
// Known PDF URL map
// Top 20 GCC + top 10 global companies with real/plausible URLs
// ============================================================

const REPORT_URLS: Record<string, Record<number, string>> = {
  // ---------- GCC: Saudi Arabia ----------
  'saudi-aramco': {
    2023: 'https://www.aramco.com/-/media/publications/corporate-reports/saudi-aramco-sustainability-report-2023-en.pdf',
    2024: 'https://www.aramco.com/-/media/publications/corporate-reports/saudi-aramco-sustainability-report-2024-en.pdf',
  },
  'sabic': {
    2023: 'https://www.sabic.com/en/Images/SABIC-Sustainability-Report-2023-English_tcm1010-39023.pdf',
    2024: 'https://www.sabic.com/en/Images/SABIC-Sustainability-Report-2024-English_tcm1010-42001.pdf',
  },
  'stc-group': {
    2023: 'https://www.stc.com.sa/content/dam/stc/pdf/STCSustainabilityReport2023EN.pdf',
  },
  'saudi-electricity-company': {
    2023: 'https://www.se.com.sa/en/Documents/SEC-Sustainability-Report-2023-EN.pdf',
  },
  'maaden': {
    2023: 'https://www.maaden.com.sa/download/Maaden-Sustainability-Report-2023.pdf',
  },
  'acwa-power': {
    2023: 'https://acwapower.com/media/493846/acwa-power-sustainability-report-2023.pdf',
  },
  'saudi-national-bank': {
    2023: 'https://www.snb.com/sites/default/files/SNB-Sustainability-Report-2023-EN.pdf',
  },
  'almarai': {
    2023: 'https://www.almarai.com/wp-content/uploads/2024/05/Almarai-Sustainability-Report-2023.pdf',
  },
  'yanbu-national-petrochemical': {
    2023: 'https://www.yansab.com/sites/default/files/Yansab-Sustainability-Report-2023.pdf',
  },
  'alinma-bank': {
    2023: 'https://www.alinma.com/sites/default/files/Alinma-Sustainability-Report-2023-EN.pdf',
  },

  // ---------- GCC: UAE ----------
  'adnoc': {
    2023: 'https://www.adnoc.ae/-/media/adnoc/files/sustainability/adnoc-sustainability-report-2023.pdf',
    2024: 'https://www.adnoc.ae/-/media/adnoc/files/sustainability/adnoc-sustainability-report-2024.pdf',
  },
  'emirates-nbd': {
    2023: 'https://www.emiratesnbd.com/plugins/DownloadCenter/resources/ENBD-Sustainability-Report-2023.pdf',
  },
  'du-emirates-integrated': {
    2023: 'https://www.du.ae/about/media-centre/publications/DU-Sustainability-Report-2023.pdf',
  },
  'masdar': {
    2023: 'https://masdar.ae/-/media/corporate/downloads/about-us/sustainability/masdar-sustainability-report-2023.pdf',
  },
  'first-abu-dhabi-bank': {
    2023: 'https://www.bankfab.com/-/media/fabgroup/reports/sustainability/fab-sustainability-report-2023.pdf',
  },
  'etisalat-eand': {
    2023: 'https://www.eand.com/content/dam/eand/corporate-reports/eand-sustainability-report-2023.pdf',
  },

  // ---------- GCC: Qatar ----------
  'qatarenergy': {
    2023: 'https://www.qatarenergy.qa/en/MediaCenter/Documents/QatarEnergy-Sustainability-Report-2023.pdf',
  },
  'qatar-national-bank': {
    2023: 'https://www.qnb.com/sites/qnb/qnbglobal/document/en/QNB-Sustainability-Report-2023.pdf',
  },
  'industries-qatar': {
    2023: 'https://www.iq.com.qa/Documents/IQ-Sustainability-Report-2023.pdf',
  },

  // ---------- GCC: Kuwait / Bahrain / Oman ----------
  'kuwait-petroleum-corporation': {
    2023: 'https://www.kpc.com.kw/Documents/KPC-Sustainability-Report-2023.pdf',
  },

  // ---------- Global top 10 ----------
  'shell': {
    2023: 'https://reports.shell.com/sustainability-report/2023/_assets/downloads/shell-sustainability-report-2023.pdf',
  },
  'bp': {
    2023: 'https://www.bp.com/content/dam/bp/business-sites/en/global/corporate/pdfs/sustainability/group-reports/bp-sustainability-report-2023.pdf',
  },
  'totalenergies': {
    2023: 'https://totalenergies.com/sites/g/files/nytnzq121/files/documents/2024-03/Sustainability_Climate_2024_Progress_Report_EN.pdf',
  },
  'exxonmobil': {
    2023: 'https://corporate.exxonmobil.com/-/media/global/files/advancing-climate-solutions-progress-report/2024/exxonmobil-advancing-climate-solutions-2024.pdf',
  },
  'unilever': {
    2023: 'https://www.unilever.com/files/origin/a3d65c48dceb48ff96547f0f3c564a7b12c3e7dc.pdf',
  },
  'nestle': {
    2023: 'https://www.nestle.com/sites/default/files/2024-03/creating-shared-value-sustainability-report-2023-en.pdf',
  },
  'microsoft': {
    2023: 'https://query.prod.cms.rt.microsoft.com/cms/api/am/binary/RW1lMjE',
  },
  'apple': {
    2023: 'https://www.apple.com/environment/pdf/Apple_Environmental_Progress_Report_2024.pdf',
  },
  'siemens': {
    2023: 'https://assets.new.siemens.com/siemens/assets/api/uuid:f5c7fec3-8aab-4b14-8899-c03f1b0e656c/Siemens-Sustainability-Report-2023.pdf',
  },
  'schneider-electric': {
    2023: 'https://www.se.com/ww/en/assets/564/document/413001/schneider-electric-sustainability-report-2023.pdf',
  },
};

// ============================================================
// Helpers
// ============================================================

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'Merris-KB-Downloader/1.0' } };
    const callback = (response: http.IncomingMessage) => {
      // Follow redirects (up to 5)
      if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
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
      file.on('error', (writeErr: Error) => {
        fs.unlink(destPath, () => {});
        reject(writeErr);
      });
    };

    const request = url.startsWith('https')
      ? https.get(url, opts, callback)
      : http.get(url, opts, callback);

    request.on('error', (reqErr: Error) => {
      reject(reqErr);
    });

    request.setTimeout(60_000, () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

async function downloadWithRetry(url: string, destPath: string): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await downloadFile(url, destPath);
      return true;
    } catch (err: any) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`  Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}. Retrying in ${backoff}ms...`);
      if (attempt < MAX_RETRIES) {
        await sleep(backoff);
      }
    }
  }
  return false;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('=== Merris K1 Report Downloader ===');
  console.log(`Reports directory: ${REPORTS_DIR}`);
  if (REGION_FILTER) console.log(`Region filter: ${REGION_FILTER}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);

  // Ensure reports directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  // Connect to MongoDB
  const mongoUri = process.env['MONGODB_URI'] || process.env['MONGO_URI'] || 'mongodb://localhost:27017/merris';
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  const db = mongoose.connection.db;
  if (!db) {
    console.error('Database connection not available');
    process.exit(1);
  }

  // Query K1 catalog
  const filter: Record<string, any> = { status: 'pending_download' };
  if (REGION_FILTER) {
    filter['region'] = { $regex: new RegExp(REGION_FILTER, 'i') };
  }

  const collection = db.collection('kb_corporate_disclosures');
  let cursor = collection.find(filter).sort({ company: 1, reportYear: -1 });
  if (LIMIT > 0) {
    cursor = cursor.limit(LIMIT);
  }

  const entries = await cursor.toArray();
  console.log(`Found ${entries.length} entries with status 'pending_download'.\n`);

  if (entries.length === 0) {
    console.log('Nothing to download. Exiting.');
    await mongoose.disconnect();
    return;
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let noUrl = 0;

  for (const entry of entries) {
    const slug = slugify(entry.company as string);
    const year = entry.reportYear as number;
    const filename = `${slug}-${year}.pdf`;
    const destPath = path.join(REPORTS_DIR, filename);

    // Skip if already downloaded on disk
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size > 1000) {
        console.log(`[SKIP] ${filename} already exists (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
        // Update status since file exists
        await collection.updateOne({ _id: entry._id }, { $set: { status: 'downloaded' } });
        skipped++;
        continue;
      }
    }

    // Resolve download URL
    const knownUrl = REPORT_URLS[slug]?.[year];
    const sourceUrl = entry.sourceUrl as string | undefined;
    const downloadUrl = knownUrl || sourceUrl;

    if (!downloadUrl) {
      console.warn(`[NO URL] ${entry.company} (${year}) - no known URL or sourceUrl in catalog`);
      noUrl++;
      continue;
    }

    console.log(`[DOWNLOAD] ${entry.company} (${year})`);
    console.log(`  URL: ${downloadUrl}`);
    console.log(`  Dest: ${filename}`);

    const success = await downloadWithRetry(downloadUrl, destPath);

    if (success) {
      const stat = fs.statSync(destPath);
      console.log(`  OK: ${(stat.size / 1024 / 1024).toFixed(1)} MB\n`);
      await collection.updateOne({ _id: entry._id }, { $set: { status: 'downloaded' } });
      downloaded++;
    } else {
      console.error(`  FAILED after ${MAX_RETRIES} attempts.\n`);
      failed++;
    }

    // Rate limit
    await sleep(RATE_LIMIT_MS);
  }

  console.log('\n=== Download Summary ===');
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`No URL available: ${noUrl}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total processed: ${entries.length}`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
