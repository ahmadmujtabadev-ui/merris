// ============================================================
// Unit Conversion Tables
// ============================================================

interface ConversionEntry {
  factor: number;
  target: string;
}

const UNIT_CONVERSIONS: Record<string, Record<string, ConversionEntry>> = {
  // Volume conversions
  volume: {
    'ML': { factor: 1e-6, target: 'm³' },
    'ml': { factor: 1e-6, target: 'm³' },
    'mL': { factor: 1e-6, target: 'm³' },
    'milliliter': { factor: 1e-6, target: 'm³' },
    'millilitre': { factor: 1e-6, target: 'm³' },
    'L': { factor: 0.001, target: 'm³' },
    'l': { factor: 0.001, target: 'm³' },
    'liter': { factor: 0.001, target: 'm³' },
    'litre': { factor: 0.001, target: 'm³' },
    'gallon': { factor: 0.00378541, target: 'm³' },
    'gal': { factor: 0.00378541, target: 'm³' },
    'kL': { factor: 1, target: 'm³' },
    'kiloliter': { factor: 1, target: 'm³' },
    'kilolitre': { factor: 1, target: 'm³' },
    'ML_mega': { factor: 1000, target: 'm³' }, // Megaliters
    'megalitre': { factor: 1000, target: 'm³' },
    'megaliter': { factor: 1000, target: 'm³' },
    'm³': { factor: 1, target: 'm³' },
  },
  // Energy conversions
  energy: {
    'MWh': { factor: 1000, target: 'kWh' },
    'mwh': { factor: 1000, target: 'kWh' },
    'megawatt-hour': { factor: 1000, target: 'kWh' },
    'GWh': { factor: 1000000, target: 'kWh' },
    'gwh': { factor: 1000000, target: 'kWh' },
    'GJ': { factor: 277.778, target: 'kWh' },
    'gj': { factor: 277.778, target: 'kWh' },
    'gigajoule': { factor: 277.778, target: 'kWh' },
    'MJ': { factor: 0.277778, target: 'kWh' },
    'mj': { factor: 0.277778, target: 'kWh' },
    'megajoule': { factor: 0.277778, target: 'kWh' },
    'Wh': { factor: 0.001, target: 'kWh' },
    'wh': { factor: 0.001, target: 'kWh' },
    'kWh': { factor: 1, target: 'kWh' },
    'kwh': { factor: 1, target: 'kWh' },
  },
  // Mass conversions
  mass: {
    'short ton': { factor: 0.907185, target: 'metric tonnes' },
    'short tons': { factor: 0.907185, target: 'metric tonnes' },
    'ton': { factor: 0.907185, target: 'metric tonnes' },
    'tons': { factor: 0.907185, target: 'metric tonnes' },
    'long ton': { factor: 1.01605, target: 'metric tonnes' },
    'long tons': { factor: 1.01605, target: 'metric tonnes' },
    'lb': { factor: 0.000453592, target: 'metric tonnes' },
    'lbs': { factor: 0.000453592, target: 'metric tonnes' },
    'pound': { factor: 0.000453592, target: 'metric tonnes' },
    'pounds': { factor: 0.000453592, target: 'metric tonnes' },
    'kg': { factor: 0.001, target: 'metric tonnes' },
    'kilogram': { factor: 0.001, target: 'metric tonnes' },
    'kilograms': { factor: 0.001, target: 'metric tonnes' },
    't': { factor: 1, target: 'metric tonnes' },
    'tonne': { factor: 1, target: 'metric tonnes' },
    'tonnes': { factor: 1, target: 'metric tonnes' },
    'metric ton': { factor: 1, target: 'metric tonnes' },
    'metric tons': { factor: 1, target: 'metric tonnes' },
    'metric tonne': { factor: 1, target: 'metric tonnes' },
    'metric tonnes': { factor: 1, target: 'metric tonnes' },
    'tCO2e': { factor: 1, target: 'tCO2e' },
    'tCO2': { factor: 1, target: 'tCO2e' },
  },
  // Area conversions
  area: {
    'sq ft': { factor: 0.092903, target: 'm²' },
    'sqft': { factor: 0.092903, target: 'm²' },
    'acre': { factor: 4046.86, target: 'm²' },
    'acres': { factor: 4046.86, target: 'm²' },
    'hectare': { factor: 10000, target: 'm²' },
    'hectares': { factor: 10000, target: 'm²' },
    'ha': { factor: 10000, target: 'm²' },
    'm²': { factor: 1, target: 'm²' },
    'km²': { factor: 1000000, target: 'm²' },
  },
};

