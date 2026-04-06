// GBIF API — Global Biodiversity Information Facility
// Docs: https://www.gbif.org/developer/summary
// No API key required for basic queries

const GBIF_BASE_URL = 'https://api.gbif.org/v1';

interface GbifOccurrence {
  species?: string;
  scientificName?: string;
  kingdom?: string;
  class?: string;
}

interface GbifSearchResponse {
  count?: number;
  results?: GbifOccurrence[];
}

interface GbifMatchResponse {
  usageKey?: number;
  scientificName?: string;
}

interface GbifSpeciesDetail {
  scientificName?: string;
  vernacularName?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  taxonomicStatus?: string;
}

export async function getSpeciesNear(input: {
  lat: number;
  lon: number;
  radiusKm?: number;
}): Promise<unknown> {
  const radius = input.radiusKm || 50;
  const decimalDegrees = radius / 111; // rough km to degrees conversion

  try {
    const url = `${GBIF_BASE_URL}/occurrence/search?` + new URLSearchParams({
      decimalLatitude: `${input.lat - decimalDegrees},${input.lat + decimalDegrees}`,
      decimalLongitude: `${input.lon - decimalDegrees},${input.lon + decimalDegrees}`,
      limit: '50',
      hasCoordinate: 'true',
      hasGeospatialIssue: 'false',
    }).toString();

    const response = await fetch(url);
    if (!response.ok) {
      return { available: false, error: `GBIF API error: ${response.status}` };
    }

    const data = (await response.json()) as GbifSearchResponse;
    const occurrences = data.results || [];

    // Unique species
    const speciesSet = new Map<string, { name: string; kingdom: string; class: string; count: number }>();
    for (const occ of occurrences) {
      const name = occ.species || occ.scientificName;
      if (!name) continue;
      const existing = speciesSet.get(name);
      if (existing) {
        existing.count++;
      } else {
        speciesSet.set(name, {
          name,
          kingdom: occ.kingdom || '',
          class: occ.class || '',
          count: 1,
        });
      }
    }

    return {
      found: true,
      location: { lat: input.lat, lon: input.lon, radiusKm: radius },
      totalOccurrences: data.count || occurrences.length,
      uniqueSpecies: speciesSet.size,
      species: Array.from(speciesSet.values()).sort((a, b) => b.count - a.count).slice(0, 20),
      source: 'GBIF — Global Biodiversity Information Facility',
      sourceUrl: 'https://www.gbif.org/',
      ingested: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { available: false, error: `GBIF API request failed: ${message}` };
  }
}

export async function getSpeciesStatus(input: { speciesName: string }): Promise<unknown> {
  try {
    // First, find the species key
    const matchUrl = `${GBIF_BASE_URL}/species/match?name=${encodeURIComponent(input.speciesName)}`;
    const matchResponse = await fetch(matchUrl);
    if (!matchResponse.ok) return { found: false, error: 'Species not found' };

    const match = (await matchResponse.json()) as GbifMatchResponse;
    if (!match.usageKey) return { found: false, message: `Species "${input.speciesName}" not found in GBIF` };

    // Get species details
    const detailUrl = `${GBIF_BASE_URL}/species/${match.usageKey}`;
    const detailResponse = await fetch(detailUrl);
    const detail = (await detailResponse.json()) as GbifSpeciesDetail;

    return {
      found: true,
      scientificName: detail.scientificName || match.scientificName,
      commonName: detail.vernacularName || '',
      kingdom: detail.kingdom,
      phylum: detail.phylum,
      class: detail.class,
      order: detail.order,
      family: detail.family,
      taxonomicStatus: detail.taxonomicStatus,
      source: 'GBIF',
      sourceUrl: `https://www.gbif.org/species/${match.usageKey}`,
      ingested: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { available: false, error: `GBIF API request failed: ${message}` };
  }
}
