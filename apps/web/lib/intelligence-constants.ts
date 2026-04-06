export const JURISDICTIONS = ['Qatar', 'Oman', 'UAE', 'Saudi', 'EU', 'UK'] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const KNOWLEDGE_SOURCES = [
  { key: 'K1', label: 'K1 Disclosures' },
  { key: 'K2', label: 'K2 Market' },
  { key: 'K3', label: 'K3 Regulatory' },
  { key: 'K4', label: 'K4 Finance' },
  { key: 'K5', label: 'K5 Peers' },
  { key: 'K6', label: 'K6 Climate' },
  { key: 'K7', label: 'K7 Research' },
] as const;

export type KnowledgeSourceKey = (typeof KNOWLEDGE_SOURCES)[number]['key'];

// The six thinking phases the backend emits, in order. Mirrors
// ThinkingStepName from @merris/shared.
export const THINKING_PHASES = [
  'Assessing query',
  'Searching context',
  'Retrieving intelligence',
  'Analyzing',
  'Evaluating quality',
  'Answering',
] as const;
