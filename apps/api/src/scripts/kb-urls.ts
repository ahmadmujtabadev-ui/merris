/**
 * Merris Knowledge Base — Download URL Map
 *
 * ~475 entries across 7 domains (K1-K7).
 * Phase A: K2-K7 (~215 sources — frameworks, standards, research)
 * Phase B: K1 (~260 sources — corporate sustainability reports)
 *
 * URL accuracy:
 *   - Where the exact PDF URL is known and stable, it is used directly.
 *   - Where the exact PDF URL changes per release or sits behind JS,
 *     the landing/index page is provided instead (fileType may be 'html').
 */

export interface DownloadTarget {
  id: string;
  domain: 'k1' | 'k2' | 'k3' | 'k4' | 'k5' | 'k6' | 'k7';
  category: string;
  title: string;
  url: string;
  filename: string;
  fileType: 'pdf' | 'csv' | 'json' | 'xlsx' | 'html';
  priority: number; // 1=highest, 3=lowest
}

// ============================================================
// K2: Climate Science + Physical Data (~60 sources)
// ============================================================

const K2_TARGETS: DownloadTarget[] = [
  // --- IPCC AR6 ---
  { id: 'k2-ipcc-ar6-wg1-spm', domain: 'k2', category: 'IPCC', title: 'IPCC AR6 WG1 Summary for Policymakers', url: 'https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_SPM.pdf', filename: 'ipcc-ar6-wg1-spm.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k2-ipcc-ar6-wg1-full', domain: 'k2', category: 'IPCC', title: 'IPCC AR6 WG1 Full Report', url: 'https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_FullReport.pdf', filename: 'ipcc-ar6-wg1-full.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k2-ipcc-ar6-wg2-spm', domain: 'k2', category: 'IPCC', title: 'IPCC AR6 WG2 Summary for Policymakers', url: 'https://www.ipcc.ch/report/ar6/wg2/downloads/report/IPCC_AR6_WGII_SummaryForPolicymakers.pdf', filename: 'ipcc-ar6-wg2-spm.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k2-ipcc-ar6-wg2-full', domain: 'k2', category: 'IPCC', title: 'IPCC AR6 WG2 Full Report', url: 'https://www.ipcc.ch/report/ar6/wg2/downloads/report/IPCC_AR6_WGII_FullReport.pdf', filename: 'ipcc-ar6-wg2-full.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k2-ipcc-ar6-wg3-spm', domain: 'k2', category: 'IPCC', title: 'IPCC AR6 WG3 Summary for Policymakers', url: 'https://www.ipcc.ch/report/ar6/wg3/downloads/report/IPCC_AR6_WGIII_SummaryForPolicymakers.pdf', filename: 'ipcc-ar6-wg3-spm.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k2-ipcc-ar6-wg3-full', domain: 'k2', category: 'IPCC', title: 'IPCC AR6 WG3 Full Report', url: 'https://www.ipcc.ch/report/ar6/wg3/downloads/report/IPCC_AR6_WGIII_FullReport.pdf', filename: 'ipcc-ar6-wg3-full.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k2-ipcc-ar6-synthesis-spm', domain: 'k2', category: 'IPCC', title: 'IPCC AR6 Synthesis Report SPM', url: 'https://www.ipcc.ch/report/ar6/syr/downloads/report/IPCC_AR6_SYR_SPM.pdf', filename: 'ipcc-ar6-synthesis-spm.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k2-ipcc-ar6-synthesis-full', domain: 'k2', category: 'IPCC', title: 'IPCC AR6 Synthesis Report Full', url: 'https://www.ipcc.ch/report/ar6/syr/downloads/report/IPCC_AR6_SYR_LongerReport.pdf', filename: 'ipcc-ar6-synthesis-full.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k2-ipcc-sr15', domain: 'k2', category: 'IPCC', title: 'IPCC Special Report on 1.5C', url: 'https://www.ipcc.ch/site/assets/uploads/sites/2/2022/06/SR15_Full_Report_LR.pdf', filename: 'ipcc-sr15-full.pdf', fileType: 'pdf', priority: 1 },

  // --- IEA ---
  { id: 'k2-iea-weo-2024', domain: 'k2', category: 'IEA', title: 'IEA World Energy Outlook 2024', url: 'https://www.iea.org/reports/world-energy-outlook-2024', filename: 'iea-weo-2024.html', fileType: 'html', priority: 1 },
  { id: 'k2-iea-weo-2023', domain: 'k2', category: 'IEA', title: 'IEA World Energy Outlook 2023', url: 'https://www.iea.org/reports/world-energy-outlook-2023', filename: 'iea-weo-2023.html', fileType: 'html', priority: 1 },
  { id: 'k2-iea-nze-2023', domain: 'k2', category: 'IEA', title: 'IEA Net Zero by 2050 Roadmap (2023 update)', url: 'https://www.iea.org/reports/net-zero-roadmap-a-global-pathway-to-keep-the-15-0c-goal-in-reach', filename: 'iea-nze-roadmap-2023.html', fileType: 'html', priority: 1 },
  { id: 'k2-iea-co2-emissions-2024', domain: 'k2', category: 'IEA', title: 'IEA CO2 Emissions in 2024', url: 'https://www.iea.org/reports/co2-emissions-in-2024', filename: 'iea-co2-emissions-2024.html', fileType: 'html', priority: 1 },
  { id: 'k2-iea-global-ev-outlook-2024', domain: 'k2', category: 'IEA', title: 'IEA Global EV Outlook 2024', url: 'https://www.iea.org/reports/global-ev-outlook-2024', filename: 'iea-global-ev-outlook-2024.html', fileType: 'html', priority: 2 },
  { id: 'k2-iea-energy-technology-perspectives', domain: 'k2', category: 'IEA', title: 'IEA Energy Technology Perspectives 2023', url: 'https://www.iea.org/reports/energy-technology-perspectives-2023', filename: 'iea-etp-2023.html', fileType: 'html', priority: 2 },
  { id: 'k2-iea-renewables-2024', domain: 'k2', category: 'IEA', title: 'IEA Renewables 2024', url: 'https://www.iea.org/reports/renewables-2024', filename: 'iea-renewables-2024.html', fileType: 'html', priority: 2 },

  // --- NGFS ---
  { id: 'k2-ngfs-scenarios-2023', domain: 'k2', category: 'NGFS', title: 'NGFS Climate Scenarios 2023', url: 'https://www.ngfs.net/sites/default/files/medias/documents/ngfs_climate_scenarios_for_central_banks_and_supervisors_phase_iv.pdf', filename: 'ngfs-scenarios-phase4-2023.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k2-ngfs-nature-scenarios', domain: 'k2', category: 'NGFS', title: 'NGFS Nature-related Scenarios', url: 'https://www.ngfs.net/sites/default/files/medias/documents/ngfs_nature_scenarios.pdf', filename: 'ngfs-nature-scenarios.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k2-ngfs-guide-climate-scenario', domain: 'k2', category: 'NGFS', title: 'NGFS Guide to Climate Scenario Analysis', url: 'https://www.ngfs.net/sites/default/files/medias/documents/ngfs_guide_scenario_analysis_final.pdf', filename: 'ngfs-guide-scenario-analysis.pdf', fileType: 'pdf', priority: 2 },

  // --- WRI / GHG Protocol ---
  { id: 'k2-ghg-corporate-standard', domain: 'k2', category: 'GHG Protocol', title: 'GHG Protocol Corporate Standard', url: 'https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf', filename: 'ghg-protocol-corporate-standard.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k2-ghg-scope3-standard', domain: 'k2', category: 'GHG Protocol', title: 'GHG Protocol Scope 3 Standard', url: 'https://ghgprotocol.org/sites/default/files/standards/Corporate-Value-Chain-Accounting-Reporing-Standard_041613_2.pdf', filename: 'ghg-protocol-scope3-standard.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k2-ghg-scope2-guidance', domain: 'k2', category: 'GHG Protocol', title: 'GHG Protocol Scope 2 Guidance', url: 'https://ghgprotocol.org/sites/default/files/standards/Scope%202%20Guidance_Final_Sept26.pdf', filename: 'ghg-protocol-scope2-guidance.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k2-ghg-land-sector-draft', domain: 'k2', category: 'GHG Protocol', title: 'GHG Protocol Land Sector Guidance Draft', url: 'https://ghgprotocol.org/land-sector-and-removals-guidance', filename: 'ghg-protocol-land-sector-guidance.html', fileType: 'html', priority: 2 },

  // --- SBTi ---
  { id: 'k2-sbti-corporate-manual', domain: 'k2', category: 'SBTi', title: 'SBTi Corporate Manual', url: 'https://sciencebasedtargets.org/resources/files/SBTi-Corporate-Manual.pdf', filename: 'sbti-corporate-manual.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k2-sbti-net-zero-standard', domain: 'k2', category: 'SBTi', title: 'SBTi Corporate Net-Zero Standard', url: 'https://sciencebasedtargets.org/resources/files/Net-Zero-Standard.pdf', filename: 'sbti-net-zero-standard.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k2-sbti-financial-sector', domain: 'k2', category: 'SBTi', title: 'SBTi Financial Sector Guidance', url: 'https://sciencebasedtargets.org/resources/files/Financial-Sector-Science-Based-Targets-Guidance.pdf', filename: 'sbti-financial-sector-guidance.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k2-sbti-og-guidance', domain: 'k2', category: 'SBTi', title: 'SBTi Oil & Gas Sector Guidance', url: 'https://sciencebasedtargets.org/resources/files/SBTi-Oil-and-Gas-Guidance.pdf', filename: 'sbti-oil-gas-guidance.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k2-sbti-flag-guidance', domain: 'k2', category: 'SBTi', title: 'SBTi Forest Land and Agriculture Guidance', url: 'https://sciencebasedtargets.org/resources/files/SBTi-FLAG-Guidance.pdf', filename: 'sbti-flag-guidance.pdf', fileType: 'pdf', priority: 2 },

  // --- UNEP ---
  { id: 'k2-unep-emissions-gap-2024', domain: 'k2', category: 'UNEP', title: 'UNEP Emissions Gap Report 2024', url: 'https://www.unep.org/resources/emissions-gap-report-2024', filename: 'unep-emissions-gap-2024.html', fileType: 'html', priority: 1 },
  { id: 'k2-unep-emissions-gap-2023', domain: 'k2', category: 'UNEP', title: 'UNEP Emissions Gap Report 2023', url: 'https://www.unep.org/resources/emissions-gap-report-2023', filename: 'unep-emissions-gap-2023.html', fileType: 'html', priority: 2 },
  { id: 'k2-unep-adaptation-gap-2024', domain: 'k2', category: 'UNEP', title: 'UNEP Adaptation Gap Report 2024', url: 'https://www.unep.org/resources/adaptation-gap-report-2024', filename: 'unep-adaptation-gap-2024.html', fileType: 'html', priority: 2 },
  { id: 'k2-unep-production-gap-2023', domain: 'k2', category: 'UNEP', title: 'UNEP Production Gap Report 2023', url: 'https://www.unep.org/resources/production-gap-report-2023', filename: 'unep-production-gap-2023.html', fileType: 'html', priority: 2 },

  // --- NASA / NOAA / Climate Data ---
  { id: 'k2-nasa-giss-temp', domain: 'k2', category: 'Climate Data', title: 'NASA GISS Global Temperature Data', url: 'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv', filename: 'nasa-giss-global-temp.csv', fileType: 'csv', priority: 1 },
  { id: 'k2-noaa-co2-annual', domain: 'k2', category: 'Climate Data', title: 'NOAA Mauna Loa CO2 Annual Mean', url: 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.csv', filename: 'noaa-co2-annual-mauna-loa.csv', fileType: 'csv', priority: 1 },
  { id: 'k2-noaa-co2-weekly', domain: 'k2', category: 'Climate Data', title: 'NOAA Mauna Loa CO2 Weekly', url: 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_weekly_mlo.csv', filename: 'noaa-co2-weekly-mauna-loa.csv', fileType: 'csv', priority: 2 },
  { id: 'k2-hadcrut5-global', domain: 'k2', category: 'Climate Data', title: 'HadCRUT5 Global Temperature Dataset', url: 'https://www.metoffice.gov.uk/hadobs/hadcrut5/data/HadCRUT.5.0.2.0/analysis/diagnostics/HadCRUT.5.0.2.0.analysis.summary_series.global.annual.csv', filename: 'hadcrut5-global-annual.csv', fileType: 'csv', priority: 2 },
  { id: 'k2-globalcarbonproject-2023', domain: 'k2', category: 'Climate Data', title: 'Global Carbon Project 2023 Budget', url: 'https://globalcarbonbudgetdata.org/latest-data.html', filename: 'global-carbon-budget-2023.html', fileType: 'html', priority: 2 },

  // --- WRI ---
  { id: 'k2-wri-climate-watch', domain: 'k2', category: 'WRI', title: 'WRI Climate Watch Country Data', url: 'https://www.climatewatchdata.org/data-explorer/historical-emissions', filename: 'wri-climate-watch-emissions.html', fileType: 'html', priority: 1 },
  { id: 'k2-wri-aqueduct', domain: 'k2', category: 'WRI', title: 'WRI Aqueduct Water Risk Atlas', url: 'https://www.wri.org/data/aqueduct-water-risk-atlas', filename: 'wri-aqueduct-water-risk.html', fileType: 'html', priority: 2 },
  { id: 'k2-wri-global-forest-watch', domain: 'k2', category: 'WRI', title: 'WRI Global Forest Watch Data', url: 'https://www.globalforestwatch.org/', filename: 'wri-global-forest-watch.html', fileType: 'html', priority: 2 },

  // --- Carbon Tracker ---
  { id: 'k2-carbontracker-unburnable-carbon', domain: 'k2', category: 'Carbon Tracker', title: 'Carbon Tracker Unburnable Carbon', url: 'https://carbontracker.org/reports/unburnable-carbon-ten-years-on/', filename: 'carbontracker-unburnable-carbon.html', fileType: 'html', priority: 2 },
  { id: 'k2-carbontracker-paris-alignment', domain: 'k2', category: 'Carbon Tracker', title: 'Carbon Tracker Paris Alignment Benchmarks', url: 'https://carbontracker.org/reports/paris-aligned-benchmarks/', filename: 'carbontracker-paris-alignment.html', fileType: 'html', priority: 2 },

  // --- Climate Action Tracker ---
  { id: 'k2-cat-global-update-2024', domain: 'k2', category: 'Climate Action Tracker', title: 'Climate Action Tracker Global Update 2024', url: 'https://climateactiontracker.org/publications/global-update-december-2024/', filename: 'cat-global-update-2024.html', fileType: 'html', priority: 2 },
  { id: 'k2-cat-saudi-arabia', domain: 'k2', category: 'Climate Action Tracker', title: 'Climate Action Tracker Saudi Arabia', url: 'https://climateactiontracker.org/countries/saudi-arabia/', filename: 'cat-saudi-arabia.html', fileType: 'html', priority: 2 },
  { id: 'k2-cat-uae', domain: 'k2', category: 'Climate Action Tracker', title: 'Climate Action Tracker UAE', url: 'https://climateactiontracker.org/countries/uae/', filename: 'cat-uae.html', fileType: 'html', priority: 2 },

  // --- Transition Pathway Initiative ---
  { id: 'k2-tpi-state-of-transition-2024', domain: 'k2', category: 'TPI', title: 'TPI State of Transition Report 2024', url: 'https://www.transitionpathwayinitiative.org/publications/2024-state-of-transition-report', filename: 'tpi-state-of-transition-2024.html', fileType: 'html', priority: 2 },
  { id: 'k2-tpi-methodology', domain: 'k2', category: 'TPI', title: 'TPI Carbon Performance Methodology', url: 'https://www.transitionpathwayinitiative.org/methodology', filename: 'tpi-methodology.html', fileType: 'html', priority: 2 },

  // --- CDP ---
  { id: 'k2-cdp-global-climate-2023', domain: 'k2', category: 'CDP', title: 'CDP Global Climate Report 2023', url: 'https://www.cdp.net/en/research/global-reports/global-climate-report-2023', filename: 'cdp-global-climate-2023.html', fileType: 'html', priority: 1 },
  { id: 'k2-cdp-water-security-2023', domain: 'k2', category: 'CDP', title: 'CDP Global Water Report 2023', url: 'https://www.cdp.net/en/research/global-reports/global-water-report-2023', filename: 'cdp-global-water-2023.html', fileType: 'html', priority: 2 },

  // --- IRENA ---
  { id: 'k2-irena-renewable-capacity-2024', domain: 'k2', category: 'IRENA', title: 'IRENA Renewable Capacity Statistics 2024', url: 'https://www.irena.org/publications/2024/Mar/Renewable-Capacity-Statistics-2024', filename: 'irena-renewable-capacity-2024.html', fileType: 'html', priority: 2 },
  { id: 'k2-irena-world-energy-transitions-2024', domain: 'k2', category: 'IRENA', title: 'IRENA World Energy Transitions Outlook 2024', url: 'https://www.irena.org/publications/2024/Sep/World-Energy-Transitions-Outlook-2024', filename: 'irena-weto-2024.html', fileType: 'html', priority: 2 },

  // --- World Bank ---
  { id: 'k2-worldbank-state-carbon-pricing-2024', domain: 'k2', category: 'World Bank', title: 'World Bank State and Trends of Carbon Pricing 2024', url: 'https://openknowledge.worldbank.org/entities/publication/3002ba86-4d6b-5b37-b925-28dddc4cbe01', filename: 'worldbank-carbon-pricing-2024.html', fileType: 'html', priority: 1 },

  // --- EMF / MENA specific ---
  { id: 'k2-mena-climate-action-tracker', domain: 'k2', category: 'Regional', title: 'MENA Climate Action Overview UNDP', url: 'https://www.undp.org/arab-states/climate-promise', filename: 'undp-arab-states-climate.html', fileType: 'html', priority: 2 },
  { id: 'k2-kaust-saudi-climate-research', domain: 'k2', category: 'Regional', title: 'KAUST Climate and Livability Initiative', url: 'https://www.kaust.edu.sa/en/research/climate-and-livability', filename: 'kaust-climate-livability.html', fileType: 'html', priority: 3 },

  // --- Additional Climate Sources ---
  { id: 'k2-wmo-state-of-climate-2024', domain: 'k2', category: 'WMO', title: 'WMO State of Global Climate 2024', url: 'https://wmo.int/publication-series/state-of-global-climate', filename: 'wmo-state-of-climate-2024.html', fileType: 'html', priority: 1 },
  { id: 'k2-copernicus-climate-2024', domain: 'k2', category: 'Copernicus', title: 'Copernicus Global Climate Highlights 2024', url: 'https://climate.copernicus.eu/global-climate-highlights-2024', filename: 'copernicus-climate-highlights-2024.html', fileType: 'html', priority: 2 },
  { id: 'k2-iea-methane-tracker', domain: 'k2', category: 'IEA', title: 'IEA Global Methane Tracker 2024', url: 'https://www.iea.org/reports/global-methane-tracker-2024', filename: 'iea-methane-tracker-2024.html', fileType: 'html', priority: 2 },
  { id: 'k2-epa-ghg-inventory', domain: 'k2', category: 'Climate Data', title: 'US EPA GHG Inventory', url: 'https://www.epa.gov/ghgemissions/inventory-us-greenhouse-gas-emissions-and-sinks', filename: 'epa-ghg-inventory.html', fileType: 'html', priority: 2 },
  { id: 'k2-sbti-progress-report-2024', domain: 'k2', category: 'SBTi', title: 'SBTi Monitoring Report 2024', url: 'https://sciencebasedtargets.org/reports/sbti-monitoring-report-2024', filename: 'sbti-monitoring-report-2024.html', fileType: 'html', priority: 2 },
  { id: 'k2-cdp-forests-2023', domain: 'k2', category: 'CDP', title: 'CDP Global Forests Report 2023', url: 'https://www.cdp.net/en/research/global-reports/global-forests-report-2023', filename: 'cdp-global-forests-2023.html', fileType: 'html', priority: 2 },
];

// ============================================================
// K3: Regulatory + Legal (~50 sources)
// ============================================================

const K3_TARGETS: DownloadTarget[] = [
  // --- EU CSRD / ESRS ---
  { id: 'k3-csrd-directive', domain: 'k3', category: 'EU CSRD', title: 'CSRD Directive 2022/2464', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32022L2464', filename: 'csrd-directive-2022-2464.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k3-esrs-set1-delegated', domain: 'k3', category: 'EU CSRD', title: 'ESRS Set 1 Delegated Act 2023/2772', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32023R2772', filename: 'esrs-set1-delegated-2023-2772.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k3-esrs-e1-climate', domain: 'k3', category: 'EFRAG ESRS', title: 'ESRS E1 Climate Change', url: 'https://www.efrag.org/Assets/Download?assetUrl=%2Fsites%2Fwebpublishing%2FSiteAssets%2FED_ESRS_E1.pdf', filename: 'esrs-e1-climate-change.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k3-esrs-e2-pollution', domain: 'k3', category: 'EFRAG ESRS', title: 'ESRS E2 Pollution', url: 'https://www.efrag.org/Assets/Download?assetUrl=%2Fsites%2Fwebpublishing%2FSiteAssets%2FED_ESRS_E2.pdf', filename: 'esrs-e2-pollution.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k3-esrs-e3-water', domain: 'k3', category: 'EFRAG ESRS', title: 'ESRS E3 Water and Marine Resources', url: 'https://www.efrag.org/Assets/Download?assetUrl=%2Fsites%2Fwebpublishing%2FSiteAssets%2FED_ESRS_E3.pdf', filename: 'esrs-e3-water-marine.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k3-esrs-e4-biodiversity', domain: 'k3', category: 'EFRAG ESRS', title: 'ESRS E4 Biodiversity and Ecosystems', url: 'https://www.efrag.org/Assets/Download?assetUrl=%2Fsites%2Fwebpublishing%2FSiteAssets%2FED_ESRS_E4.pdf', filename: 'esrs-e4-biodiversity.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k3-esrs-e5-circular', domain: 'k3', category: 'EFRAG ESRS', title: 'ESRS E5 Resource Use and Circular Economy', url: 'https://www.efrag.org/Assets/Download?assetUrl=%2Fsites%2Fwebpublishing%2FSiteAssets%2FED_ESRS_E5.pdf', filename: 'esrs-e5-circular-economy.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k3-esrs-s1-workforce', domain: 'k3', category: 'EFRAG ESRS', title: 'ESRS S1 Own Workforce', url: 'https://www.efrag.org/Assets/Download?assetUrl=%2Fsites%2Fwebpublishing%2FSiteAssets%2FED_ESRS_S1.pdf', filename: 'esrs-s1-own-workforce.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k3-esrs-g1-governance', domain: 'k3', category: 'EFRAG ESRS', title: 'ESRS G1 Business Conduct', url: 'https://www.efrag.org/Assets/Download?assetUrl=%2Fsites%2Fwebpublishing%2FSiteAssets%2FED_ESRS_G1.pdf', filename: 'esrs-g1-business-conduct.pdf', fileType: 'pdf', priority: 2 },

  // --- EU Taxonomy ---
  { id: 'k3-eu-taxonomy-regulation', domain: 'k3', category: 'EU Taxonomy', title: 'EU Taxonomy Regulation 2020/852', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32020R0852', filename: 'eu-taxonomy-regulation-2020-852.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k3-eu-taxonomy-climate-delegated', domain: 'k3', category: 'EU Taxonomy', title: 'EU Taxonomy Climate Delegated Act', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32021R2139', filename: 'eu-taxonomy-climate-delegated-2021.pdf', fileType: 'pdf', priority: 1 },

  // --- SFDR ---
  { id: 'k3-sfdr-regulation', domain: 'k3', category: 'EU SFDR', title: 'SFDR Regulation 2019/2088', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32019R2088', filename: 'sfdr-regulation-2019-2088.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k3-sfdr-rts-delegated', domain: 'k3', category: 'EU SFDR', title: 'SFDR RTS Delegated Regulation', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32022R1288', filename: 'sfdr-rts-delegated-2022.pdf', fileType: 'pdf', priority: 1 },

  // --- CSDDD ---
  { id: 'k3-csddd-directive', domain: 'k3', category: 'EU CSDDD', title: 'EU Corporate Sustainability Due Diligence Directive', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32024L1760', filename: 'csddd-directive-2024.pdf', fileType: 'pdf', priority: 1 },

  // --- ISSB / IFRS ---
  { id: 'k3-ifrs-s1', domain: 'k3', category: 'ISSB', title: 'IFRS S1 General Sustainability Disclosures', url: 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s1-general-requirements/', filename: 'ifrs-s1-general-sustainability.html', fileType: 'html', priority: 1 },
  { id: 'k3-ifrs-s2', domain: 'k3', category: 'ISSB', title: 'IFRS S2 Climate-related Disclosures', url: 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/', filename: 'ifrs-s2-climate-disclosures.html', fileType: 'html', priority: 1 },

  // --- TCFD ---
  { id: 'k3-tcfd-recommendations', domain: 'k3', category: 'TCFD', title: 'TCFD Final Recommendations Report', url: 'https://assets.bbhub.io/company/sites/60/2021/10/FINAL-2017-TCFD-Report.pdf', filename: 'tcfd-final-recommendations-2017.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k3-tcfd-status-2023', domain: 'k3', category: 'TCFD', title: 'TCFD 2023 Status Report', url: 'https://assets.bbhub.io/company/sites/60/2023/09/2023-Status-Report.pdf', filename: 'tcfd-status-report-2023.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k3-tcfd-guidance-metrics', domain: 'k3', category: 'TCFD', title: 'TCFD Guidance on Metrics, Targets, Transition Plans', url: 'https://assets.bbhub.io/company/sites/60/2021/07/2021-Metrics_Targets_Guidance-1.pdf', filename: 'tcfd-metrics-targets-guidance.pdf', fileType: 'pdf', priority: 2 },

  // --- GCC / Saudi ---
  { id: 'k3-cma-esg-disclosure-guide', domain: 'k3', category: 'Saudi CMA', title: 'CMA Saudi ESG Disclosure Guide', url: 'https://www.saudiexchange.sa/Rules%20and%20Regulations/ESG-Disclosure-Guidelines.pdf', filename: 'cma-esg-disclosure-guide.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k3-saudi-exchange-esg-guide', domain: 'k3', category: 'Saudi Exchange', title: 'Saudi Exchange ESG Reporting Guide', url: 'https://www.saudiexchange.sa/wps/portal/saudiexchange/listing/esg', filename: 'saudi-exchange-esg-guide.html', fileType: 'html', priority: 1 },
  { id: 'k3-saudi-green-initiative', domain: 'k3', category: 'Saudi Arabia', title: 'Saudi Green Initiative Framework', url: 'https://www.greeninitiatives.gov.sa/about-saudi-green-initiative/', filename: 'saudi-green-initiative.html', fileType: 'html', priority: 1 },
  { id: 'k3-saudi-companies-law', domain: 'k3', category: 'Saudi Arabia', title: 'Saudi Companies Law ESG Provisions', url: 'https://www.saudiexchange.sa/Rules%20and%20Regulations/Companies-Law-Summary.pdf', filename: 'saudi-companies-law-esg.pdf', fileType: 'pdf', priority: 2 },

  // --- GCC / UAE ---
  { id: 'k3-adx-esg-guide', domain: 'k3', category: 'UAE ADX', title: 'ADX ESG Disclosure Guidance', url: 'https://www.adx.ae/English/Pages/ESG/ESG-reporting.aspx', filename: 'adx-esg-disclosure-guide.html', fileType: 'html', priority: 1 },
  { id: 'k3-dfm-esg-reporting', domain: 'k3', category: 'UAE DFM', title: 'DFM ESG Reporting Guide', url: 'https://www.dfm.ae/esg/esg-reporting', filename: 'dfm-esg-reporting-guide.html', fileType: 'html', priority: 1 },
  { id: 'k3-uae-net-zero-2050', domain: 'k3', category: 'UAE', title: 'UAE Net Zero 2050 Strategic Initiative', url: 'https://u.ae/en/about-the-uae/strategies-initiatives-and-awards/strategies-plans-and-visions/environment-and-energy/uae-net-zero-2050-strategic-initiative', filename: 'uae-net-zero-2050.html', fileType: 'html', priority: 1 },
  { id: 'k3-sca-governance-guide', domain: 'k3', category: 'UAE SCA', title: 'SCA Corporate Governance Guide', url: 'https://www.sca.gov.ae/en/open-data.aspx', filename: 'sca-governance-guide.html', fileType: 'html', priority: 2 },

  // --- GCC / Qatar ---
  { id: 'k3-qse-esg-guidance', domain: 'k3', category: 'Qatar QSE', title: 'Qatar Stock Exchange ESG Guidance', url: 'https://www.qe.com.qa/esg-listing', filename: 'qse-esg-guidance.html', fileType: 'html', priority: 1 },
  { id: 'k3-qatar-nds2-sustainability', domain: 'k3', category: 'Qatar', title: 'Qatar National Development Strategy 2 Sustainability', url: 'https://www.gco.gov.qa/en/national-development-strategy/', filename: 'qatar-nds2-sustainability.html', fileType: 'html', priority: 2 },

  // --- GCC / Kuwait, Bahrain, Oman ---
  { id: 'k3-boursa-kuwait-esg', domain: 'k3', category: 'Kuwait', title: 'Boursa Kuwait ESG Reporting Guide', url: 'https://www.boursakuwait.com.kw/en/esg', filename: 'boursa-kuwait-esg-guide.html', fileType: 'html', priority: 2 },
  { id: 'k3-bahrain-bourse-esg', domain: 'k3', category: 'Bahrain', title: 'Bahrain Bourse ESG Reporting Guide', url: 'https://www.bahrainbourse.com/ESG', filename: 'bahrain-bourse-esg-guide.html', fileType: 'html', priority: 2 },
  { id: 'k3-msm-oman-esg', domain: 'k3', category: 'Oman', title: 'Muscat Stock Exchange ESG Guidance', url: 'https://www.msx.om/esg', filename: 'msm-oman-esg-guide.html', fileType: 'html', priority: 2 },

  // --- GRI ---
  { id: 'k3-gri-universal-standards-2021', domain: 'k3', category: 'GRI', title: 'GRI Universal Standards 2021', url: 'https://www.globalreporting.org/standards/standards-development/universal-standards/', filename: 'gri-universal-standards-2021.html', fileType: 'html', priority: 1 },
  { id: 'k3-gri-sector-og', domain: 'k3', category: 'GRI', title: 'GRI Oil and Gas Sector Standard', url: 'https://www.globalreporting.org/standards/sector-standards/oil-and-gas/', filename: 'gri-sector-oil-gas.html', fileType: 'html', priority: 2 },

  // --- SEC (US) ---
  { id: 'k3-sec-climate-rule-2024', domain: 'k3', category: 'US SEC', title: 'SEC Climate Disclosure Rule (2024)', url: 'https://www.sec.gov/rules/2024/03/climate-related-disclosures', filename: 'sec-climate-disclosure-rule-2024.html', fileType: 'html', priority: 1 },

  // --- CBAM ---
  { id: 'k3-cbam-regulation', domain: 'k3', category: 'EU CBAM', title: 'EU CBAM Regulation 2023/956', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32023R0956', filename: 'cbam-regulation-2023-956.pdf', fileType: 'pdf', priority: 1 },

  // --- International ---
  { id: 'k3-paris-agreement', domain: 'k3', category: 'International', title: 'Paris Agreement (UNFCCC)', url: 'https://unfccc.int/sites/default/files/english_paris_agreement.pdf', filename: 'paris-agreement-unfccc.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k3-kunming-montreal-gbf', domain: 'k3', category: 'International', title: 'Kunming-Montreal Global Biodiversity Framework', url: 'https://www.cbd.int/doc/decisions/cop-15/cop-15-dec-04-en.pdf', filename: 'kunming-montreal-gbf.pdf', fileType: 'pdf', priority: 2 },

  // --- IOSCO ---
  { id: 'k3-iosco-sustainability-2024', domain: 'k3', category: 'IOSCO', title: 'IOSCO Sustainability-related Practices 2024', url: 'https://www.iosco.org/library/pubdocs/pdf/IOSCOPD749.pdf', filename: 'iosco-sustainability-2024.pdf', fileType: 'pdf', priority: 2 },

  // --- Additional Regulatory ---
  { id: 'k3-eu-deforestation-regulation', domain: 'k3', category: 'EU', title: 'EU Deforestation Regulation 2023/1115', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32023R1115', filename: 'eu-deforestation-regulation-2023.pdf', fileType: 'pdf', priority: 2 },
  { id: 'k3-efrag-esrs-implementation', domain: 'k3', category: 'EFRAG ESRS', title: 'EFRAG ESRS Implementation Guidance', url: 'https://www.efrag.org/en/projects/esrs-implementation-guidance-ig', filename: 'efrag-esrs-implementation-guidance.html', fileType: 'html', priority: 2 },
  { id: 'k3-hkex-esg-guide', domain: 'k3', category: 'HKEX', title: 'HKEX ESG Reporting Guide', url: 'https://www.hkex.com.hk/Listing/Rules-and-Guidance/Environmental-Social-and-Governance', filename: 'hkex-esg-reporting-guide.html', fileType: 'html', priority: 2 },
  { id: 'k3-sgx-sustainability-guide', domain: 'k3', category: 'SGX', title: 'SGX Sustainability Reporting Guide', url: 'https://www.sgx.com/sustainable-finance/sustainability-reporting', filename: 'sgx-sustainability-guide.html', fileType: 'html', priority: 2 },
  { id: 'k3-jfsa-sustainability-2024', domain: 'k3', category: 'Japan FSA', title: 'Japan FSA Sustainability Disclosure Standards', url: 'https://www.fsa.go.jp/en/news/2024/20240305.html', filename: 'japan-fsa-sustainability-2024.html', fileType: 'html', priority: 3 },
  { id: 'k3-brazil-cvm-sustainability', domain: 'k3', category: 'Brazil CVM', title: 'Brazil CVM Sustainability Reporting Resolution', url: 'https://www.gov.br/cvm/en/regulation', filename: 'brazil-cvm-sustainability.html', fileType: 'html', priority: 3 },
  { id: 'k3-asic-australia-climate', domain: 'k3', category: 'Australia', title: 'Australia AASB Climate-related Disclosures', url: 'https://www.aasb.gov.au/current-projects/sustainability-reporting/', filename: 'australia-aasb-climate-disclosure.html', fileType: 'html', priority: 3 },
  { id: 'k3-saudi-netzero-circular-carbon', domain: 'k3', category: 'Saudi Arabia', title: 'Saudi Circular Carbon Economy Framework', url: 'https://www.greeninitiatives.gov.sa/about-middle-east-green-initiative/', filename: 'saudi-circular-carbon-economy.html', fileType: 'html', priority: 2 },
  { id: 'k3-oman-vision-2040-green', domain: 'k3', category: 'Oman', title: 'Oman Vision 2040 Green Economy', url: 'https://www.oman2040.om/', filename: 'oman-vision-2040-green.html', fileType: 'html', priority: 3 },
  { id: 'k3-kuwait-vision-2035-env', domain: 'k3', category: 'Kuwait', title: 'Kuwait Vision 2035 Environmental Strategy', url: 'https://www.newkuwait.gov.kw/en/', filename: 'kuwait-vision-2035-env.html', fileType: 'html', priority: 3 },
  { id: 'k3-bahrain-vision-2030-esg', domain: 'k3', category: 'Bahrain', title: 'Bahrain Vision 2030 Sustainability', url: 'https://www.bahrainedb.com/vision-2030/', filename: 'bahrain-vision-2030-esg.html', fileType: 'html', priority: 3 },
];

// ============================================================
// K4: Sustainable Finance + Markets (~25 sources)
// ============================================================

const K4_TARGETS: DownloadTarget[] = [
  // --- ICMA Green/Social/Sustainability Bonds ---
  { id: 'k4-icma-green-bond-principles', domain: 'k4', category: 'ICMA', title: 'ICMA Green Bond Principles 2024', url: 'https://www.icmagroup.org/assets/documents/Sustainable-finance/2024-updates/Green-Bond-Principles_June-2024-280624.pdf', filename: 'icma-green-bond-principles-2024.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k4-icma-social-bond-principles', domain: 'k4', category: 'ICMA', title: 'ICMA Social Bond Principles 2024', url: 'https://www.icmagroup.org/assets/documents/Sustainable-finance/2024-updates/Social-Bond-Principles_June-2024-280624.pdf', filename: 'icma-social-bond-principles-2024.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k4-icma-sustainability-bond-guidelines', domain: 'k4', category: 'ICMA', title: 'ICMA Sustainability Bond Guidelines 2024', url: 'https://www.icmagroup.org/assets/documents/Sustainable-finance/2024-updates/Sustainability-Bond-Guidelines_June-2024-280624.pdf', filename: 'icma-sustainability-bond-guidelines-2024.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k4-icma-slb-principles', domain: 'k4', category: 'ICMA', title: 'ICMA Sustainability-Linked Bond Principles', url: 'https://www.icmagroup.org/sustainable-finance/the-principles-guidelines-and-handbooks/sustainability-linked-bond-principles-slbp/', filename: 'icma-slb-principles.html', fileType: 'html', priority: 1 },
  { id: 'k4-icma-transition-finance-handbook', domain: 'k4', category: 'ICMA', title: 'ICMA Climate Transition Finance Handbook', url: 'https://www.icmagroup.org/sustainable-finance/the-principles-guidelines-and-handbooks/climate-transition-finance-handbook/', filename: 'icma-transition-finance-handbook.html', fileType: 'html', priority: 2 },

  // --- PCAF ---
  { id: 'k4-pcaf-standard-2023', domain: 'k4', category: 'PCAF', title: 'PCAF Global GHG Accounting Standard (2nd ed)', url: 'https://carbonaccountingfinancials.com/standard', filename: 'pcaf-ghg-standard-2nd.html', fileType: 'html', priority: 1 },
  { id: 'k4-pcaf-insurance-guidance', domain: 'k4', category: 'PCAF', title: 'PCAF Insurance-Associated Emissions Guidance', url: 'https://carbonaccountingfinancials.com/standard#insurance', filename: 'pcaf-insurance-guidance.html', fileType: 'html', priority: 2 },

  // --- GFANZ ---
  { id: 'k4-gfanz-net-zero-transition-plans', domain: 'k4', category: 'GFANZ', title: 'GFANZ Net-Zero Transition Plans Framework', url: 'https://assets.bbhub.io/company/sites/63/2022/09/Recommendations-and-Guidance-on-Financial-Institution-Net-zero-Transition-Plans-November-2022.pdf', filename: 'gfanz-nz-transition-plans-2022.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k4-gfanz-sector-pathways', domain: 'k4', category: 'GFANZ', title: 'GFANZ Sectoral Pathways for Real Economy', url: 'https://assets.bbhub.io/company/sites/63/2022/06/GFANZ_-Guidance-on-Use-of-Sectoral-Pathways-for-Financial-Institutions_June2022.pdf', filename: 'gfanz-sector-pathways-2022.pdf', fileType: 'pdf', priority: 2 },

  // --- MSCI ---
  { id: 'k4-msci-esg-ratings-methodology', domain: 'k4', category: 'MSCI', title: 'MSCI ESG Ratings Methodology', url: 'https://www.msci.com/our-solutions/esg-investing/esg-ratings/esg-ratings-methodology', filename: 'msci-esg-ratings-methodology.html', fileType: 'html', priority: 1 },

  // --- S&P / Dow Jones ---
  { id: 'k4-sp-global-esg-scores', domain: 'k4', category: 'S&P Global', title: 'S&P Global ESG Scores Methodology', url: 'https://www.spglobal.com/esg/solutions/data-intelligence-esg-scores', filename: 'sp-global-esg-scores-methodology.html', fileType: 'html', priority: 2 },

  // --- Sustainalytics ---
  { id: 'k4-sustainalytics-esg-risk', domain: 'k4', category: 'Sustainalytics', title: 'Sustainalytics ESG Risk Ratings Methodology', url: 'https://www.sustainalytics.com/esg-ratings', filename: 'sustainalytics-esg-risk-methodology.html', fileType: 'html', priority: 2 },

  // --- Equator Principles ---
  { id: 'k4-equator-principles-ep4', domain: 'k4', category: 'Equator Principles', title: 'Equator Principles EP4', url: 'https://equator-principles.com/about-the-equator-principles/', filename: 'equator-principles-ep4.html', fileType: 'html', priority: 2 },

  // --- PRI ---
  { id: 'k4-pri-reporting-framework', domain: 'k4', category: 'PRI', title: 'UN PRI Reporting Framework 2024', url: 'https://www.unpri.org/reporting-and-assessment/reporting-framework/6499.article', filename: 'pri-reporting-framework-2024.html', fileType: 'html', priority: 1 },
  { id: 'k4-pri-stewardship-guide', domain: 'k4', category: 'PRI', title: 'PRI Stewardship Guide', url: 'https://www.unpri.org/stewardship/a-practical-guide-to-active-ownership-in-listed-equity/2633.article', filename: 'pri-stewardship-guide.html', fileType: 'html', priority: 2 },

  // --- CBI ---
  { id: 'k4-cbi-green-bond-market-2024', domain: 'k4', category: 'Climate Bonds Initiative', title: 'CBI Global State of Green Bond Market 2024', url: 'https://www.climatebonds.net/resources/reports', filename: 'cbi-green-bond-market-2024.html', fileType: 'html', priority: 1 },
  { id: 'k4-cbi-taxonomy', domain: 'k4', category: 'Climate Bonds Initiative', title: 'CBI Climate Bonds Taxonomy', url: 'https://www.climatebonds.net/standard/taxonomy', filename: 'cbi-taxonomy.html', fileType: 'html', priority: 2 },

  // --- Islamic Finance ---
  { id: 'k4-aaoifi-esg-standards', domain: 'k4', category: 'Islamic Finance', title: 'AAOIFI ESG Standards for Islamic Finance', url: 'https://aaoifi.com/standards/?lang=en', filename: 'aaoifi-esg-standards.html', fileType: 'html', priority: 1 },
  { id: 'k4-iifm-green-sukuk', domain: 'k4', category: 'Islamic Finance', title: 'IIFM Green Sukuk Framework', url: 'https://www.iifm.net/published-standards/', filename: 'iifm-green-sukuk-framework.html', fileType: 'html', priority: 2 },
  { id: 'k4-refinitiv-islamic-esg', domain: 'k4', category: 'Islamic Finance', title: 'LSEG/Refinitiv Islamic Finance ESG Outlook', url: 'https://www.lseg.com/en/insights/islamic-finance', filename: 'refinitiv-islamic-esg.html', fileType: 'html', priority: 2 },

  // --- GCC specific ---
  { id: 'k4-gcc-green-bond-overview', domain: 'k4', category: 'GCC Finance', title: 'HSBC GCC Green Bond Market Overview', url: 'https://www.business.hsbc.com/en-gb/campaigns/sustainable-financing/green-bonds', filename: 'hsbc-gcc-green-bonds.html', fileType: 'html', priority: 2 },

  // --- EU Green Bond Standard ---
  { id: 'k4-eu-green-bond-standard', domain: 'k4', category: 'EU', title: 'EU Green Bond Standard Regulation', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32023R2631', filename: 'eu-green-bond-standard-2023.pdf', fileType: 'pdf', priority: 1 },

  // --- Net Zero Banking Alliance ---
  { id: 'k4-nzba-guidelines', domain: 'k4', category: 'NZBA', title: 'Net-Zero Banking Alliance Guidelines', url: 'https://www.unepfi.org/net-zero-banking/', filename: 'nzba-guidelines.html', fileType: 'html', priority: 2 },
  { id: 'k4-nzia-target-setting', domain: 'k4', category: 'NZIA', title: 'Net-Zero Insurance Alliance Target Setting Protocol', url: 'https://www.unepfi.org/net-zero-insurance/', filename: 'nzia-target-setting.html', fileType: 'html', priority: 2 },
];

// ============================================================
// K5: Environmental Science + Biodiversity (~25 sources)
// ============================================================

const K5_TARGETS: DownloadTarget[] = [
  // --- TNFD ---
  { id: 'k5-tnfd-recommendations', domain: 'k5', category: 'TNFD', title: 'TNFD Recommendations v1.0', url: 'https://tnfd.global/recommendations-of-the-tnfd/', filename: 'tnfd-recommendations-v1.html', fileType: 'html', priority: 1 },
  { id: 'k5-tnfd-guidance-target-setting', domain: 'k5', category: 'TNFD', title: 'TNFD Guidance on Target Setting', url: 'https://tnfd.global/publication/guidance-on-engagement-with-indigenous-peoples-local-communities/', filename: 'tnfd-target-setting-guidance.html', fileType: 'html', priority: 2 },
  { id: 'k5-tnfd-sector-guidance-og', domain: 'k5', category: 'TNFD', title: 'TNFD Additional Guidance for Oil & Gas', url: 'https://tnfd.global/publication/additional-guidance-on-assessment-of-nature-related-issues-the-leap-approach/', filename: 'tnfd-sector-guidance-og.html', fileType: 'html', priority: 2 },

  // --- SBTN ---
  { id: 'k5-sbtn-initial-guidance', domain: 'k5', category: 'SBTN', title: 'SBTN Initial Guidance for Business', url: 'https://sciencebasedtargetsnetwork.org/resources/', filename: 'sbtn-initial-guidance.html', fileType: 'html', priority: 1 },
  { id: 'k5-sbtn-freshwater-targets', domain: 'k5', category: 'SBTN', title: 'SBTN Freshwater Target Setting', url: 'https://sciencebasedtargetsnetwork.org/how-it-works/set-targets/freshwater/', filename: 'sbtn-freshwater-targets.html', fileType: 'html', priority: 2 },
  { id: 'k5-sbtn-land-targets', domain: 'k5', category: 'SBTN', title: 'SBTN Land Target Setting', url: 'https://sciencebasedtargetsnetwork.org/how-it-works/set-targets/land/', filename: 'sbtn-land-targets.html', fileType: 'html', priority: 2 },

  // --- IUCN ---
  { id: 'k5-iucn-red-list-stats', domain: 'k5', category: 'IUCN', title: 'IUCN Red List Summary Statistics', url: 'https://www.iucnredlist.org/statistics', filename: 'iucn-red-list-statistics.html', fileType: 'html', priority: 1 },
  { id: 'k5-iucn-species-data', domain: 'k5', category: 'IUCN', title: 'IUCN Red List Assessment Summary', url: 'https://www.iucnredlist.org/resources/summary-statistics', filename: 'iucn-species-assessment-summary.html', fileType: 'html', priority: 2 },

  // --- WHO ---
  { id: 'k5-who-air-quality-guidelines', domain: 'k5', category: 'WHO', title: 'WHO Global Air Quality Guidelines 2021', url: 'https://www.who.int/publications/i/item/9789240034228', filename: 'who-air-quality-guidelines-2021.html', fileType: 'html', priority: 1 },
  { id: 'k5-who-climate-health-2023', domain: 'k5', category: 'WHO', title: 'WHO Climate Change and Health 2023', url: 'https://www.who.int/publications/i/item/9789240074729', filename: 'who-climate-health-2023.html', fileType: 'html', priority: 2 },

  // --- WWF ---
  { id: 'k5-wwf-living-planet-2024', domain: 'k5', category: 'WWF', title: 'WWF Living Planet Report 2024', url: 'https://livingplanet.panda.org/', filename: 'wwf-living-planet-2024.html', fileType: 'html', priority: 1 },

  // --- IPBES ---
  { id: 'k5-ipbes-global-assessment', domain: 'k5', category: 'IPBES', title: 'IPBES Global Assessment Summary for Policymakers', url: 'https://www.ipbes.net/global-assessment', filename: 'ipbes-global-assessment-spm.html', fileType: 'html', priority: 1 },
  { id: 'k5-ipbes-values-assessment', domain: 'k5', category: 'IPBES', title: 'IPBES Values Assessment Report', url: 'https://www.ipbes.net/the-values-assessment', filename: 'ipbes-values-assessment.html', fileType: 'html', priority: 2 },

  // --- Planetary Boundaries ---
  { id: 'k5-stockholm-planetary-boundaries', domain: 'k5', category: 'Stockholm Resilience', title: 'Stockholm Resilience Centre Planetary Boundaries 2023', url: 'https://www.stockholmresilience.org/research/planetary-boundaries.html', filename: 'stockholm-planetary-boundaries-2023.html', fileType: 'html', priority: 1 },

  // --- Ocean / Marine ---
  { id: 'k5-unep-marine-litter-2024', domain: 'k5', category: 'UNEP', title: 'UNEP Marine Litter and Plastic Pollution', url: 'https://www.unep.org/explore-topics/oceans-seas/what-we-do/addressing-land-based-pollution/marine-litter-and-plastic', filename: 'unep-marine-litter-plastic.html', fileType: 'html', priority: 2 },
  { id: 'k5-imo-ghg-strategy', domain: 'k5', category: 'IMO', title: 'IMO 2023 GHG Strategy for Shipping', url: 'https://www.imo.org/en/OurWork/Environment/Pages/2023-IMO-Strategy-on-Reduction-of-GHG-Emissions-from-Ships.aspx', filename: 'imo-ghg-strategy-2023.html', fileType: 'html', priority: 2 },

  // --- Water ---
  { id: 'k5-un-water-sdg6-2023', domain: 'k5', category: 'UN Water', title: 'UN-Water SDG 6 Data Portal', url: 'https://www.sdg6data.org/', filename: 'un-water-sdg6-data.html', fileType: 'html', priority: 2 },
  { id: 'k5-ceres-valuing-water', domain: 'k5', category: 'Ceres', title: 'Ceres Valuing Water Finance Initiative', url: 'https://www.ceres.org/water/valuing-water-finance-initiative', filename: 'ceres-valuing-water.html', fileType: 'html', priority: 2 },

  // --- Circular Economy ---
  { id: 'k5-emf-circular-gap-2024', domain: 'k5', category: 'Ellen MacArthur', title: 'Circularity Gap Report 2024', url: 'https://www.circularity-gap.world/2024', filename: 'circularity-gap-report-2024.html', fileType: 'html', priority: 2 },
  { id: 'k5-emf-plastics-pact', domain: 'k5', category: 'Ellen MacArthur', title: 'Ellen MacArthur Foundation Global Plastics Pact', url: 'https://www.ellenmacarthurfoundation.org/global-commitment-2024', filename: 'emf-plastics-global-commitment.html', fileType: 'html', priority: 2 },

  // --- ENCORE ---
  { id: 'k5-encore-natural-capital', domain: 'k5', category: 'ENCORE', title: 'ENCORE Natural Capital Tool', url: 'https://encorenature.org/en', filename: 'encore-natural-capital-tool.html', fileType: 'html', priority: 2 },

  // --- Gulf Region Specific ---
  { id: 'k5-uae-climate-action-plan', domain: 'k5', category: 'Regional', title: 'UAE National Climate Change Plan 2050', url: 'https://www.moccae.gov.ae/en/knowledge-and-statistics/uae-s-national-climate-change-plan.aspx', filename: 'uae-climate-change-plan-2050.html', fileType: 'html', priority: 2 },
  { id: 'k5-saudi-ncbe-biodiversity', domain: 'k5', category: 'Regional', title: 'Saudi NCBE Biodiversity Strategy', url: 'https://www.ncbe.gov.sa/en', filename: 'saudi-ncbe-biodiversity.html', fileType: 'html', priority: 2 },
  { id: 'k5-qatar-env-sustainability', domain: 'k5', category: 'Regional', title: 'Qatar Ministry of Environment Climate Action', url: 'https://www.moe.gov.qa/en/Pages/default.aspx', filename: 'qatar-env-climate-action.html', fileType: 'html', priority: 3 },
];

// ============================================================
// K6: Supply Chain + Human Rights (~20 sources)
// ============================================================

const K6_TARGETS: DownloadTarget[] = [
  // --- UN Guiding Principles ---
  { id: 'k6-ungp-business-hr', domain: 'k6', category: 'UN', title: 'UN Guiding Principles on Business and Human Rights', url: 'https://www.ohchr.org/sites/default/files/documents/publications/guidingprinciplesbusinesshr_en.pdf', filename: 'ungp-business-human-rights.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k6-ungp-interpretive-guide', domain: 'k6', category: 'UN', title: 'UNGP Interpretive Guide', url: 'https://www.ohchr.org/sites/default/files/Documents/Issues/Business/RtRInterpretativeGuide.pdf', filename: 'ungp-interpretive-guide.pdf', fileType: 'pdf', priority: 2 },

  // --- OECD ---
  { id: 'k6-oecd-due-diligence-guidance', domain: 'k6', category: 'OECD', title: 'OECD Due Diligence Guidance for Responsible Business Conduct', url: 'https://mneguidelines.oecd.org/OECD-Due-Diligence-Guidance-for-Responsible-Business-Conduct.pdf', filename: 'oecd-due-diligence-rbc.pdf', fileType: 'pdf', priority: 1 },
  { id: 'k6-oecd-guidelines-mne-2023', domain: 'k6', category: 'OECD', title: 'OECD Guidelines for Multinational Enterprises 2023', url: 'https://www.oecd.org/en/publications/oecd-guidelines-for-multinational-enterprises-on-responsible-business-conduct_81f92357-en.html', filename: 'oecd-mne-guidelines-2023.html', fileType: 'html', priority: 1 },
  { id: 'k6-oecd-minerals-guidance', domain: 'k6', category: 'OECD', title: 'OECD Due Diligence Guidance for Minerals', url: 'https://www.oecd.org/en/publications/oecd-due-diligence-guidance-for-responsible-supply-chains-of-minerals-from-conflict-affected-and-high-risk-areas_9789264252479-en.html', filename: 'oecd-minerals-due-diligence.html', fileType: 'html', priority: 2 },

  // --- ILO ---
  { id: 'k6-ilo-forced-labour-indicators', domain: 'k6', category: 'ILO', title: 'ILO Indicators of Forced Labour', url: 'https://www.ilo.org/publications/ilo-indicators-forced-labour', filename: 'ilo-forced-labour-indicators.html', fileType: 'html', priority: 1 },
  { id: 'k6-ilo-decent-work', domain: 'k6', category: 'ILO', title: 'ILO Decent Work Indicators', url: 'https://www.ilo.org/integration/themes/mdw/lang--en/index.htm', filename: 'ilo-decent-work-indicators.html', fileType: 'html', priority: 2 },
  { id: 'k6-ilo-just-transition', domain: 'k6', category: 'ILO', title: 'ILO Just Transition Guidelines', url: 'https://www.ilo.org/global/topics/green-jobs/publications/WCMS_432859/lang--en/index.htm', filename: 'ilo-just-transition-guidelines.html', fileType: 'html', priority: 2 },

  // --- Walk Free / Global Slavery Index ---
  { id: 'k6-walkfree-slavery-index-2023', domain: 'k6', category: 'Walk Free', title: 'Global Slavery Index 2023', url: 'https://www.walkfree.org/global-slavery-index/', filename: 'walkfree-global-slavery-index-2023.html', fileType: 'html', priority: 1 },

  // --- Transparency International ---
  { id: 'k6-ti-cpi-2024', domain: 'k6', category: 'Transparency Intl', title: 'Transparency International CPI 2024', url: 'https://www.transparency.org/en/cpi/2024', filename: 'ti-cpi-2024.html', fileType: 'html', priority: 1 },

  // --- Modern Slavery ---
  { id: 'k6-uk-modern-slavery-act', domain: 'k6', category: 'Legislation', title: 'UK Modern Slavery Act 2015 Guidance', url: 'https://www.gov.uk/government/collections/modern-slavery', filename: 'uk-modern-slavery-act-guidance.html', fileType: 'html', priority: 2 },

  // --- SA8000 ---
  { id: 'k6-sa8000-standard', domain: 'k6', category: 'SAI', title: 'SA8000 Social Accountability Standard', url: 'https://sa-intl.org/programs/sa8000/', filename: 'sa8000-standard.html', fileType: 'html', priority: 2 },

  // --- Conflict Minerals ---
  { id: 'k6-eu-conflict-minerals-reg', domain: 'k6', category: 'EU', title: 'EU Conflict Minerals Regulation 2017/821', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32017R0821', filename: 'eu-conflict-minerals-2017-821.pdf', fileType: 'pdf', priority: 2 },

  // --- CDP Supply Chain ---
  { id: 'k6-cdp-supply-chain-2023', domain: 'k6', category: 'CDP', title: 'CDP Supply Chain Report 2023', url: 'https://www.cdp.net/en/research/global-reports/engaging-the-chain', filename: 'cdp-supply-chain-2023.html', fileType: 'html', priority: 2 },

  // --- Sedex ---
  { id: 'k6-sedex-smeta-guidance', domain: 'k6', category: 'Sedex', title: 'SMETA Social Audit Methodology', url: 'https://www.sedex.com/our-services/smeta-audit/', filename: 'sedex-smeta-methodology.html', fileType: 'html', priority: 2 },

  // --- German Supply Chain Act ---
  { id: 'k6-germany-lksg', domain: 'k6', category: 'Legislation', title: 'German Supply Chain Due Diligence Act (LkSG)', url: 'https://www.bmas.de/EN/Europe-and-the-World/International/Supply-Chain-Act/supply-chain-act.html', filename: 'germany-lksg-supply-chain.html', fileType: 'html', priority: 2 },

  // --- GCC Specific ---
  { id: 'k6-saudi-labor-reform-2021', domain: 'k6', category: 'GCC', title: 'Saudi Arabia Labour Reform Initiative', url: 'https://hrsd.gov.sa/en/labor-reform-initiative', filename: 'saudi-labor-reform-initiative.html', fileType: 'html', priority: 2 },
  { id: 'k6-uae-labor-law', domain: 'k6', category: 'GCC', title: 'UAE Federal Labour Law', url: 'https://www.mohre.gov.ae/en/laws-legislation/federal-laws.aspx', filename: 'uae-federal-labour-law.html', fileType: 'html', priority: 2 },
  { id: 'k6-qatar-labor-reforms', domain: 'k6', category: 'GCC', title: 'Qatar Labour Reforms Overview', url: 'https://www.ilo.org/beirut/projects/qatar-office/lang--en/index.htm', filename: 'qatar-labor-reforms-ilo.html', fileType: 'html', priority: 2 },
];

// ============================================================
// K7: Research + Thought Leadership (~35 sources)
// ============================================================

const K7_TARGETS: DownloadTarget[] = [
  // --- Big 4 / Consulting ---
  { id: 'k7-kpmg-survey-sustainability-2024', domain: 'k7', category: 'KPMG', title: 'KPMG Survey of Sustainability Reporting 2024', url: 'https://kpmg.com/xx/en/our-insights/esg/survey-of-sustainability-reporting.html', filename: 'kpmg-sustainability-survey-2024.html', fileType: 'html', priority: 1 },
  { id: 'k7-kpmg-esg-assurance', domain: 'k7', category: 'KPMG', title: 'KPMG ESG Assurance Maturity Index', url: 'https://kpmg.com/xx/en/our-insights/esg/esg-assurance-maturity-index.html', filename: 'kpmg-esg-assurance-maturity.html', fileType: 'html', priority: 2 },
  { id: 'k7-pwc-global-investor-survey-2024', domain: 'k7', category: 'PwC', title: 'PwC Global Investor Survey 2024', url: 'https://www.pwc.com/gx/en/issues/esg/global-investor-survey.html', filename: 'pwc-global-investor-survey-2024.html', fileType: 'html', priority: 1 },
  { id: 'k7-pwc-esg-reporting-outlook', domain: 'k7', category: 'PwC', title: 'PwC ESG Reporting and Assurance Outlook', url: 'https://www.pwc.com/gx/en/services/sustainability/publications/esg-reporting.html', filename: 'pwc-esg-reporting-outlook.html', fileType: 'html', priority: 2 },
  { id: 'k7-deloitte-climate-check-2024', domain: 'k7', category: 'Deloitte', title: 'Deloitte CxO Sustainability Report 2024', url: 'https://www.deloitte.com/global/en/issues/climate/cxo-sustainability-report.html', filename: 'deloitte-cxo-sustainability-2024.html', fileType: 'html', priority: 1 },
  { id: 'k7-deloitte-turning-point-climate', domain: 'k7', category: 'Deloitte', title: 'Deloitte Turning Point Climate Report', url: 'https://www.deloitte.com/global/en/issues/climate/global-turning-point.html', filename: 'deloitte-turning-point-climate.html', fileType: 'html', priority: 2 },
  { id: 'k7-ey-sustainable-value-study', domain: 'k7', category: 'EY', title: 'EY Global Corporate Reporting Survey 2024', url: 'https://www.ey.com/en_gl/insights/assurance/is-your-esg-data-unlocking-long-term-value', filename: 'ey-global-reporting-survey-2024.html', fileType: 'html', priority: 2 },
  { id: 'k7-mckinsey-climate-risk', domain: 'k7', category: 'McKinsey', title: 'McKinsey Climate Risk and Response', url: 'https://www.mckinsey.com/capabilities/sustainability/our-insights/climate-risk-and-response-physical-hazards-and-socioeconomic-impacts', filename: 'mckinsey-climate-risk-response.html', fileType: 'html', priority: 1 },
  { id: 'k7-mckinsey-net-zero-transition', domain: 'k7', category: 'McKinsey', title: 'McKinsey Net-Zero Transition 2024', url: 'https://www.mckinsey.com/capabilities/sustainability/our-insights/the-net-zero-transition', filename: 'mckinsey-net-zero-transition.html', fileType: 'html', priority: 1 },
  { id: 'k7-bcg-climate-ai', domain: 'k7', category: 'BCG', title: 'BCG AI for Climate Sustainability', url: 'https://www.bcg.com/publications/2024/ai-for-climate-and-nature', filename: 'bcg-ai-climate-sustainability.html', fileType: 'html', priority: 2 },

  // --- WEF ---
  { id: 'k7-wef-global-risks-2025', domain: 'k7', category: 'WEF', title: 'WEF Global Risks Report 2025', url: 'https://www.weforum.org/publications/global-risks-report-2025/', filename: 'wef-global-risks-2025.html', fileType: 'html', priority: 1 },
  { id: 'k7-wef-stakeholder-capitalism-metrics', domain: 'k7', category: 'WEF', title: 'WEF Stakeholder Capitalism Metrics', url: 'https://www.weforum.org/publications/measuring-stakeholder-capitalism-towards-common-metrics-and-consistent-reporting-of-sustainable-value-creation/', filename: 'wef-stakeholder-capitalism-metrics.html', fileType: 'html', priority: 1 },
  { id: 'k7-wef-nature-risk-rising', domain: 'k7', category: 'WEF', title: 'WEF Nature Risk Rising', url: 'https://www.weforum.org/publications/nature-risk-rising-why-the-crisis-engulfing-nature-matters-for-business-and-the-economy/', filename: 'wef-nature-risk-rising.html', fileType: 'html', priority: 2 },
  { id: 'k7-wef-future-of-jobs-2025', domain: 'k7', category: 'WEF', title: 'WEF Future of Jobs Report 2025', url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/', filename: 'wef-future-of-jobs-2025.html', fileType: 'html', priority: 2 },

  // --- Academic / Think Tanks ---
  { id: 'k7-lse-grantham-climate-laws', domain: 'k7', category: 'Academic', title: 'Grantham Institute Climate Laws of the World', url: 'https://climate-laws.org/', filename: 'grantham-climate-laws.html', fileType: 'html', priority: 1 },
  { id: 'k7-oxford-smith-school-stranded-assets', domain: 'k7', category: 'Academic', title: 'Oxford Smith School Stranded Assets Programme', url: 'https://www.smithschool.ox.ac.uk/research/sustainable-finance/stranded-assets', filename: 'oxford-stranded-assets.html', fileType: 'html', priority: 2 },
  { id: 'k7-columbia-sabin-climate-litigation', domain: 'k7', category: 'Academic', title: 'Columbia Sabin Center Climate Litigation DB', url: 'https://climatecasechart.com/', filename: 'columbia-climate-litigation-db.html', fileType: 'html', priority: 2 },

  // --- Bloomberg / Finance ---
  { id: 'k7-bnef-nef-outlook-2024', domain: 'k7', category: 'BNEF', title: 'BNEF New Energy Outlook 2024', url: 'https://about.bnef.com/new-energy-outlook/', filename: 'bnef-new-energy-outlook-2024.html', fileType: 'html', priority: 1 },
  { id: 'k7-bnef-energy-transition-investment', domain: 'k7', category: 'BNEF', title: 'BNEF Energy Transition Investment Trends', url: 'https://about.bnef.com/energy-transition-investment/', filename: 'bnef-energy-transition-investment.html', fileType: 'html', priority: 2 },

  // --- Ceres ---
  { id: 'k7-ceres-roadmap-2030', domain: 'k7', category: 'Ceres', title: 'Ceres Roadmap 2030', url: 'https://www.ceres.org/roadmap-2030', filename: 'ceres-roadmap-2030.html', fileType: 'html', priority: 2 },

  // --- WBCSD ---
  { id: 'k7-wbcsd-vision-2050', domain: 'k7', category: 'WBCSD', title: 'WBCSD Vision 2050', url: 'https://www.wbcsd.org/Overview/About-us/Vision-2050-Time-to-Transform', filename: 'wbcsd-vision-2050.html', fileType: 'html', priority: 2 },
  { id: 'k7-wbcsd-natural-capital-protocol', domain: 'k7', category: 'WBCSD', title: 'WBCSD Natural Capital Protocol', url: 'https://capitalscoalition.org/capitals-approach/natural-capital-protocol/', filename: 'wbcsd-natural-capital-protocol.html', fileType: 'html', priority: 2 },

  // --- Influence Map ---
  { id: 'k7-influencemap-climate-policy', domain: 'k7', category: 'InfluenceMap', title: 'InfluenceMap Corporate Climate Policy Engagement', url: 'https://influencemap.org/report/Corporate-Climate-Policy-Engagement', filename: 'influencemap-climate-policy.html', fileType: 'html', priority: 2 },

  // --- GCC Specific Research ---
  { id: 'k7-misk-saudi-esg-landscape', domain: 'k7', category: 'GCC Research', title: 'Saudi ESG Investment Landscape', url: 'https://www.pif.gov.sa/en/strategy/', filename: 'pif-saudi-esg-strategy.html', fileType: 'html', priority: 2 },
  { id: 'k7-adgm-sustainable-finance-agenda', domain: 'k7', category: 'GCC Research', title: 'ADGM Sustainable Finance Regulatory Framework', url: 'https://www.adgm.com/setting-up/sustainable-finance', filename: 'adgm-sustainable-finance.html', fileType: 'html', priority: 2 },
  { id: 'k7-difc-esg-guide', domain: 'k7', category: 'GCC Research', title: 'DIFC ESG and Sustainability Guide', url: 'https://www.difc.ae/business/operating/esg-sustainability/', filename: 'difc-esg-guide.html', fileType: 'html', priority: 2 },
  { id: 'k7-gcc-board-directors-institute', domain: 'k7', category: 'GCC Research', title: 'GCC Board Directors Institute ESG Guide', url: 'https://www.gccbdi.org/resources', filename: 'gccbdi-esg-guide.html', fileType: 'html', priority: 3 },

  // --- Ratings Correlation / Meta-Studies ---
  { id: 'k7-berg-esg-divergence', domain: 'k7', category: 'Academic', title: 'Aggregate Confusion: The Divergence of ESG Ratings (Berg et al.)', url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3438533', filename: 'berg-esg-ratings-divergence.html', fileType: 'html', priority: 2 },
  { id: 'k7-friede-esg-financial-performance', domain: 'k7', category: 'Academic', title: 'ESG and Financial Performance Meta-Study (Friede et al.)', url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2698062', filename: 'friede-esg-financial-performance.html', fileType: 'html', priority: 2 },
  { id: 'k7-khan-materiality-matters', domain: 'k7', category: 'Academic', title: 'Corporate Sustainability: First Evidence on Materiality (Khan et al.)', url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2575912', filename: 'khan-materiality-sustainability.html', fileType: 'html', priority: 2 },

  // --- AI / Tech in ESG ---
  { id: 'k7-msci-ai-esg-2024', domain: 'k7', category: 'Research', title: 'MSCI AI and ESG Data Trends', url: 'https://www.msci.com/research-and-insights/esg-ratings-and-climate-search-tool', filename: 'msci-ai-esg-trends.html', fileType: 'html', priority: 2 },
  { id: 'k7-pwc-state-of-climate-tech-2024', domain: 'k7', category: 'PwC', title: 'PwC State of Climate Tech 2024', url: 'https://www.pwc.com/gx/en/services/sustainability/publications/state-of-climate-tech.html', filename: 'pwc-state-of-climate-tech-2024.html', fileType: 'html', priority: 2 },

  // --- Additional Research ---
  { id: 'k7-accenture-un-global-compact-ceo', domain: 'k7', category: 'Research', title: 'Accenture-UNGC CEO Study on Sustainability 2024', url: 'https://www.accenture.com/us-en/insights/strategy/ungcceostudy', filename: 'accenture-ungc-ceo-sustainability.html', fileType: 'html', priority: 2 },
  { id: 'k7-cdp-science-based-targets-report', domain: 'k7', category: 'CDP', title: 'CDP Science-Based Targets Campaign Report', url: 'https://www.cdp.net/en/research/global-reports/science-based-targets', filename: 'cdp-sbt-campaign-report.html', fileType: 'html', priority: 2 },
  { id: 'k7-fidelity-esg-analyst-survey', domain: 'k7', category: 'Research', title: 'Fidelity Analyst Survey: Sustainability Outlook', url: 'https://www.fidelityinternational.com/editorial/article/sustainability-outlook/', filename: 'fidelity-sustainability-outlook.html', fileType: 'html', priority: 3 },
];

// ============================================================
// K1: Corporate Reports (~260 sources)
// 130 companies x 2 years each
// ============================================================

function k1Entry(
  id: string,
  company: string,
  year: number,
  url: string,
  filename: string,
  priority: number = 2,
  fileType: 'pdf' | 'html' = 'html',
): DownloadTarget {
  return {
    id: `k1-${id}-${year}`,
    domain: 'k1',
    category: 'Corporate Report',
    title: `${company} Sustainability Report ${year}`,
    url,
    filename: `${filename}-${year}.${fileType === 'pdf' ? 'pdf' : 'html'}`,
    fileType,
    priority,
  };
}

const K1_TARGETS: DownloadTarget[] = [
  // ============================================================
  // Saudi Arabia (~30 companies x 2 years = ~60 entries)
  // ============================================================

  // Saudi Aramco
  k1Entry('aramco', 'Saudi Aramco', 2023, 'https://www.aramco.com/-/media/publications/corporate-reports/saudi-aramco-sustainability-report-2023-en.pdf', 'aramco-sustainability', 1, 'pdf'),
  k1Entry('aramco', 'Saudi Aramco', 2024, 'https://www.aramco.com/en/sustainability/sustainability-report', 'aramco-sustainability', 1),

  // SABIC
  k1Entry('sabic', 'SABIC', 2023, 'https://www.sabic.com/en/Images/SABIC-Sustainability-Report-2023-English_tcm1010-39023.pdf', 'sabic-sustainability', 1, 'pdf'),
  k1Entry('sabic', 'SABIC', 2024, 'https://www.sabic.com/en/sustainability', 'sabic-sustainability', 1),

  // STC Group
  k1Entry('stc', 'STC Group', 2023, 'https://www.stc.com.sa/content/dam/stc/pdf/STCSustainabilityReport2023EN.pdf', 'stc-sustainability', 2, 'pdf'),
  k1Entry('stc', 'STC Group', 2024, 'https://www.stc.com.sa/en/about/sustainability', 'stc-sustainability', 2),

  // Saudi Electricity Company (SEC)
  k1Entry('sec', 'Saudi Electricity Company', 2023, 'https://www.se.com.sa/en/sustainability', 'sec-sustainability', 2),
  k1Entry('sec', 'Saudi Electricity Company', 2024, 'https://www.se.com.sa/en/sustainability', 'sec-sustainability', 2),

  // Ma'aden
  k1Entry('maaden', "Ma'aden", 2023, 'https://www.maaden.com.sa/en/sustainability', 'maaden-sustainability', 1),
  k1Entry('maaden', "Ma'aden", 2024, 'https://www.maaden.com.sa/en/sustainability', 'maaden-sustainability', 1),

  // ACWA Power
  k1Entry('acwa', 'ACWA Power', 2023, 'https://acwapower.com/en/sustainability/', 'acwa-power-sustainability', 1),
  k1Entry('acwa', 'ACWA Power', 2024, 'https://acwapower.com/en/sustainability/', 'acwa-power-sustainability', 1),

  // Saudi National Bank (SNB)
  k1Entry('snb', 'Saudi National Bank', 2023, 'https://www.snb.com/en/about-us/sustainability/', 'snb-sustainability', 2),
  k1Entry('snb', 'Saudi National Bank', 2024, 'https://www.snb.com/en/about-us/sustainability/', 'snb-sustainability', 2),

  // Al Rajhi Bank
  k1Entry('alrajhi', 'Al Rajhi Bank', 2023, 'https://www.alrajhibank.com.sa/en/about-us/sustainability', 'alrajhi-sustainability', 2),
  k1Entry('alrajhi', 'Al Rajhi Bank', 2024, 'https://www.alrajhibank.com.sa/en/about-us/sustainability', 'alrajhi-sustainability', 2),

  // Almarai
  k1Entry('almarai', 'Almarai', 2023, 'https://www.almarai.com/sustainability/', 'almarai-sustainability', 2),
  k1Entry('almarai', 'Almarai', 2024, 'https://www.almarai.com/sustainability/', 'almarai-sustainability', 2),

  // Alinma Bank
  k1Entry('alinma', 'Alinma Bank', 2023, 'https://www.alinma.com/en/about-us/sustainability', 'alinma-sustainability', 2),
  k1Entry('alinma', 'Alinma Bank', 2024, 'https://www.alinma.com/en/about-us/sustainability', 'alinma-sustainability', 2),

  // Riyad Bank
  k1Entry('riyadbank', 'Riyad Bank', 2023, 'https://www.riyadbank.com/en/about-us/sustainability', 'riyadbank-sustainability', 2),
  k1Entry('riyadbank', 'Riyad Bank', 2024, 'https://www.riyadbank.com/en/about-us/sustainability', 'riyadbank-sustainability', 2),

  // Banque Saudi Fransi
  k1Entry('bsf', 'Banque Saudi Fransi', 2023, 'https://www.alfransi.com.sa/en/sustainability', 'bsf-sustainability', 3),
  k1Entry('bsf', 'Banque Saudi Fransi', 2024, 'https://www.alfransi.com.sa/en/sustainability', 'bsf-sustainability', 3),

  // SABB
  k1Entry('sabb', 'SABB', 2023, 'https://www.sabb.com/en/about-us/sustainability/', 'sabb-sustainability', 3),
  k1Entry('sabb', 'SABB', 2024, 'https://www.sabb.com/en/about-us/sustainability/', 'sabb-sustainability', 3),

  // Yansab
  k1Entry('yansab', 'Yanbu National Petrochemical', 2023, 'https://www.yansab.com/en/sustainability', 'yansab-sustainability', 2),
  k1Entry('yansab', 'Yanbu National Petrochemical', 2024, 'https://www.yansab.com/en/sustainability', 'yansab-sustainability', 2),

  // NEOM
  k1Entry('neom', 'NEOM', 2023, 'https://www.neom.com/en-us/about', 'neom-sustainability', 2),
  k1Entry('neom', 'NEOM', 2024, 'https://www.neom.com/en-us/about', 'neom-sustainability', 2),

  // Saudi Telecom Company (Mobily)
  k1Entry('mobily', 'Mobily', 2023, 'https://www.mobily.com.sa/en/about-mobily/sustainability.html', 'mobily-sustainability', 3),
  k1Entry('mobily', 'Mobily', 2024, 'https://www.mobily.com.sa/en/about-mobily/sustainability.html', 'mobily-sustainability', 3),

  // Zain KSA
  k1Entry('zainksa', 'Zain KSA', 2023, 'https://sa.zain.com/en/sustainability', 'zainksa-sustainability', 3),
  k1Entry('zainksa', 'Zain KSA', 2024, 'https://sa.zain.com/en/sustainability', 'zainksa-sustainability', 3),

  // ENEC (Saudi power)
  k1Entry('saline', 'Saline Water Conversion Corp', 2023, 'https://www.swcc.gov.sa/en/sustainability', 'swcc-sustainability', 3),
  k1Entry('saline', 'Saline Water Conversion Corp', 2024, 'https://www.swcc.gov.sa/en/sustainability', 'swcc-sustainability', 3),

  // Saudi Aramco Base Oil (Luberef)
  k1Entry('luberef', 'Luberef', 2023, 'https://www.luberef.com/en/sustainability', 'luberef-sustainability', 3),
  k1Entry('luberef', 'Luberef', 2024, 'https://www.luberef.com/en/sustainability', 'luberef-sustainability', 3),

  // Jarir Marketing
  k1Entry('jarir', 'Jarir Marketing', 2023, 'https://www.jarir.com/en-sa/', 'jarir-sustainability', 3),
  k1Entry('jarir', 'Jarir Marketing', 2024, 'https://www.jarir.com/en-sa/', 'jarir-sustainability', 3),

  // SIPCHEM
  k1Entry('sipchem', 'Sahara International Petrochemical (SIPCHEM)', 2023, 'https://www.sipchem.com/sustainability', 'sipchem-sustainability', 2),
  k1Entry('sipchem', 'Sahara International Petrochemical (SIPCHEM)', 2024, 'https://www.sipchem.com/sustainability', 'sipchem-sustainability', 2),

  // Saudi Cement
  k1Entry('saudicement', 'Saudi Cement Company', 2023, 'https://www.saudicement.com.sa/en/sustainability', 'saudicement-sustainability', 3),
  k1Entry('saudicement', 'Saudi Cement Company', 2024, 'https://www.saudicement.com.sa/en/sustainability', 'saudicement-sustainability', 3),

  // Elm
  k1Entry('elm', 'Elm Company', 2023, 'https://www.elm.sa/en/sustainability', 'elm-sustainability', 3),
  k1Entry('elm', 'Elm Company', 2024, 'https://www.elm.sa/en/sustainability', 'elm-sustainability', 3),

  // Saudi Kayan
  k1Entry('saudikayan', 'Saudi Kayan', 2023, 'https://saudikayan.sabic.com/en/sustainability', 'saudikayan-sustainability', 3),
  k1Entry('saudikayan', 'Saudi Kayan', 2024, 'https://saudikayan.sabic.com/en/sustainability', 'saudikayan-sustainability', 3),

  // TASNEE
  k1Entry('tasnee', 'TASNEE', 2023, 'https://www.tasnee.com/en/sustainability/', 'tasnee-sustainability', 3),
  k1Entry('tasnee', 'TASNEE', 2024, 'https://www.tasnee.com/en/sustainability/', 'tasnee-sustainability', 3),

  // Saudi Arabian Mining (Manara)
  k1Entry('manara', 'Manara Minerals', 2023, 'https://www.manaraminerals.com/', 'manara-sustainability', 3),
  k1Entry('manara', 'Manara Minerals', 2024, 'https://www.manaraminerals.com/', 'manara-sustainability', 3),

  // Bupa Arabia
  k1Entry('bupa', 'Bupa Arabia', 2023, 'https://www.bupa.com.sa/en/about-us/sustainability', 'bupa-arabia-sustainability', 3),
  k1Entry('bupa', 'Bupa Arabia', 2024, 'https://www.bupa.com.sa/en/about-us/sustainability', 'bupa-arabia-sustainability', 3),

  // Red Sea Global
  k1Entry('redseaglobal', 'Red Sea Global', 2023, 'https://www.redseaglobal.com/en/sustainability', 'redseaglobal-sustainability', 2),
  k1Entry('redseaglobal', 'Red Sea Global', 2024, 'https://www.redseaglobal.com/en/sustainability', 'redseaglobal-sustainability', 2),

  // PIF (public investment fund)
  k1Entry('pif', 'Public Investment Fund', 2023, 'https://www.pif.gov.sa/en/sustainability/', 'pif-sustainability', 1),
  k1Entry('pif', 'Public Investment Fund', 2024, 'https://www.pif.gov.sa/en/sustainability/', 'pif-sustainability', 1),

  // ============================================================
  // UAE (~25 companies x 2 years = ~50 entries)
  // ============================================================

  // ADNOC
  k1Entry('adnoc', 'ADNOC', 2023, 'https://www.adnoc.ae/-/media/adnoc/files/sustainability/adnoc-sustainability-report-2023.pdf', 'adnoc-sustainability', 1, 'pdf'),
  k1Entry('adnoc', 'ADNOC', 2024, 'https://www.adnoc.ae/en/sustainability', 'adnoc-sustainability', 1),

  // Emirates NBD
  k1Entry('enbd', 'Emirates NBD', 2023, 'https://www.emiratesnbd.com/en/sustainability', 'enbd-sustainability', 1),
  k1Entry('enbd', 'Emirates NBD', 2024, 'https://www.emiratesnbd.com/en/sustainability', 'enbd-sustainability', 1),

  // First Abu Dhabi Bank
  k1Entry('fab', 'First Abu Dhabi Bank', 2023, 'https://www.bankfab.com/en-ae/about-fab/sustainability', 'fab-sustainability', 1),
  k1Entry('fab', 'First Abu Dhabi Bank', 2024, 'https://www.bankfab.com/en-ae/about-fab/sustainability', 'fab-sustainability', 1),

  // Etisalat (e&)
  k1Entry('eand', 'e& (Etisalat)', 2023, 'https://www.eand.com/en/sustainability.jsp', 'eand-sustainability', 1),
  k1Entry('eand', 'e& (Etisalat)', 2024, 'https://www.eand.com/en/sustainability.jsp', 'eand-sustainability', 1),

  // du (EITC)
  k1Entry('du', 'du (EITC)', 2023, 'https://www.du.ae/about/sustainability', 'du-sustainability', 2),
  k1Entry('du', 'du (EITC)', 2024, 'https://www.du.ae/about/sustainability', 'du-sustainability', 2),

  // Masdar
  k1Entry('masdar', 'Masdar', 2023, 'https://masdar.ae/en/sustainability', 'masdar-sustainability', 1),
  k1Entry('masdar', 'Masdar', 2024, 'https://masdar.ae/en/sustainability', 'masdar-sustainability', 1),

  // DEWA
  k1Entry('dewa', 'DEWA', 2023, 'https://www.dewa.gov.ae/en/about-us/sustainability', 'dewa-sustainability', 1),
  k1Entry('dewa', 'DEWA', 2024, 'https://www.dewa.gov.ae/en/about-us/sustainability', 'dewa-sustainability', 1),

  // Abu Dhabi Islamic Bank
  k1Entry('adib', 'Abu Dhabi Islamic Bank', 2023, 'https://www.adib.ae/en/about-adib/sustainability', 'adib-sustainability', 2),
  k1Entry('adib', 'Abu Dhabi Islamic Bank', 2024, 'https://www.adib.ae/en/about-adib/sustainability', 'adib-sustainability', 2),

  // Mubadala
  k1Entry('mubadala', 'Mubadala', 2023, 'https://www.mubadala.com/en/who-we-are/responsible-investing', 'mubadala-sustainability', 1),
  k1Entry('mubadala', 'Mubadala', 2024, 'https://www.mubadala.com/en/who-we-are/responsible-investing', 'mubadala-sustainability', 1),

  // DP World
  k1Entry('dpworld', 'DP World', 2023, 'https://www.dpworld.com/sustainability/', 'dpworld-sustainability', 1),
  k1Entry('dpworld', 'DP World', 2024, 'https://www.dpworld.com/sustainability/', 'dpworld-sustainability', 1),

  // ENEC (UAE nuclear)
  k1Entry('enec', 'Emirates Nuclear Energy Corp', 2023, 'https://www.enec.gov.ae/sustainability/', 'enec-sustainability', 2),
  k1Entry('enec', 'Emirates Nuclear Energy Corp', 2024, 'https://www.enec.gov.ae/sustainability/', 'enec-sustainability', 2),

  // Emaar Properties
  k1Entry('emaar', 'Emaar Properties', 2023, 'https://www.emaar.com/en/sustainability', 'emaar-sustainability', 2),
  k1Entry('emaar', 'Emaar Properties', 2024, 'https://www.emaar.com/en/sustainability', 'emaar-sustainability', 2),

  // Aldar Properties
  k1Entry('aldar', 'Aldar Properties', 2023, 'https://www.aldar.com/en/sustainability', 'aldar-sustainability', 2),
  k1Entry('aldar', 'Aldar Properties', 2024, 'https://www.aldar.com/en/sustainability', 'aldar-sustainability', 2),

  // Dana Gas
  k1Entry('danagas', 'Dana Gas', 2023, 'https://www.danagas.com/en/sustainability', 'danagas-sustainability', 3),
  k1Entry('danagas', 'Dana Gas', 2024, 'https://www.danagas.com/en/sustainability', 'danagas-sustainability', 3),

  // TAQA
  k1Entry('taqa', 'TAQA', 2023, 'https://www.taqa.com/sustainability/', 'taqa-sustainability', 1),
  k1Entry('taqa', 'TAQA', 2024, 'https://www.taqa.com/sustainability/', 'taqa-sustainability', 1),

  // Abu Dhabi Ports (AD Ports)
  k1Entry('adports', 'AD Ports Group', 2023, 'https://www.adportsgroup.com/en/sustainability', 'adports-sustainability', 2),
  k1Entry('adports', 'AD Ports Group', 2024, 'https://www.adportsgroup.com/en/sustainability', 'adports-sustainability', 2),

  // Agthia
  k1Entry('agthia', 'Agthia Group', 2023, 'https://www.agthia.com/sustainability/', 'agthia-sustainability', 3),
  k1Entry('agthia', 'Agthia Group', 2024, 'https://www.agthia.com/sustainability/', 'agthia-sustainability', 3),

  // ADNOC Drilling
  k1Entry('adnoc-drilling', 'ADNOC Drilling', 2023, 'https://www.adnocdrilling.ae/en/sustainability', 'adnoc-drilling-sustainability', 2),
  k1Entry('adnoc-drilling', 'ADNOC Drilling', 2024, 'https://www.adnocdrilling.ae/en/sustainability', 'adnoc-drilling-sustainability', 2),

  // Borouge
  k1Entry('borouge', 'Borouge', 2023, 'https://www.borouge.com/sustainability/', 'borouge-sustainability', 2),
  k1Entry('borouge', 'Borouge', 2024, 'https://www.borouge.com/sustainability/', 'borouge-sustainability', 2),

  // Fertiglobe
  k1Entry('fertiglobe', 'Fertiglobe', 2023, 'https://www.fertiglobe.com/sustainability', 'fertiglobe-sustainability', 2),
  k1Entry('fertiglobe', 'Fertiglobe', 2024, 'https://www.fertiglobe.com/sustainability', 'fertiglobe-sustainability', 2),

  // Etihad Airways
  k1Entry('etihad', 'Etihad Airways', 2023, 'https://www.etihad.com/en/about-us/sustainability', 'etihad-sustainability', 2),
  k1Entry('etihad', 'Etihad Airways', 2024, 'https://www.etihad.com/en/about-us/sustainability', 'etihad-sustainability', 2),

  // Emirates Airlines
  k1Entry('emirates', 'Emirates Airlines', 2023, 'https://www.emirates.com/us/english/about-us/sustainability/', 'emirates-sustainability', 2),
  k1Entry('emirates', 'Emirates Airlines', 2024, 'https://www.emirates.com/us/english/about-us/sustainability/', 'emirates-sustainability', 2),

  // Sharjah National Oil Corp
  k1Entry('snoc', 'SNOC', 2023, 'https://www.snoc.ae/sustainability', 'snoc-sustainability', 3),
  k1Entry('snoc', 'SNOC', 2024, 'https://www.snoc.ae/sustainability', 'snoc-sustainability', 3),

  // DIB
  k1Entry('dib', 'Dubai Islamic Bank', 2023, 'https://www.dib.ae/about-us/sustainability', 'dib-sustainability', 2),
  k1Entry('dib', 'Dubai Islamic Bank', 2024, 'https://www.dib.ae/about-us/sustainability', 'dib-sustainability', 2),

  // EWEC
  k1Entry('ewec', 'Emirates Water and Electricity Company', 2023, 'https://www.ewec.ae/en/sustainability', 'ewec-sustainability', 3),
  k1Entry('ewec', 'Emirates Water and Electricity Company', 2024, 'https://www.ewec.ae/en/sustainability', 'ewec-sustainability', 3),

  // ============================================================
  // Qatar (~15 companies x 2 years = ~30 entries)
  // ============================================================

  // QatarEnergy
  k1Entry('qatarenergy', 'QatarEnergy', 2023, 'https://www.qatarenergy.qa/en/sustainability', 'qatarenergy-sustainability', 1),
  k1Entry('qatarenergy', 'QatarEnergy', 2024, 'https://www.qatarenergy.qa/en/sustainability', 'qatarenergy-sustainability', 1),

  // Qatar National Bank
  k1Entry('qnb', 'Qatar National Bank', 2023, 'https://www.qnb.com/sites/qnb/qnbglobal/page/en/ensustainability.html', 'qnb-sustainability', 1),
  k1Entry('qnb', 'Qatar National Bank', 2024, 'https://www.qnb.com/sites/qnb/qnbglobal/page/en/ensustainability.html', 'qnb-sustainability', 1),

  // Industries Qatar
  k1Entry('iq', 'Industries Qatar', 2023, 'https://www.iq.com.qa/English/OurSustainability/', 'iq-sustainability', 1),
  k1Entry('iq', 'Industries Qatar', 2024, 'https://www.iq.com.qa/English/OurSustainability/', 'iq-sustainability', 1),

  // Ooredoo
  k1Entry('ooredoo', 'Ooredoo Group', 2023, 'https://www.ooredoo.com/en/sustainability/', 'ooredoo-sustainability', 2),
  k1Entry('ooredoo', 'Ooredoo Group', 2024, 'https://www.ooredoo.com/en/sustainability/', 'ooredoo-sustainability', 2),

  // Qatar Airways
  k1Entry('qatar-airways', 'Qatar Airways', 2023, 'https://www.qatarairways.com/en/sustainability.html', 'qatar-airways-sustainability', 2),
  k1Entry('qatar-airways', 'Qatar Airways', 2024, 'https://www.qatarairways.com/en/sustainability.html', 'qatar-airways-sustainability', 2),

  // QNB Finansbank
  k1Entry('qnbfinansibank', 'QNB Finansbank', 2023, 'https://www.qnbfinansbank.com/en/about-us/sustainability', 'qnbfinansibank-sustainability', 3),
  k1Entry('qnbfinansibank', 'QNB Finansbank', 2024, 'https://www.qnbfinansbank.com/en/about-us/sustainability', 'qnbfinansibank-sustainability', 3),

  // Nakilat
  k1Entry('nakilat', 'Nakilat', 2023, 'https://www.nakilat.com/sustainability/', 'nakilat-sustainability', 2),
  k1Entry('nakilat', 'Nakilat', 2024, 'https://www.nakilat.com/sustainability/', 'nakilat-sustainability', 2),

  // QFC
  k1Entry('qfc', 'Qatar Financial Centre', 2023, 'https://www.qfc.qa/en/sustainability', 'qfc-sustainability', 3),
  k1Entry('qfc', 'Qatar Financial Centre', 2024, 'https://www.qfc.qa/en/sustainability', 'qfc-sustainability', 3),

  // Qatar Petroleum (now QatarEnergy Trading)
  k1Entry('qetl', 'QatarEnergy Trading', 2023, 'https://qatarenergy.qa/en/sustainability', 'qetl-sustainability', 2),
  k1Entry('qetl', 'QatarEnergy Trading', 2024, 'https://qatarenergy.qa/en/sustainability', 'qetl-sustainability', 2),

  // Mesaieed Petrochemical
  k1Entry('mphc', 'Mesaieed Petrochemical (MPHC)', 2023, 'https://www.mphc.com.qa/en/sustainability', 'mphc-sustainability', 3),
  k1Entry('mphc', 'Mesaieed Petrochemical (MPHC)', 2024, 'https://www.mphc.com.qa/en/sustainability', 'mphc-sustainability', 3),

  // Qatar Insurance
  k1Entry('qic', 'Qatar Insurance Company', 2023, 'https://www.qic-insure.com/sustainability/', 'qic-sustainability', 3),
  k1Entry('qic', 'Qatar Insurance Company', 2024, 'https://www.qic-insure.com/sustainability/', 'qic-sustainability', 3),

  // Barwa Real Estate
  k1Entry('barwa', 'Barwa Real Estate', 2023, 'https://www.barwa.com.qa/sustainability', 'barwa-sustainability', 3),
  k1Entry('barwa', 'Barwa Real Estate', 2024, 'https://www.barwa.com.qa/sustainability', 'barwa-sustainability', 3),

  // Qatar Gas Transport (Milaha)
  k1Entry('milaha', 'Milaha', 2023, 'https://www.milaha.com/sustainability', 'milaha-sustainability', 3),
  k1Entry('milaha', 'Milaha', 2024, 'https://www.milaha.com/sustainability', 'milaha-sustainability', 3),

  // Woqod
  k1Entry('woqod', 'Woqod (QP)', 2023, 'https://www.woqod.com/EN/sustainability', 'woqod-sustainability', 3),
  k1Entry('woqod', 'Woqod (QP)', 2024, 'https://www.woqod.com/EN/sustainability', 'woqod-sustainability', 3),

  // Vodafone Qatar
  k1Entry('vodafoneqatar', 'Vodafone Qatar', 2023, 'https://www.vodafone.qa/en/about-us/sustainability', 'vodafone-qatar-sustainability', 3),
  k1Entry('vodafoneqatar', 'Vodafone Qatar', 2024, 'https://www.vodafone.qa/en/about-us/sustainability', 'vodafone-qatar-sustainability', 3),

  // ============================================================
  // Kuwait (~10 companies x 2 years = ~20 entries)
  // ============================================================

  // KPC
  k1Entry('kpc', 'Kuwait Petroleum Corporation', 2023, 'https://www.kpc.com.kw/sustainability/', 'kpc-sustainability', 1),
  k1Entry('kpc', 'Kuwait Petroleum Corporation', 2024, 'https://www.kpc.com.kw/sustainability/', 'kpc-sustainability', 1),

  // National Bank of Kuwait
  k1Entry('nbk', 'National Bank of Kuwait', 2023, 'https://www.nbk.com/group/sustainability.html', 'nbk-sustainability', 1),
  k1Entry('nbk', 'National Bank of Kuwait', 2024, 'https://www.nbk.com/group/sustainability.html', 'nbk-sustainability', 1),

  // Zain Group
  k1Entry('zain', 'Zain Group', 2023, 'https://www.zain.com/en/sustainability/', 'zain-sustainability', 2),
  k1Entry('zain', 'Zain Group', 2024, 'https://www.zain.com/en/sustainability/', 'zain-sustainability', 2),

  // Kuwait Finance House
  k1Entry('kfh', 'Kuwait Finance House', 2023, 'https://www.kfh.com/en/about-kfh/sustainability.html', 'kfh-sustainability', 2),
  k1Entry('kfh', 'Kuwait Finance House', 2024, 'https://www.kfh.com/en/about-kfh/sustainability.html', 'kfh-sustainability', 2),

  // Agility
  k1Entry('agility', 'Agility', 2023, 'https://www.agility.com/en/sustainability/', 'agility-sustainability', 2),
  k1Entry('agility', 'Agility', 2024, 'https://www.agility.com/en/sustainability/', 'agility-sustainability', 2),

  // EQUATE Petrochemical
  k1Entry('equate', 'EQUATE Petrochemical', 2023, 'https://www.equate.com/sustainability/', 'equate-sustainability', 3),
  k1Entry('equate', 'EQUATE Petrochemical', 2024, 'https://www.equate.com/sustainability/', 'equate-sustainability', 3),

  // Gulf Bank
  k1Entry('gulfbank', 'Gulf Bank', 2023, 'https://www.e-gulfbank.com/en/about-us/sustainability', 'gulfbank-sustainability', 3),
  k1Entry('gulfbank', 'Gulf Bank', 2024, 'https://www.e-gulfbank.com/en/about-us/sustainability', 'gulfbank-sustainability', 3),

  // Boubyan Bank
  k1Entry('boubyan', 'Boubyan Bank', 2023, 'https://www.bankboubyan.com/en/about/sustainability/', 'boubyan-sustainability', 3),
  k1Entry('boubyan', 'Boubyan Bank', 2024, 'https://www.bankboubyan.com/en/about/sustainability/', 'boubyan-sustainability', 3),

  // Kuwait Projects Company (KIPCO)
  k1Entry('kipco', 'KIPCO', 2023, 'https://www.kipco.com/sustainability/', 'kipco-sustainability', 3),
  k1Entry('kipco', 'KIPCO', 2024, 'https://www.kipco.com/sustainability/', 'kipco-sustainability', 3),

  // Mezzan Holding
  k1Entry('mezzan', 'Mezzan Holding', 2023, 'https://www.mezzanholding.com/sustainability/', 'mezzan-sustainability', 3),
  k1Entry('mezzan', 'Mezzan Holding', 2024, 'https://www.mezzanholding.com/sustainability/', 'mezzan-sustainability', 3),

  // ============================================================
  // Bahrain (~8 companies x 2 years = ~16 entries)
  // ============================================================

  // Bahrain Petroleum (BAPCO)
  k1Entry('bapco', 'BAPCO Energies', 2023, 'https://www.bapco.net/en/sustainability/', 'bapco-sustainability', 1),
  k1Entry('bapco', 'BAPCO Energies', 2024, 'https://www.bapco.net/en/sustainability/', 'bapco-sustainability', 1),

  // Ahli United Bank
  k1Entry('aub', 'Ahli United Bank', 2023, 'https://www.aub.com.bh/sustainability', 'aub-sustainability', 2),
  k1Entry('aub', 'Ahli United Bank', 2024, 'https://www.aub.com.bh/sustainability', 'aub-sustainability', 2),

  // National Bank of Bahrain
  k1Entry('nbb', 'National Bank of Bahrain', 2023, 'https://www.nbbonline.com/en/sustainability', 'nbb-sustainability', 2),
  k1Entry('nbb', 'National Bank of Bahrain', 2024, 'https://www.nbbonline.com/en/sustainability', 'nbb-sustainability', 2),

  // Aluminium Bahrain (Alba)
  k1Entry('alba', 'Aluminium Bahrain (Alba)', 2023, 'https://www.albasmelter.com/sustainability', 'alba-sustainability', 2),
  k1Entry('alba', 'Aluminium Bahrain (Alba)', 2024, 'https://www.albasmelter.com/sustainability', 'alba-sustainability', 2),

  // Bahrain Telecom (Batelco/Beyon)
  k1Entry('beyon', 'Beyon (Batelco)', 2023, 'https://www.beyon.com/sustainability/', 'beyon-sustainability', 3),
  k1Entry('beyon', 'Beyon (Batelco)', 2024, 'https://www.beyon.com/sustainability/', 'beyon-sustainability', 3),

  // GFH Financial Group
  k1Entry('gfh', 'GFH Financial Group', 2023, 'https://www.gfh.com/en/sustainability/', 'gfh-sustainability', 3),
  k1Entry('gfh', 'GFH Financial Group', 2024, 'https://www.gfh.com/en/sustainability/', 'gfh-sustainability', 3),

  // Ithmaar Bank
  k1Entry('ithmaar', 'Ithmaar Holding', 2023, 'https://www.ithmaarholding.com/sustainability', 'ithmaar-sustainability', 3),
  k1Entry('ithmaar', 'Ithmaar Holding', 2024, 'https://www.ithmaarholding.com/sustainability', 'ithmaar-sustainability', 3),

  // GPIC
  k1Entry('gpic', 'Gulf Petrochemical Industries (GPIC)', 2023, 'https://www.gpic.com/sustainability/', 'gpic-sustainability', 3),
  k1Entry('gpic', 'Gulf Petrochemical Industries (GPIC)', 2024, 'https://www.gpic.com/sustainability/', 'gpic-sustainability', 3),

  // ============================================================
  // Oman (~8 companies x 2 years = ~16 entries)
  // ============================================================

  // OQ (formerly Oman Oil)
  k1Entry('oq', 'OQ Group', 2023, 'https://oq.com/en/sustainability', 'oq-sustainability', 1),
  k1Entry('oq', 'OQ Group', 2024, 'https://oq.com/en/sustainability', 'oq-sustainability', 1),

  // Bank Muscat
  k1Entry('bankmuscat', 'Bank Muscat', 2023, 'https://www.bankmuscat.com/en/sustainability', 'bankmuscat-sustainability', 2),
  k1Entry('bankmuscat', 'Bank Muscat', 2024, 'https://www.bankmuscat.com/en/sustainability', 'bankmuscat-sustainability', 2),

  // Omantel
  k1Entry('omantel', 'Omantel', 2023, 'https://www.omantel.om/en/sustainability', 'omantel-sustainability', 2),
  k1Entry('omantel', 'Omantel', 2024, 'https://www.omantel.om/en/sustainability', 'omantel-sustainability', 2),

  // Petroleum Development Oman
  k1Entry('pdo', 'Petroleum Development Oman', 2023, 'https://www.pdo.co.om/en/sustainability/', 'pdo-sustainability', 1),
  k1Entry('pdo', 'Petroleum Development Oman', 2024, 'https://www.pdo.co.om/en/sustainability/', 'pdo-sustainability', 1),

  // Oman LNG
  k1Entry('omanlng', 'Oman LNG', 2023, 'https://www.omanlng.com/en/sustainability', 'omanlng-sustainability', 2),
  k1Entry('omanlng', 'Oman LNG', 2024, 'https://www.omanlng.com/en/sustainability', 'omanlng-sustainability', 2),

  // Sohar Aluminium
  k1Entry('sohar', 'Sohar Aluminium', 2023, 'https://www.sohar-aluminium.com/sustainability/', 'sohar-aluminium-sustainability', 3),
  k1Entry('sohar', 'Sohar Aluminium', 2024, 'https://www.sohar-aluminium.com/sustainability/', 'sohar-aluminium-sustainability', 3),

  // National Bank of Oman
  k1Entry('nbo', 'National Bank of Oman', 2023, 'https://www.nbo.om/en/about-us/sustainability', 'nbo-sustainability', 3),
  k1Entry('nbo', 'National Bank of Oman', 2024, 'https://www.nbo.om/en/about-us/sustainability', 'nbo-sustainability', 3),

  // OQ Gas Networks (OQGN)
  k1Entry('oqgn', 'OQ Gas Networks', 2023, 'https://www.oqgn.com/sustainability', 'oqgn-sustainability', 3),
  k1Entry('oqgn', 'OQ Gas Networks', 2024, 'https://www.oqgn.com/sustainability', 'oqgn-sustainability', 3),

  // ============================================================
  // Global Reference Companies (~35 companies x 2 years = ~70 entries)
  // Top global sustainability reporters for benchmarking
  // ============================================================

  // Shell
  k1Entry('shell', 'Shell', 2023, 'https://reports.shell.com/sustainability-report/2023/_assets/downloads/shell-sustainability-report-2023.pdf', 'shell-sustainability', 1, 'pdf'),
  k1Entry('shell', 'Shell', 2024, 'https://www.shell.com/sustainability/sustainability-reporting', 'shell-sustainability', 1),

  // BP
  k1Entry('bp', 'BP', 2023, 'https://www.bp.com/content/dam/bp/business-sites/en/global/corporate/pdfs/sustainability/group-reports/bp-sustainability-report-2023.pdf', 'bp-sustainability', 1, 'pdf'),
  k1Entry('bp', 'BP', 2024, 'https://www.bp.com/en/global/corporate/sustainability', 'bp-sustainability', 1),

  // TotalEnergies
  k1Entry('total', 'TotalEnergies', 2023, 'https://totalenergies.com/sustainability/reports-and-indicators', 'total-sustainability', 1),
  k1Entry('total', 'TotalEnergies', 2024, 'https://totalenergies.com/sustainability/reports-and-indicators', 'total-sustainability', 1),

  // ExxonMobil
  k1Entry('exxon', 'ExxonMobil', 2023, 'https://corporate.exxonmobil.com/sustainability-and-reports/sustainability-report', 'exxon-sustainability', 1),
  k1Entry('exxon', 'ExxonMobil', 2024, 'https://corporate.exxonmobil.com/sustainability-and-reports/sustainability-report', 'exxon-sustainability', 1),

  // Chevron
  k1Entry('chevron', 'Chevron', 2023, 'https://www.chevron.com/sustainability', 'chevron-sustainability', 2),
  k1Entry('chevron', 'Chevron', 2024, 'https://www.chevron.com/sustainability', 'chevron-sustainability', 2),

  // Eni
  k1Entry('eni', 'Eni', 2023, 'https://www.eni.com/en-IT/sustainability.html', 'eni-sustainability', 2),
  k1Entry('eni', 'Eni', 2024, 'https://www.eni.com/en-IT/sustainability.html', 'eni-sustainability', 2),

  // Equinor
  k1Entry('equinor', 'Equinor', 2023, 'https://www.equinor.com/sustainability', 'equinor-sustainability', 2),
  k1Entry('equinor', 'Equinor', 2024, 'https://www.equinor.com/sustainability', 'equinor-sustainability', 2),

  // Repsol
  k1Entry('repsol', 'Repsol', 2023, 'https://www.repsol.com/en/sustainability/', 'repsol-sustainability', 2),
  k1Entry('repsol', 'Repsol', 2024, 'https://www.repsol.com/en/sustainability/', 'repsol-sustainability', 2),

  // Microsoft
  k1Entry('microsoft', 'Microsoft', 2023, 'https://www.microsoft.com/en-us/corporate-responsibility/sustainability', 'microsoft-sustainability', 1),
  k1Entry('microsoft', 'Microsoft', 2024, 'https://www.microsoft.com/en-us/corporate-responsibility/sustainability', 'microsoft-sustainability', 1),

  // Apple
  k1Entry('apple', 'Apple', 2023, 'https://www.apple.com/environment/', 'apple-sustainability', 1),
  k1Entry('apple', 'Apple', 2024, 'https://www.apple.com/environment/', 'apple-sustainability', 1),

  // Google (Alphabet)
  k1Entry('google', 'Alphabet (Google)', 2023, 'https://sustainability.google/reports/', 'google-sustainability', 1),
  k1Entry('google', 'Alphabet (Google)', 2024, 'https://sustainability.google/reports/', 'google-sustainability', 1),

  // Amazon
  k1Entry('amazon', 'Amazon', 2023, 'https://sustainability.aboutamazon.com/', 'amazon-sustainability', 1),
  k1Entry('amazon', 'Amazon', 2024, 'https://sustainability.aboutamazon.com/', 'amazon-sustainability', 1),

  // Unilever
  k1Entry('unilever', 'Unilever', 2023, 'https://www.unilever.com/planet-and-society/', 'unilever-sustainability', 1),
  k1Entry('unilever', 'Unilever', 2024, 'https://www.unilever.com/planet-and-society/', 'unilever-sustainability', 1),

  // Nestle
  k1Entry('nestle', 'Nestle', 2023, 'https://www.nestle.com/sustainability', 'nestle-sustainability', 1),
  k1Entry('nestle', 'Nestle', 2024, 'https://www.nestle.com/sustainability', 'nestle-sustainability', 1),

  // Siemens
  k1Entry('siemens', 'Siemens', 2023, 'https://www.siemens.com/global/en/company/sustainability.html', 'siemens-sustainability', 2),
  k1Entry('siemens', 'Siemens', 2024, 'https://www.siemens.com/global/en/company/sustainability.html', 'siemens-sustainability', 2),

  // Schneider Electric
  k1Entry('schneider', 'Schneider Electric', 2023, 'https://www.se.com/ww/en/about-us/sustainability/', 'schneider-sustainability', 2),
  k1Entry('schneider', 'Schneider Electric', 2024, 'https://www.se.com/ww/en/about-us/sustainability/', 'schneider-sustainability', 2),

  // BHP
  k1Entry('bhp', 'BHP', 2023, 'https://www.bhp.com/sustainability', 'bhp-sustainability', 2),
  k1Entry('bhp', 'BHP', 2024, 'https://www.bhp.com/sustainability', 'bhp-sustainability', 2),

  // Rio Tinto
  k1Entry('riotinto', 'Rio Tinto', 2023, 'https://www.riotinto.com/sustainability', 'riotinto-sustainability', 2),
  k1Entry('riotinto', 'Rio Tinto', 2024, 'https://www.riotinto.com/sustainability', 'riotinto-sustainability', 2),

  // Glencore
  k1Entry('glencore', 'Glencore', 2023, 'https://www.glencore.com/sustainability', 'glencore-sustainability', 2),
  k1Entry('glencore', 'Glencore', 2024, 'https://www.glencore.com/sustainability', 'glencore-sustainability', 2),

  // HSBC
  k1Entry('hsbc', 'HSBC', 2023, 'https://www.hsbc.com/who-we-are/esg-and-responsible-business', 'hsbc-sustainability', 2),
  k1Entry('hsbc', 'HSBC', 2024, 'https://www.hsbc.com/who-we-are/esg-and-responsible-business', 'hsbc-sustainability', 2),

  // Standard Chartered
  k1Entry('stanchart', 'Standard Chartered', 2023, 'https://www.sc.com/en/sustainability/', 'stanchart-sustainability', 2),
  k1Entry('stanchart', 'Standard Chartered', 2024, 'https://www.sc.com/en/sustainability/', 'stanchart-sustainability', 2),

  // BlackRock
  k1Entry('blackrock', 'BlackRock', 2023, 'https://www.blackrock.com/corporate/sustainability', 'blackrock-sustainability', 2),
  k1Entry('blackrock', 'BlackRock', 2024, 'https://www.blackrock.com/corporate/sustainability', 'blackrock-sustainability', 2),

  // JPMorgan
  k1Entry('jpmorgan', 'JPMorgan Chase', 2023, 'https://www.jpmorganchase.com/impact/sustainability', 'jpmorgan-sustainability', 2),
  k1Entry('jpmorgan', 'JPMorgan Chase', 2024, 'https://www.jpmorganchase.com/impact/sustainability', 'jpmorgan-sustainability', 2),

  // Maersk
  k1Entry('maersk', 'Maersk', 2023, 'https://www.maersk.com/sustainability', 'maersk-sustainability', 2),
  k1Entry('maersk', 'Maersk', 2024, 'https://www.maersk.com/sustainability', 'maersk-sustainability', 2),

  // BASF
  k1Entry('basf', 'BASF', 2023, 'https://www.basf.com/global/en/who-we-are/sustainability.html', 'basf-sustainability', 2),
  k1Entry('basf', 'BASF', 2024, 'https://www.basf.com/global/en/who-we-are/sustainability.html', 'basf-sustainability', 2),

  // Danone
  k1Entry('danone', 'Danone', 2023, 'https://www.danone.com/impact/sustainability-goals.html', 'danone-sustainability', 2),
  k1Entry('danone', 'Danone', 2024, 'https://www.danone.com/impact/sustainability-goals.html', 'danone-sustainability', 2),

  // IKEA (Ingka)
  k1Entry('ikea', 'IKEA (Ingka Group)', 2023, 'https://www.ingka.com/sustainability/', 'ikea-sustainability', 2),
  k1Entry('ikea', 'IKEA (Ingka Group)', 2024, 'https://www.ingka.com/sustainability/', 'ikea-sustainability', 2),

  // Toyota
  k1Entry('toyota', 'Toyota', 2023, 'https://global.toyota/en/sustainability/', 'toyota-sustainability', 2),
  k1Entry('toyota', 'Toyota', 2024, 'https://global.toyota/en/sustainability/', 'toyota-sustainability', 2),

  // Volkswagen
  k1Entry('vw', 'Volkswagen Group', 2023, 'https://www.volkswagen-group.com/en/sustainability-15742', 'vw-sustainability', 2),
  k1Entry('vw', 'Volkswagen Group', 2024, 'https://www.volkswagen-group.com/en/sustainability-15742', 'vw-sustainability', 2),

  // Samsung
  k1Entry('samsung', 'Samsung Electronics', 2023, 'https://www.samsung.com/global/sustainability/', 'samsung-sustainability', 2),
  k1Entry('samsung', 'Samsung Electronics', 2024, 'https://www.samsung.com/global/sustainability/', 'samsung-sustainability', 2),

  // Vale
  k1Entry('vale', 'Vale', 2023, 'https://www.vale.com/sustainability', 'vale-sustainability', 2),
  k1Entry('vale', 'Vale', 2024, 'https://www.vale.com/sustainability', 'vale-sustainability', 2),

  // LafargeHolcim
  k1Entry('holcim', 'Holcim', 2023, 'https://www.holcim.com/sustainability', 'holcim-sustainability', 2),
  k1Entry('holcim', 'Holcim', 2024, 'https://www.holcim.com/sustainability', 'holcim-sustainability', 2),

  // Orsted
  k1Entry('orsted', 'Orsted', 2023, 'https://orsted.com/en/sustainability', 'orsted-sustainability', 2),
  k1Entry('orsted', 'Orsted', 2024, 'https://orsted.com/en/sustainability', 'orsted-sustainability', 2),

  // Iberdrola
  k1Entry('iberdrola', 'Iberdrola', 2023, 'https://www.iberdrola.com/sustainability', 'iberdrola-sustainability', 2),
  k1Entry('iberdrola', 'Iberdrola', 2024, 'https://www.iberdrola.com/sustainability', 'iberdrola-sustainability', 2),

  // Enel
  k1Entry('enel', 'Enel', 2023, 'https://www.enel.com/investors/sustainability', 'enel-sustainability', 2),
  k1Entry('enel', 'Enel', 2024, 'https://www.enel.com/investors/sustainability', 'enel-sustainability', 2),

  // Engie
  k1Entry('engie', 'ENGIE', 2023, 'https://www.engie.com/en/csr', 'engie-sustainability', 3),
  k1Entry('engie', 'ENGIE', 2024, 'https://www.engie.com/en/csr', 'engie-sustainability', 3),
];

// ============================================================
// Aggregate export
// ============================================================

export const KB_DOWNLOAD_TARGETS: DownloadTarget[] = [
  // Phase A: Frameworks & Standards (K2-K7)
  ...K2_TARGETS,
  ...K3_TARGETS,
  ...K4_TARGETS,
  ...K5_TARGETS,
  ...K6_TARGETS,
  ...K7_TARGETS,
  // Phase B: Corporate Reports (K1)
  ...K1_TARGETS,
];

/** Convenience lookup by domain */
export function getTargetsByDomain(domain: DownloadTarget['domain']): DownloadTarget[] {
  return KB_DOWNLOAD_TARGETS.filter((t) => t.domain === domain);
}

/** Domains in recommended download order */
export const PHASE_A_DOMAINS: DownloadTarget['domain'][] = ['k2', 'k3', 'k4', 'k5', 'k6', 'k7'];
export const PHASE_B_DOMAINS: DownloadTarget['domain'][] = ['k1'];
