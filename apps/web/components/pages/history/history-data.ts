export interface HistoryEntry {
  id: string;
  text: string;
  engagement: string;
  confidence?: 'High' | 'Medium' | 'Low';
  findings?: number;
  time: string;
}

export const HISTORY: HistoryEntry[] = [
  { id: 'h1', text: 'Frameworks for listed steel in Oman?',  engagement: 'AJSS',  confidence: 'High',   time: '2h' },
  { id: 'h2', text: 'Review sustainability report',          engagement: 'QAPCO', findings: 15,         time: 'Yesterday' },
  { id: 'h3', text: 'Verify Scope 2 of 148k tCO2e',          engagement: 'AJSS',  confidence: 'Medium', time: 'Yesterday' },
  { id: 'h4', text: 'Assess CBAM exposure',                  engagement: 'QAPCO', confidence: 'Medium', time: '3d ago' },
];
