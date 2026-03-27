export const GICS_SECTORS = [
  { code: '10', name: 'Energy' },
  { code: '15', name: 'Materials' },
  { code: '20', name: 'Industrials' },
  { code: '25', name: 'Consumer Discretionary' },
  { code: '30', name: 'Consumer Staples' },
  { code: '35', name: 'Health Care' },
  { code: '40', name: 'Financials' },
  { code: '45', name: 'Information Technology' },
  { code: '50', name: 'Communication Services' },
  { code: '55', name: 'Utilities' },
  { code: '60', name: 'Real Estate' },
] as const;

export type GICSSectorCode = (typeof GICS_SECTORS)[number]['code'];
