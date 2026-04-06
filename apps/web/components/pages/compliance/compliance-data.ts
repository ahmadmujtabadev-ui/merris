export interface FrameworkSummary {
  code: string;
  percent: number;
}

export const FRAMEWORK_SUMMARIES: FrameworkSummary[] = [
  { code: 'GRI 2024', percent: 72 },
  { code: 'TCFD',     percent: 58 },
  { code: 'ISSB',     percent: 31 },
  { code: 'EU Tax',   percent: 44 },
];

export interface DisclosureRow {
  requirement: string;
  framework: string;
  status: 'Complete' | 'Partial' | 'Gap' | 'Not Started' | 'In Progress';
  coverage: string; // e.g. '65%'
}

export const DISCLOSURE_MATRIX: DisclosureRow[] = [
  { requirement: 'Scope 1 & 2 GHG',      framework: 'GRI 305',   status: 'Partial',     coverage: '65%' },
  { requirement: 'Climate Risk',         framework: 'TCFD',      status: 'Complete',    coverage: '100%' },
  { requirement: 'Board Oversight',      framework: 'ISSB',      status: 'Gap',         coverage: '20%' },
  { requirement: 'Taxonomy Revenue',     framework: 'EU Tax',    status: 'Not Started', coverage: '0%' },
  { requirement: 'Water',                framework: 'GRI 303',   status: 'Partial',     coverage: '45%' },
  { requirement: 'Supply Chain DD',      framework: 'CSRD',      status: 'In Progress', coverage: '55%' },
];
