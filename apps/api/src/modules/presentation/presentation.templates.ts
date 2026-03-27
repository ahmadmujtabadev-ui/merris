// ============================================================
// Deck Type Templates
// ============================================================
// Each template defines the slide structure for a deck type.
// dataBindings reference data point metric patterns to fetch.
// ============================================================

export interface SlideTemplate {
  id: string;
  title: string;
  layout: 'title' | 'kpi_dashboard' | 'chart' | 'comparison' | 'timeline' | 'table' | 'narrative' | 'section_divider';
  dataBindings: string[];
  chartType?: 'bar' | 'line' | 'pie' | 'waterfall' | 'radar' | 'bubble' | 'sankey' | 'treemap';
  speakerNotesTemplate: string;
}

export interface DeckTemplate {
  type: string;
  name: string;
  slides: SlideTemplate[];
}

// ============================================================
// Board ESG Pack (12 slides)
// ============================================================

export const boardPackTemplate: DeckTemplate = {
  type: 'board_pack',
  name: 'Board ESG Pack',
  slides: [
    {
      id: 'bp-01-title',
      title: 'ESG Board Pack',
      layout: 'title',
      dataBindings: [],
      speakerNotesTemplate: 'Opening slide for the board ESG pack. Present the reporting period and scope.',
    },
    {
      id: 'bp-02-exec-summary',
      title: 'Executive Summary',
      layout: 'narrative',
      dataBindings: ['ghg_total', 'energy_total', 'water_consumption', 'safety_ltifr'],
      speakerNotesTemplate: 'Summarize key ESG highlights, material issues, and strategic alignment.',
    },
    {
      id: 'bp-03-kpi-dashboard',
      title: 'KPI Dashboard',
      layout: 'kpi_dashboard',
      dataBindings: ['ghg_scope1', 'ghg_scope2', 'ghg_scope3', 'energy_total', 'water_consumption', 'waste_total', 'safety_trir', 'safety_ltifr'],
      chartType: 'bar',
      speakerNotesTemplate: 'Overview of all KPIs. Highlight any metrics that are off-track.',
    },
    {
      id: 'bp-04-environmental',
      title: 'Environmental Highlights',
      layout: 'chart',
      dataBindings: ['ghg_scope1', 'ghg_scope2', 'ghg_scope3', 'energy_total', 'water_consumption'],
      chartType: 'bar',
      speakerNotesTemplate: 'Cover GHG emissions by scope, energy consumption trends, and water usage.',
    },
    {
      id: 'bp-05-social',
      title: 'Social Highlights',
      layout: 'chart',
      dataBindings: ['safety_trir', 'safety_ltifr', 'employee_count', 'diversity_ratio'],
      chartType: 'bar',
      speakerNotesTemplate: 'Present safety metrics, workforce diversity, and community engagement.',
    },
    {
      id: 'bp-06-governance',
      title: 'Governance Highlights',
      layout: 'narrative',
      dataBindings: ['board_independence', 'board_diversity', 'ethics_violations'],
      speakerNotesTemplate: 'Discuss board composition, independence ratios, and ethics compliance.',
    },
    {
      id: 'bp-07-yoy-performance',
      title: 'Year-over-Year Performance',
      layout: 'chart',
      dataBindings: ['ghg_total', 'energy_total', 'water_consumption', 'safety_trir'],
      chartType: 'line',
      speakerNotesTemplate: 'Show trend lines for key metrics across reporting periods.',
    },
    {
      id: 'bp-08-targets',
      title: 'Targets & Progress',
      layout: 'table',
      dataBindings: ['ghg_target', 'energy_target', 'water_target', 'safety_target'],
      speakerNotesTemplate: 'Review progress against stated ESG targets and SBTi commitments.',
    },
    {
      id: 'bp-09-regulatory',
      title: 'Regulatory Update',
      layout: 'narrative',
      dataBindings: [],
      speakerNotesTemplate: 'Highlight new regulations, upcoming compliance requirements, and disclosure mandates.',
    },
    {
      id: 'bp-10-risk-register',
      title: 'Risk Register',
      layout: 'table',
      dataBindings: ['physical_risk_score', 'carbon_price_impact', 'stranded_asset_value'],
      speakerNotesTemplate: 'Present climate-related risks, transition risks, and mitigation actions.',
    },
    {
      id: 'bp-11-next-steps',
      title: 'Next Steps',
      layout: 'narrative',
      dataBindings: [],
      speakerNotesTemplate: 'Outline action items, upcoming milestones, and board decisions required.',
    },
    {
      id: 'bp-12-appendix',
      title: 'Appendix',
      layout: 'table',
      dataBindings: [],
      speakerNotesTemplate: 'Supporting data, methodology notes, and detailed breakdowns.',
    },
  ],
};

