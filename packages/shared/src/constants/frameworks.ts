export const FRAMEWORK_CODES = [
  'GRI',
  'ESRS',
  'ISSB',
  'SASB',
  'TCFD',
  'CDP',
  'SAUDI_EXCHANGE',
  'ADX',
  'QSE',
] as const;

export type FrameworkCode = (typeof FRAMEWORK_CODES)[number];

export const FRAMEWORK_NAMES: Record<FrameworkCode, string> = {
  GRI: 'Global Reporting Initiative',
  ESRS: 'European Sustainability Reporting Standards',
  ISSB: 'International Sustainability Standards Board',
  SASB: 'Sustainability Accounting Standards Board',
  TCFD: 'Task Force on Climate-related Financial Disclosures',
  CDP: 'Carbon Disclosure Project',
  SAUDI_EXCHANGE: 'Saudi Exchange ESG Disclosure Guidelines',
  ADX: 'Abu Dhabi Securities Exchange ESG Guide',
  QSE: 'Qatar Stock Exchange ESG Reporting',
} as const;
