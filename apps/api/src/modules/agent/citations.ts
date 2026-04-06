import type { ToolCall, CitationItem } from '@merris/shared';

// ============================================================
// Types
// ============================================================

export interface Citation {
  id: string;
  title: string;
  source: string;
  year: number;
  url?: string;
  domain: string;
  entryId: string;
  excerpt: string;
  verified: boolean;
}

// ============================================================
// Tool Citation Map
// ============================================================

export const TOOL_CITATION_MAP: Record<string, { title: string; source: string; year: number; url: string; domain: string; verified: boolean }> = {
  'get_water_stress': { title: 'WRI Aqueduct 4.0 Water Risk Atlas', source: 'World Resources Institute', year: 2023, url: 'https://www.wri.org/data/aqueduct-global-maps-40-data', domain: 'K5', verified: true },
  'get_climate_vulnerability': { title: 'ND-GAIN Country Index', source: 'Notre Dame Global Adaptation Initiative', year: 2023, url: 'https://gain.nd.edu/our-work/country-index/', domain: 'K2', verified: true },
  'get_forced_labour_risk': { title: 'Global Slavery Index 2023', source: 'Walk Free Foundation', year: 2023, url: 'https://www.walkfree.org/global-slavery-index/', domain: 'K6', verified: true },
  'get_sbti_status': { title: 'SBTi Companies Taking Action', source: 'Science Based Targets initiative', year: 2024, url: 'https://sciencebasedtargets.org/companies-taking-action', domain: 'K1', verified: true },
  'get_emission_factor': { title: 'IEA Emission Factors 2023', source: 'International Energy Agency', year: 2023, url: 'https://www.iea.org/data-and-statistics', domain: 'K2', verified: true },
  'get_product_labour_risk': { title: 'List of Goods Produced by Child Labor or Forced Labor', source: 'US Department of Labor, ILAB', year: 2024, url: 'https://www.dol.gov/agencies/ilab/reports/child-labor/list-of-goods', domain: 'K6', verified: true },
  'get_emission_factor_live': { title: 'Climatiq Emission Factor Database', source: 'Climatiq', year: 2024, url: 'https://www.climatiq.io/', domain: 'K2', verified: true },
  'get_threatened_species': { title: 'IUCN Red List of Threatened Species', source: 'International Union for Conservation of Nature', year: 2024, url: 'https://www.iucnredlist.org/', domain: 'K5', verified: true },
  'get_species_near': { title: 'GBIF Species Occurrences', source: 'Global Biodiversity Information Facility', year: 2024, url: 'https://www.gbif.org/', domain: 'K5', verified: true },
  'calculate': { title: 'GHG Protocol Calculation Methodology', source: 'GHG Protocol / WRI / WBCSD', year: 2024, url: 'https://ghgprotocol.org/', domain: 'K2', verified: true },
  'get_precedent': { title: 'Merris Precedent Case Library', source: 'Merris ESG Intelligence', year: 2024, url: '', domain: 'K3', verified: true },
  'get_anomaly_check': { title: 'Sector Benchmark Reference Data', source: 'worldsteel/IEA/GCCA/IOGP', year: 2024, url: '', domain: 'K2', verified: true },
  'get_partner_insight': { title: 'Merris Partner Intelligence', source: 'Domain expertise', year: 2024, url: '', domain: 'advisory', verified: true },
};

// ============================================================
// Citation Extraction
// ============================================================

