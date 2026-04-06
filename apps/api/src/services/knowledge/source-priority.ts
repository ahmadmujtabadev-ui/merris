/**
 * Data Source Priority Rules
 *
 * When multiple sources provide the same data point, prefer in this order.
 * Higher index = lower priority.
 */

export const SOURCE_PRIORITY: Record<string, string[]> = {
  emission_factors: ['IEA', 'Climatiq', 'EPA', 'DEFRA', 'IPCC_EFDB'],
  country_emissions: ['EDGAR', 'Climate_Watch', 'Climate_TRACE', 'UNFCCC'],
  company_emissions: ['company_report', 'CDP', 'Climate_TRACE', 'CTI'],
  water_risk: ['WRI_Aqueduct'],
  climate_vulnerability: ['ND_GAIN'],
  forced_labour: ['Walk_Free_GSI', 'US_DOL_ILAB', 'KnowTheChain'],
  regulatory: ['official_text', 'Climate_Watch', 'KB_K3'],
  biodiversity: ['IUCN_Red_List', 'GBIF', 'Protected_Planet', 'Global_Forest_Watch'],
  corruption: ['Transparency_International'],
};

/**
 * Given a data category and two source names, return which should be preferred.
 * Returns -1 if sourceA is preferred, 1 if sourceB, 0 if equal/unknown.
 */
export function compareSourcePriority(category: string, sourceA: string, sourceB: string): number {
  const priorities = SOURCE_PRIORITY[category];
  if (!priorities) return 0;

  const indexA = priorities.findIndex(s => sourceA.toLowerCase().includes(s.toLowerCase()));
  const indexB = priorities.findIndex(s => sourceB.toLowerCase().includes(s.toLowerCase()));

  // Not found = lowest priority
  const posA = indexA === -1 ? 999 : indexA;
  const posB = indexB === -1 ? 999 : indexB;

  if (posA < posB) return -1; // A is preferred
  if (posA > posB) return 1;  // B is preferred
  return 0;
}

/**
 * Pick the highest-priority source from a list.
 */
export function pickBestSource(category: string, sources: string[]): string | null {
  if (sources.length === 0) return null;
  return sources.sort((a, b) => compareSourcePriority(category, a, b))[0] ?? null;
}
