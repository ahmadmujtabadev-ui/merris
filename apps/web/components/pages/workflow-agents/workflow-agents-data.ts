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
  { name: 'Gap Analysis',         description: 'Compare disclosure vs framework standards for compliance delta.', category: 'Compliance',     iconLabel: '📊' },
  { name: 'Carbon Benchmarking',  description: 'Benchmark Scope 1 & 2 against regional peers.',                   category: 'Climate',        iconLabel: '✓' },
  { name: 'Regulatory Scanner',   description: 'Monitor regulatory feeds and flag material changes against active engagements.', category: 'Monitoring', iconLabel: '👁' },
  { name: 'Policy Extraction',    description: 'Extract all human rights and labor clauses from uploaded documents.', category: 'Due Diligence', iconLabel: '📄' },
  { name: 'Materiality Matrix',   description: 'Synthesize stakeholder interests into a visual materiality assessment.', category: 'Reporting',  iconLabel: '🎯' },
  { name: 'GRI Index Generation', description: 'Map raw disclosure data to GRI Standard compliance frameworks.',  category: 'Compliance',     iconLabel: '🔢' },
  { name: 'Emissions Validation', description: 'Cross-reference Scope 1 & 2 against regional utility benchmarks.', category: 'Climate',        iconLabel: '⚡' },
  { name: 'CSRD Readiness Check', description: 'Assess ESRS alignment and double materiality requirements.',     category: 'Compliance',     iconLabel: '🛡️' },
];

export const AGENTS_CUSTOM: AgentEntry[] = [];

export const RECENTLY_RUN: Array<{ name: string; time: string; status: string; findings: number }> = [];

export const AGENT_CATEGORIES = ['All', 'Compliance', 'Climate', 'Monitoring', 'Due Diligence', 'Reporting', 'Custom'] as const;