export function extractCitations(toolCalls: ToolCall[]): { citations: Citation[]; references: string[]; data_gaps: string[] } {
  const citations: Citation[] = [];
  const references: string[] = [];
  const data_gaps: string[] = [];
  let citationCounter = 1;

  const evidenceTools = [
    'search_knowledge', 'get_regulatory_context', 'get_scientific_basis',
    'benchmark_metric', 'retrieve_best_disclosure', 'retrieve_similar_companies',
  ];

  for (const call of toolCalls) {
    if (!evidenceTools.includes(call.name)) continue;

    const output = call.output;
    if (!output) continue;

    try {
      const data = typeof output === 'string' ? JSON.parse(output) : output;
      const items: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : (data as Record<string, unknown>).results
          ? (data as Record<string, unknown>).results as Record<string, unknown>[]
          : (data as Record<string, unknown>).peers
            ? (data as Record<string, unknown>).peers as Record<string, unknown>[]
            : [data as Record<string, unknown>];

      if (items.length === 0) {
        data_gaps.push(`No results from ${call.name} for: ${JSON.stringify(call.input).substring(0, 100)}`);
        continue;
      }

      for (const item of items.slice(0, 5)) {
        const title = (item.title as string) || (item.reportTitle as string) || (item.name as string) || '';
        const source = (item.source as string) || (item.company as string) || '';
        const year = (item.year as number) || (item.reportYear as number) || (item.latestReportYear as number) || 0;
        const url = (item.sourceUrl as string) || ((item.data as any)?.sourceUrl as string) || undefined;
        const domain = (item.domain as string) || (item.collection as string) || '';
        const entryId = (item.id as string) || (item._id as string) || '';
        const description = (item.description as string) || (item.abstract as string) || '';
        const ingested = item.ingested as boolean;

        // RULE 1: Only cite entries that have actual content
        if (!title || !source) continue;

        // If ingested field exists and is false, skip — it's a catalog stub
        if (ingested === false) {
          data_gaps.push(`${title} (${source}, ${year}) exists in catalog but has not been ingested — not cited`);
          continue;
        }

        citations.push({
          id: `cite-${citationCounter++}`,
          title,
          source,
          year,
          url,
          domain,
          entryId,
          excerpt: description.substring(0, 200),
          verified: ingested === true,
        });
      }
    } catch {
      // Non-JSON output, skip
    }
  }

  // Generate citations from tools with known authoritative sources
  for (const call of toolCalls) {
    const template = TOOL_CITATION_MAP[call.name];
    if (!template) continue;

    const output = call.output;
    if (!output) continue;

    try {
      const data = typeof output === 'string' ? JSON.parse(output) : output;
      // Skip error/empty responses
      if ((data as any).error || (data as any).available === false || (data as any).found === false) continue;

      // Build excerpt from returned data
      let excerpt = '';
      const d = data as Record<string, unknown>;
      if (call.name === 'get_water_stress') {
        excerpt = `${d.country}: water stress score ${d.waterStressScore}/5, ${d.label}`;
      } else if (call.name === 'get_climate_vulnerability') {
        excerpt = `${d.country}: ND-GAIN score ${d.ndGainScore}, vulnerability ${d.vulnerabilityScore}, readiness ${d.readinessScore}, rank ${d.ranking}`;
      } else if (call.name === 'get_forced_labour_risk') {
        excerpt = `${d.country}: ${d.prevalencePer1000} per 1,000 prevalence, ${d.estimatedVictims} estimated victims`;
      } else if (call.name === 'get_sbti_status') {
        const companies = (d.companies as any[]) || [];
        excerpt = companies.map((c: any) => `${c.companyName}: ${c.targetStatus}`).join('; ');
      } else if (call.name === 'get_emission_factor') {
        const factors = (d.factors as any[]) || [];
        if (factors.length > 0) {
          excerpt = `${factors[0].country || ''}: ${factors[0].factor} ${factors[0].unit || 'kgCO2e/kWh'} (${factors[0].source || 'IEA'} ${factors[0].year || ''})`;
        } else if (d.factor) {
          excerpt = `${d.country || ''}: ${d.factor} ${d.unit || ''} (${d.source || 'IEA'})`;
        }
      } else if (call.name === 'get_product_labour_risk') {
        const goods = (d.goods as any[]) || [];
        excerpt = goods.slice(0, 3).map((g: any) => `${g.good} (${g.country}): ${g.exploitationType}`).join('; ');
      } else if (call.name === 'calculate') {
        excerpt = `Calculation: ${(d as any).method || ''} = ${(d as any).result || ''} ${(d as any).unit || ''}`;
      } else {
        excerpt = JSON.stringify(d).substring(0, 150);
      }

      if (!excerpt) continue;

      citations.push({
        id: `cite-${citationCounter++}`,
        title: template.title,
        source: template.source,
        year: template.year,
        url: template.url,
        domain: template.domain,
        entryId: call.name,
        excerpt,
        verified: template.verified,
      });
    } catch {
      // skip
    }
  }

  return { citations, references, data_gaps };
}

export function determineConfidence(
  citations: Citation[],
  toolCalls: ToolCall[]
): 'high' | 'medium' | 'low' {
  if (citations.length >= 3) return 'high';
  if (citations.length >= 1 || toolCalls.length >= 2) return 'medium';
  return 'low';
}

// ============================================================
// Wire-format mapper
// ============================================================

/**
 * Maps the in-process Citation shape to the wire-format CitationItem shape.
 * The only difference is that CitationItem omits the internal `entryId` field.
 */
export function toWireCitations(citations: Citation[]): CitationItem[] {
  return citations.map((c) => ({
    id: c.id,
    title: c.title,
    source: c.source,
    year: c.year,
    url: c.url,
    domain: c.domain,
    excerpt: c.excerpt,
    verified: c.verified,
  }));
}
