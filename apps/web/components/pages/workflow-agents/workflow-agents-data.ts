export interface AgentEntry {
  name: string;
  description: string;
  category: string;
  runs?: number;
  rating?: number;
  by?: string;
  shared?: number;
  iconLabel: string; // emoji shortcut for prototype parity
}

export const AGENTS_PREBUILT: AgentEntry[] = [
  { name: 'Gap Analysis',         description: 'Compare disclosure vs framework standards for compliance delta.', category: 'Compliance',     runs: 1240, rating: 4.8, iconLabel: '📊' },
  { name: 'Carbon Benchmarking',  description: 'Benchmark Scope 1 & 2 against regional peers.',                   category: 'Climate',        runs: 890,  rating: 4.6, iconLabel: '✓' },
  { name: 'Regulatory Scanner',   description: 'Monitor regulatory feeds and flag material changes against active engagements.', category: 'Monitoring', runs: 2100, rating: 4.9, iconLabel: '👁' },
  { name: 'Policy Extraction',    description: 'Extract all human rights and labor clauses from uploaded documents.', category: 'Due Diligence', runs: 670,  rating: 4.5, iconLabel: '📄' },
  { name: 'Materiality Matrix',   description: 'Synthesize stakeholder interests into a visual materiality assessment.', category: 'Reporting',  runs: 540,  rating: 4.4, iconLabel: '🎯' },
  { name: 'GRI Index Generation', description: 'Map raw disclosure data to GRI Standard compliance frameworks.',  category: 'Compliance',     runs: 1580, rating: 4.7, iconLabel: '🔢' },
  { name: 'Emissions Validation', description: 'Cross-reference Scope 1 & 2 against regional utility benchmarks.', category: 'Climate',        runs: 760,  rating: 4.5, iconLabel: '⚡' },
  { name: 'CSRD Readiness Check', description: 'Assess ESRS alignment and double materiality requirements.',     category: 'Compliance',     runs: 430,  rating: 4.3, iconLabel: '🛡️' },
];

export const AGENTS_CUSTOM: AgentEntry[] = [
  { name: 'QAPCO Scope 3 Audit',     description: 'Custom agent for QAPCO upstream transport emissions review.', category: 'Custom', by: 'Elena Vance',     shared: 3, iconLabel: '✏️' },
  { name: 'GCC Water Stress Monitor', description: 'Weekly scan of water stewardship metrics across GCC operations.', category: 'Custom', by: 'Marcus Sterling', shared: 5, iconLabel: '🌐' },
];

export const RECENTLY_RUN: Array<{ name: string; time: string; status: string; findings: number }> = [
  { name: 'Regulatory Scanner',   time: '2 hours ago', status: 'Completed', findings: 3 },
  { name: 'Gap Analysis',         time: 'Yesterday',   status: 'Completed', findings: 12 },
  { name: 'GRI Index Generation', time: '3 days ago',  status: 'Completed', findings: 0 },
];

export const AGENT_CATEGORIES = ['All', 'Compliance', 'Climate', 'Monitoring', 'Due Diligence', 'Reporting', 'Custom'] as const;