// ============================================================
// Client Deliverable (20 slides)
// ============================================================

export const clientDeliverableTemplate: DeckTemplate = {
  type: 'client_deliverable',
  name: 'Client Deliverable',
  slides: [
    {
      id: 'cd-01-cover',
      title: 'ESG Assessment Deliverable',
      layout: 'title',
      dataBindings: [],
      speakerNotesTemplate: 'Cover slide with client branding and engagement details.',
    },
    {
      id: 'cd-02-toc',
      title: 'Table of Contents',
      layout: 'narrative',
      dataBindings: [],
      speakerNotesTemplate: 'Overview of deliverable structure and key sections.',
    },
    {
      id: 'cd-03-methodology',
      title: 'Methodology',
      layout: 'narrative',
      dataBindings: [],
      speakerNotesTemplate: 'Explain data collection methods, frameworks applied, and assurance level.',
    },
    {
      id: 'cd-04-scope',
      title: 'Scope',
      layout: 'narrative',
      dataBindings: [],
      speakerNotesTemplate: 'Define organizational boundary, reporting period, and operational scope.',
    },
    {
      id: 'cd-05-framework',
      title: 'Framework Overview',
      layout: 'table',
      dataBindings: [],
      speakerNotesTemplate: 'Map of applicable frameworks, standards, and disclosure requirements.',
    },
    {
      id: 'cd-06-data-summary',
      title: 'Data Summary',
      layout: 'kpi_dashboard',
      dataBindings: ['ghg_scope1', 'ghg_scope2', 'ghg_scope3', 'energy_total', 'water_consumption', 'waste_total'],
      chartType: 'bar',
      speakerNotesTemplate: 'High-level summary of all collected data points and completeness status.',
    },
    {
      id: 'cd-07-env-e1',
      title: 'E1: Climate Change Mitigation',
      layout: 'chart',
      dataBindings: ['ghg_scope1', 'ghg_scope2', 'ghg_scope3'],
      chartType: 'waterfall',
      speakerNotesTemplate: 'GHG emissions by scope with reduction pathway analysis.',
    },
    {
      id: 'cd-08-env-e2',
      title: 'E2: Climate Change Adaptation',
      layout: 'chart',
      dataBindings: ['physical_risk_score', 'carbon_budget_remaining'],
      chartType: 'bar',
      speakerNotesTemplate: 'Physical and transition risk assessment findings.',
    },
    {
      id: 'cd-09-env-e3',
      title: 'E3: Water & Marine Resources',
      layout: 'chart',
      dataBindings: ['water_consumption', 'water_footprint'],
      chartType: 'bar',
      speakerNotesTemplate: 'Water consumption, discharge, and stress area exposure.',
    },
    {
      id: 'cd-10-env-e4',
      title: 'E4: Biodiversity & Ecosystems',
      layout: 'chart',
      dataBindings: ['biodiversity_msa_loss'],
      chartType: 'bar',
      speakerNotesTemplate: 'Biodiversity impact assessment and land use findings.',
    },
    {
      id: 'cd-11-env-e5',
      title: 'E5: Circular Economy',
      layout: 'chart',
      dataBindings: ['circular_economy_mci', 'waste_total'],
      chartType: 'pie',
      speakerNotesTemplate: 'Waste management, recycling rates, and circularity index.',
    },
    {
      id: 'cd-12-social-s1',
      title: 'S1: Own Workforce',
      layout: 'chart',
      dataBindings: ['safety_trir', 'safety_ltifr', 'employee_count'],
      chartType: 'bar',
      speakerNotesTemplate: 'Workforce safety, training, and human capital findings.',
    },
    {
      id: 'cd-13-social-s2',
      title: 'S2: Workers in Value Chain',
      layout: 'narrative',
      dataBindings: [],
      speakerNotesTemplate: 'Supply chain labor practices and due diligence findings.',
    },
    {
      id: 'cd-14-social-s3',
      title: 'S3: Affected Communities',
      layout: 'narrative',
      dataBindings: [],
      speakerNotesTemplate: 'Community engagement, impact assessment, and indigenous rights.',
    },
    {
      id: 'cd-15-social-s4',
      title: 'S4: Consumers & End Users',
      layout: 'narrative',
      dataBindings: [],
      speakerNotesTemplate: 'Product safety, data privacy, and responsible marketing findings.',
    },
    {
      id: 'cd-16-governance',
      title: 'Governance Findings',
      layout: 'table',
      dataBindings: ['board_independence', 'board_diversity', 'ethics_violations'],
      speakerNotesTemplate: 'Board structure, ethics, and anti-corruption findings.',
    },
    {
      id: 'cd-17-cross-framework',
      title: 'Cross-Framework Analysis',
      layout: 'comparison',
      dataBindings: [],
      speakerNotesTemplate: 'Analysis of overlaps and gaps between applicable frameworks.',
    },
    {
      id: 'cd-18-gap-analysis',
      title: 'Gap Analysis',
      layout: 'table',
      dataBindings: [],
      speakerNotesTemplate: 'Summary of data gaps, missing disclosures, and remediation plan.',
    },
    {
      id: 'cd-19-recommendations',
      title: 'Recommendations & Implementation Roadmap',
      layout: 'timeline',
      dataBindings: [],
      speakerNotesTemplate: 'Prioritized recommendations with implementation timeline.',
    },
    {
      id: 'cd-20-next-steps',
      title: 'Next Steps & Appendix',
      layout: 'narrative',
      dataBindings: [],
      speakerNotesTemplate: 'Action items, appendix references, and supplementary data tables.',
    },
  ],
};