// Build a flat lookup for quick access
const FLAT_CONVERSIONS: Record<string, ConversionEntry> = {};
for (const category of Object.values(UNIT_CONVERSIONS)) {
  for (const [unit, entry] of Object.entries(category)) {
    FLAT_CONVERSIONS[unit] = entry;
  }
}

// ============================================================
// Unit Normalization
// ============================================================

export function normalizeUnit(
  value: number,
  fromUnit: string,
  toUnit?: string
): { value: number; unit: string } {
  const conversion = FLAT_CONVERSIONS[fromUnit];

  if (!conversion) {
    // No conversion found, return as-is
    return { value, unit: toUnit || fromUnit };
  }

  const targetUnit = toUnit || conversion.target;

  // If already in target unit
  if (fromUnit === targetUnit) {
    return { value, unit: targetUnit };
  }

  // Convert to standard unit first
  const standardValue = value * conversion.factor;

  // If the requested target is the standard, done
  if (targetUnit === conversion.target) {
    return { value: standardValue, unit: targetUnit };
  }

  // If a different target is requested, find reverse conversion
  const targetConversion = FLAT_CONVERSIONS[targetUnit];
  if (targetConversion && targetConversion.target === conversion.target) {
    // Convert from standard to target
    return { value: standardValue / targetConversion.factor, unit: targetUnit };
  }

  // Default: return standard conversion
  return { value: standardValue, unit: conversion.target };
}

// ============================================================
// Framework Mapping
// ============================================================

const METRIC_TO_FRAMEWORK: Record<string, string> = {
  // GRI Standards
  'ghg emissions scope 1': 'GRI 305-1',
  'ghg emissions scope 2': 'GRI 305-2',
  'ghg emissions scope 3': 'GRI 305-3',
  'direct ghg emissions': 'GRI 305-1',
  'indirect ghg emissions': 'GRI 305-2',
  'energy consumption': 'GRI 302-1',
  'energy intensity': 'GRI 302-3',
  'water consumption': 'GRI 303-5',
  'water withdrawal': 'GRI 303-3',
  'water discharge': 'GRI 303-4',
  'waste generated': 'GRI 306-3',
  'waste diverted': 'GRI 306-4',
  'waste directed to disposal': 'GRI 306-5',
  'employee count': 'GRI 2-7',
  'employee turnover': 'GRI 401-1',
  'new hires': 'GRI 401-1',
  'training hours': 'GRI 404-1',
  'work-related injuries': 'GRI 403-9',
  'fatalities': 'GRI 403-9',
  'lost time injury frequency rate': 'GRI 403-9',
  'ltifr': 'GRI 403-9',
  'trir': 'GRI 403-9',
  'board diversity': 'GRI 405-1',
  'gender pay gap': 'GRI 405-2',
  'tax paid': 'GRI 207-4',
  'community investment': 'GRI 413-1',
  'anti-corruption training': 'GRI 205-2',

  // SASB-aligned
  'total recordable incident rate': 'SASB-IF-EU-320a.1',
  'renewable energy': 'GRI 302-1',
  'carbon intensity': 'GRI 305-4',
  'emissions intensity': 'GRI 305-4',

  // TCFD-aligned
  'climate risk': 'TCFD-Strategy-a',
  'physical risk': 'TCFD-Strategy-a',
  'transition risk': 'TCFD-Strategy-a',
  'scenario analysis': 'TCFD-Strategy-c',
};

export function mapToFramework(metricName: string): string {
  const normalized = metricName.toLowerCase().trim();

  // Exact match
  if (METRIC_TO_FRAMEWORK[normalized]) {
    return METRIC_TO_FRAMEWORK[normalized]!;
  }

  // Partial match
  for (const [key, code] of Object.entries(METRIC_TO_FRAMEWORK)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return code;
    }
  }

  // Default: unclassified
  return 'UNCLASSIFIED';
}

// ============================================================
// Confidence Assignment
// ============================================================

export function assignConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}
