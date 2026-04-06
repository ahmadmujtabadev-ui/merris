import mongoose from 'mongoose';

const COUNTRY_COLLECTIONS = [
  { collection: 'kb_water_risk', field: 'countryCode', label: 'Water Risk (WRI Aqueduct)' },
  { collection: 'kb_climate_vulnerability', field: 'countryCode', label: 'Climate Vulnerability (ND-GAIN)' },
  { collection: 'kb_slavery_risk', field: 'countryCode', label: 'Forced Labour Risk (Walk Free)' },
  { collection: 'kb_corruption_index', field: 'countryCode', label: 'Corruption Index (TI CPI)' },
  { collection: 'kb_country_emissions', field: 'countryCode', label: 'National Emissions (EDGAR)' },
  { collection: 'kb_ndc_targets', field: 'countryCode', label: 'NDC Targets (Climate Watch)' },
  { collection: 'kb_facility_emissions', field: 'countryCode', label: 'Sector Emissions (Climate TRACE)' },
];

export interface CountryCoverage {
  countryCode: string;
  covered: string[];
  missing: string[];
  coveragePercent: number;
}

export async function ensureCountryCoverage(countryCode: string): Promise<CountryCoverage> {
  const db = mongoose.connection.db;
  if (!db) return { countryCode, covered: [], missing: COUNTRY_COLLECTIONS.map(c => c.label), coveragePercent: 0 };

  const code = countryCode.toUpperCase();
  const covered: string[] = [];
  const missing: string[] = [];

  for (const col of COUNTRY_COLLECTIONS) {
    const exists = await db.collection(col.collection).findOne({ [col.field]: code });
    if (exists) {
      covered.push(col.label);
    } else {
      missing.push(col.label);
    }
  }

  return {
    countryCode: code,
    covered,
    missing,
    coveragePercent: COUNTRY_COLLECTIONS.length > 0 ? Math.round((covered.length / COUNTRY_COLLECTIONS.length) * 100) : 0,
  };
}

export async function getAllCountryCoverage(): Promise<CountryCoverage[]> {
  const db = mongoose.connection.db;
  if (!db) return [];

  // Get all unique country codes across collections
  const allCodes = new Set<string>();
  for (const col of COUNTRY_COLLECTIONS) {
    const codes = await db.collection(col.collection).distinct(col.field);
    codes.forEach((c: string) => allCodes.add(c));
  }

  const results: CountryCoverage[] = [];
  for (const code of Array.from(allCodes).sort()) {
    results.push(await ensureCountryCoverage(code));
  }

  return results;
}
