export const FRAMEWORK_OPTIONS = [
  'GRI', 'TCFD', 'ISSB', 'CSRD', 'EU TAX', 'QSE', 'ICMA', 'SASB',
] as const;

export type FrameworkCode = (typeof FRAMEWORK_OPTIONS)[number];

// Hardcoded findings shown on engagement detail (matches prototype FINDS)
export const PLACEHOLDER_FINDINGS = [
  { id: 'p1', severity: 'CRITICAL' as const, ref: 'GRI 305-1', title: 'Mismatched Direct Emissions', description: 'Scope 1 (14,200t) ≠ facility sum (15,840t).' },
  { id: 'p2', severity: 'IMPORTANT' as const, ref: 'G2.1',     title: 'Vague Board Oversight',       description: 'Missing Climate Risk Subcommittee.' },
  { id: 'p3', severity: 'MINOR' as const,     ref: 'Format',   title: 'Missing Appendix Link',       description: 'App-D reference broken.' },
];

// Hardcoded framework percentages shown on engagement detail
export const PLACEHOLDER_FRAMEWORK_COMPLIANCE = [
  { code: 'GRI', percent: 45 },
  { code: 'TCFD', percent: 20 },
  { code: 'QSE', percent: 60 },
  { code: 'ISSB', percent: 0 },
];

// Hardcoded team
export const PLACEHOLDER_TEAM = [
  { id: 't1', name: 'Marcus Sterling', role: 'Lead', online: true },
  { id: 't2', name: 'Elena Vance', role: 'Auditor', online: true },
  { id: 't3', name: 'David Chen', role: 'Analyst', online: false },
];
