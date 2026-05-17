export interface AgentEntry {
  name: string;
  description: string;
  category: string;
  runs?: number;
  rating?: number;
  by?: string;
  shared?: number;
  iconLabel: string;
  /** Node type sequence for the steps preview strip */
  stepTypes?: string[];
}

export const AGENTS_PREBUILT: AgentEntry[] = [
  {
    name: 'Gap Analysis',
    description: 'Compare disclosure vs framework standards for compliance delta.',
    category: 'Compliance',
    runs: 1240,
    rating: 4.8,
    iconLabel: '📊',
    stepTypes: ['trigger', 'kb-search', 'llm-reason', 'condition', 'output'],
  },
  {
    name: 'Carbon Benchmarking',
    description: 'Benchmark Scope 1 & 2 against regional peers.',
    category: 'Climate',
    runs: 890,
    rating: 4.6,
    iconLabel: '✓',
    stepTypes: ['trigger', 'kb-search', 'tool-call', 'llm-reason', 'output'],
  },
  {
    name: 'Regulatory Scanner',
    description: 'Monitor regulatory feeds and flag material changes against active engagements.',
    category: 'Monitoring',
    runs: 2100,
    rating: 4.9,
    iconLabel: '👁',
    stepTypes: ['trigger', 'kb-search', 'condition', 'llm-reason', 'output'],
  },
  {
    name: 'Policy Extraction',
    description: 'Extract all human rights and labor clauses from uploaded documents.',
    category: 'Due Diligence',
    runs: 670,
    rating: 4.5,
    iconLabel: '📄',
    stepTypes: ['trigger', 'transform', 'llm-reason', 'condition', 'output'],
  },
  {
    name: 'Materiality Matrix',
    description: 'Synthesize stakeholder interests into a visual materiality assessment.',
    category: 'Reporting',
    runs: 540,
    rating: 4.4,
    iconLabel: '🎯',
    stepTypes: ['trigger', 'kb-search', 'llm-reason', 'transform', 'output'],
  },
  {
    name: 'GRI Index Generation',
    description: 'Map raw disclosure data to GRI Standard compliance frameworks.',
    category: 'Compliance',
    runs: 1580,
    rating: 4.7,
    iconLabel: '🔢',
    stepTypes: ['trigger', 'kb-search', 'condition', 'llm-reason', 'transform', 'output'],
  },
  {
    name: 'Emissions Validation',
    description: 'Cross-reference Scope 1 & 2 against regional utility benchmarks.',
    category: 'Climate',
    runs: 760,
    rating: 4.5,
    iconLabel: '⚡',
    stepTypes: ['trigger', 'kb-search', 'tool-call', 'condition', 'output'],
  },
  {
    name: 'CSRD Readiness Check',
    description: 'Assess ESRS alignment and double materiality requirements.',
    category: 'Compliance',
    runs: 430,
    rating: 4.3,
    iconLabel: '🛡️',
    stepTypes: ['trigger', 'kb-search', 'condition', 'llm-reason', 'output'],
  },
];

export const AGENTS_CUSTOM: AgentEntry[] = [];

export const RECENTLY_RUN: Array<{ name: string; time: string; status: string; findings: number }> = [];

export const AGENT_CATEGORIES = ['All', 'Compliance', 'Climate', 'Monitoring', 'Due Diligence', 'Reporting', 'Custom'] as const;