// ============================================================
// Investor Presentation (10 slides)
// ============================================================

export const investorPresentationTemplate: DeckTemplate = {
  type: 'investor_presentation',
  name: 'Investor Presentation',
  slides: [
    {
      id: 'ip-01-title',
      title: 'ESG Investor Presentation',
      layout: 'title',
      dataBindings: [],
      speakerNotesTemplate: 'Opening slide for investor ESG briefing.',
    },
    {
      id: 'ip-02-strategy',
      title: 'ESG Strategy',
      layout: 'narrative',
      dataBindings: [],
      speakerNotesTemplate: 'Present the organization ESG strategy, materiality, and value creation narrative.',
    },
    {
      id: 'ip-03-climate',
      title: 'Climate Performance',
      layout: 'chart',
      dataBindings: ['ghg_scope1', 'ghg_scope2', 'ghg_scope3', 'carbon_budget_remaining'],
      chartType: 'waterfall',
      speakerNotesTemplate: 'GHG performance vs targets, net-zero pathway, and SBTi alignment.',
    },
    {
      id: 'ip-04-environmental',
      title: 'Environmental',
      layout: 'chart',
      dataBindings: ['energy_total', 'water_consumption', 'waste_total', 'circular_economy_mci'],
      chartType: 'bar',
      speakerNotesTemplate: 'Broader environmental metrics: energy, water, waste, and circularity.',
    },
    {
      id: 'ip-05-social',
      title: 'Social Impact',
      layout: 'chart',
      dataBindings: ['safety_trir', 'safety_ltifr', 'employee_count', 'diversity_ratio'],
      chartType: 'bar',
      speakerNotesTemplate: 'Workforce safety, diversity, and community investment highlights.',
    },
    {
      id: 'ip-06-governance',
      title: 'Governance',
      layout: 'narrative',
      dataBindings: ['board_independence', 'board_diversity'],
      speakerNotesTemplate: 'Board composition, ESG oversight, and executive compensation linkage.',
    },
    {
      id: 'ip-07-targets',
      title: 'Targets',
      layout: 'table',
      dataBindings: ['ghg_target', 'energy_target', 'water_target'],
      speakerNotesTemplate: 'ESG targets with progress indicators and timeline.',
    },
    {
      id: 'ip-08-peer-comparison',
      title: 'Peer Comparison',
      layout: 'comparison',
      dataBindings: ['portfolio_carbon_intensity', 'waci'],
      chartType: 'radar',
      speakerNotesTemplate: 'ESG rating comparison and sector benchmarking.',
    },
    {
      id: 'ip-09-risk',
      title: 'Risk Management',
      layout: 'table',
      dataBindings: ['physical_risk_score', 'carbon_price_impact', 'stranded_asset_value'],
      speakerNotesTemplate: 'Climate risk assessment, scenario analysis, and TCFD alignment.',
    },
    {
      id: 'ip-10-outlook',
      title: 'Outlook',
      layout: 'narrative',
      dataBindings: [],
      speakerNotesTemplate: 'Forward-looking ESG commitments and strategic priorities.',
    },
  ],
};

// ============================================================
// Template Registry
// ============================================================

const templateRegistry: Record<string, DeckTemplate> = {
  board_pack: boardPackTemplate,
  client_deliverable: clientDeliverableTemplate,
  investor_presentation: investorPresentationTemplate,
};

export function getTemplate(deckType: string): DeckTemplate | undefined {
  return templateRegistry[deckType];
}

export function listTemplates(): DeckTemplate[] {
  return Object.values(templateRegistry);
}
