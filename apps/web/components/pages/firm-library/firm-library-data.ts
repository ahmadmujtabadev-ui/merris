export interface LibraryCategory {
  name: string;
  count: number;
  items: string[];
}

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  { name: 'Templates',       count: 8,  items: ['GRI Template.docx', 'SASB Grid.xlsx'] },
  { name: 'Methodologies',   count: 5,  items: ['Scope Calc.pdf', 'Materiality v3.pdf'] },
  { name: 'Past Engagements', count: 12, items: ['Project Solar', 'Astra Zen'] },
  { name: 'Playbooks',       count: 4,  items: ['Risk Playbook.pdf', 'Crisis Protocol.pdf'] },
];
