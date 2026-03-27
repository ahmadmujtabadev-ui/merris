import 'dotenv/config';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

import { Framework } from '../models/framework.model.js';
import { Disclosure } from '../models/disclosure.model.js';
import { EmissionFactor } from '../models/emission-factor.model.js';
import { CrossFrameworkMap } from '../models/cross-map.model.js';

// ============================================================
// Configuration
// ============================================================

const DATA_DIR = path.resolve(__dirname, '../../../../data');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/merris';

// ============================================================
// Helpers
// ============================================================

function readJSON(filePath: string): any {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function getJSONFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(dir, f));
}

// ============================================================
// Seed: Frameworks + Disclosures
// ============================================================

async function seedFrameworks(): Promise<number> {
  const files = getJSONFiles(path.join(DATA_DIR, 'frameworks'));
  let totalDisclosures = 0;

  for (const file of files) {
    const data = readJSON(file);
    const fileName = path.basename(file);

    // Upsert framework document
    await Framework.findOneAndUpdate(
      { id: data.id },
      {
        $set: {
          id: data.id,
          code: data.code,
          name: data.name,
          version: data.version,
          effectiveDate: new Date(data.effectiveDate),
          issuingBody: data.issuingBody,
          region: data.region,
          type: data.type,
          structure: data.structure,
        },
      },
      { upsert: true, new: true }
    );

    // Extract and upsert individual disclosures for cross-querying
    for (const topic of data.structure.topics) {
      for (const disclosure of topic.disclosures) {
        await Disclosure.findOneAndUpdate(
          { id: disclosure.id },
          {
            $set: {
              id: disclosure.id,
              frameworkId: data.id,
              frameworkCode: data.code,
              code: disclosure.code,
              name: disclosure.name,
              description: disclosure.description,
              topic: disclosure.topic,
              dataType: disclosure.dataType,
              requiredMetrics: disclosure.requiredMetrics || [],
              guidanceText: disclosure.guidanceText,
              sectorSpecific: disclosure.sectorSpecific || false,
              sectors: disclosure.sectors || [],
              crossReferences: disclosure.crossReferences || [],
            },
          },
          { upsert: true, new: true }
        );
        totalDisclosures++;
      }
    }

    console.log(`  [OK] ${fileName} — ${data.name}`);
  }

  return totalDisclosures;
}

// ============================================================
// Seed: Emission Factors
// ============================================================

async function seedEmissionFactors(): Promise<number> {
  const files = getJSONFiles(path.join(DATA_DIR, 'emission-factors'));
  let count = 0;

  for (const file of files) {
    const data = readJSON(file);
    const fileName = path.basename(file);

    // GCC grid factors: flat array under "factors"
    if (data.factors && Array.isArray(data.factors)) {
      for (const ef of data.factors) {
        await EmissionFactor.findOneAndUpdate(
          {
            source: ef.source,
            country: ef.country,
            year: ef.year,
            scope: ef.scope,
            fuelType: ef.fuelType || null,
            activityType: ef.activityType || null,
            category: ef.category || null,
            gridRegion: ef.gridRegion || null,
          },
          { $set: { ...ef, verified: ef.verified ?? false } },
          { upsert: true }
        );
        count++;
      }
    }

    // DEFRA structured format: nested categories
    if (data.factors && !Array.isArray(data.factors)) {
      const categories = Object.values(data.factors) as any[];
      for (const categoryFactors of categories) {
        if (!Array.isArray(categoryFactors)) continue;
        for (const ef of categoryFactors) {
          await EmissionFactor.findOneAndUpdate(
            {
              source: ef.source,
              country: ef.country,
              year: ef.year,
              scope: ef.scope,
              fuelType: ef.fuelType || null,
              activityType: ef.activityType || null,
              category: ef.category || null,
            },
            { $set: { ...ef, verified: ef.verified ?? false } },
            { upsert: true }
          );
          count++;
        }
      }
    }

    // GWP file has "gases" array — we don't load into EmissionFactor collection
    // (different structure), but log for awareness
    if (data.gases) {
      console.log(`  [INFO] ${fileName} — GWP reference data (${data.gases.length} gases). Not loaded into emission_factors collection.`);
      continue;
    }

    console.log(`  [OK] ${fileName}`);
  }

  return count;
}

// ============================================================
// Seed: Cross-Framework Maps
// ============================================================

async function seedCrossMaps(): Promise<number> {
  const files = getJSONFiles(path.join(DATA_DIR, 'cross-maps'));
  let count = 0;

  for (const file of files) {
    const data = readJSON(file);
    const fileName = path.basename(file);

    await CrossFrameworkMap.findOneAndUpdate(
      {
        sourceFramework: data.sourceFramework,
        targetFramework: data.targetFramework,
        version: data.version,
      },
      {
        $set: {
          sourceFramework: data.sourceFramework,
          targetFramework: data.targetFramework,
          version: data.version,
          lastUpdated: new Date(data.lastUpdated),
          description: data.description,
          notes: data.notes || '',
          mappings: data.mappings,
        },
      },
      { upsert: true }
    );

    count++;
    console.log(`  [OK] ${fileName} — ${data.mappings.length} mappings`);
  }

  return count;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Merris Platform — Database Seed Script');
  console.log('='.repeat(60));
  console.log(`MongoDB URI: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')}`);
  console.log();

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[CONNECTED] MongoDB connection established\n');

    // Seed frameworks
    console.log('--- Seeding Frameworks ---');
    const disclosureCount = await seedFrameworks();
    const frameworkCount = await Framework.countDocuments();
    console.log(`\n  Frameworks: ${frameworkCount}`);
    console.log(`  Disclosures: ${disclosureCount}\n`);

    // Seed emission factors
    console.log('--- Seeding Emission Factors ---');
    const efCount = await seedEmissionFactors();
    const efTotal = await EmissionFactor.countDocuments();
    console.log(`\n  Emission factors upserted: ${efCount}`);
    console.log(`  Total in collection: ${efTotal}\n`);

    // Seed cross-framework maps
    console.log('--- Seeding Cross-Framework Maps ---');
    const mapCount = await seedCrossMaps();
    const mapTotal = await CrossFrameworkMap.countDocuments();
    console.log(`\n  Cross-maps upserted: ${mapCount}`);
    console.log(`  Total in collection: ${mapTotal}\n`);

    // Summary
    console.log('='.repeat(60));
    console.log('SEED COMPLETE');
    console.log('='.repeat(60));
    console.log(`  Frameworks:       ${frameworkCount}`);
    console.log(`  Disclosures:      ${disclosureCount}`);
    console.log(`  Emission Factors: ${efTotal}`);
    console.log(`  Cross Maps:       ${mapTotal}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('[ERROR] Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n[DISCONNECTED] MongoDB connection closed');
  }
}

main();
