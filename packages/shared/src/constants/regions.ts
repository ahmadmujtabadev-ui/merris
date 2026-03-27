export const GCC_COUNTRIES = [
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'OM', name: 'Oman' },
] as const;

export const MAJOR_REGIONS = [
  'GCC',
  'MENA',
  'Europe',
  'North America',
  'Asia Pacific',
  'Latin America',
  'Sub-Saharan Africa',
  'Global',
] as const;

export type GCCCountryCode = (typeof GCC_COUNTRIES)[number]['code'];
export type MajorRegion = (typeof MAJOR_REGIONS)[number];
