export interface KCollection {
  id: string;
  name: string;
  count: number;
  items: string[];
}

export const KNOWLEDGE_COLLECTIONS: KCollection[] = [
  { id: 'K1', name: 'Corporate Disclosures', count: 613, items: ['Annual Report Framework', 'SASB Map', 'TCFD Practices'] },
  { id: 'K2', name: 'Market Analysis', count: 84, items: ['GCC Benchmarks', 'Carbon Pricing'] },
  { id: 'K3', name: 'Regulatory', count: 42, items: ['EU Taxonomy Act', 'SEC Climate Rule'] },
  { id: 'K4', name: 'Sustainable Finance', count: 27, items: ['Green Bond 2024', 'Article 8 vs 9'] },
  { id: 'K5', name: 'Peer Benchmarks', count: 156, items: ['SABIC ESG', 'ADNOC Framework'] },
  { id: 'K6', name: 'Climate Science', count: 39, items: ['IPCC AR6', 'Methane Modeling'] },
  { id: 'K7', name: 'Research', count: 312, items: ['Engagement Archives', 'Precedent Library'] },
];

export const TOTAL_ENTRIES = KNOWLEDGE_COLLECTIONS.reduce((sum, k) => sum + k.count, 0);
