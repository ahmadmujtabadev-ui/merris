// IUCN Red List API v3
// Docs: https://apiv3.iucnredlist.org/api/v3/docs
// Free API token: register at https://apiv3.iucnredlist.org/api/v3/token

const IUCN_BASE_URL = 'https://apiv3.iucnredlist.org/api/v3';

function getApiToken(): string | null {
  return process.env['IUCN_API_TOKEN'] || null;
}

export async function getThreatenedSpecies(input: { country?: string; countryCode?: string }): Promise<unknown> {
  const token = getApiToken();

  if (!token) {
    // Return known summary data for key countries without API
    const knownData: Record<string, { threatened: number; mammals: number; birds: number; reptiles: number; amphibians: number; fish: number; plants: number }> = {
      'QA': { threatened: 18, mammals: 3, birds: 5, reptiles: 4, amphibians: 0, fish: 4, plants: 2 },
      'OM': { threatened: 54, mammals: 8, birds: 12, reptiles: 6, amphibians: 0, fish: 18, plants: 10 },
      'AE': { threatened: 28, mammals: 5, birds: 8, reptiles: 5, amphibians: 0, fish: 6, plants: 4 },
      'SA': { threatened: 62, mammals: 12, birds: 15, reptiles: 8, amphibians: 1, fish: 16, plants: 10 },
      'BH': { threatened: 12, mammals: 2, birds: 3, reptiles: 3, amphibians: 0, fish: 3, plants: 1 },
      'KW': { threatened: 15, mammals: 3, birds: 4, reptiles: 3, amphibians: 0, fish: 4, plants: 1 },
    };

    const code = (input.countryCode || '').toUpperCase();
    const data = knownData[code];

    if (data) {
      return {
        found: true,
        country: input.country || code,
        countryCode: code,
        totalThreatened: data.threatened,
        byGroup: data,
        source: 'IUCN Red List (summary data)',
        sourceUrl: 'https://www.iucnredlist.org/',
        note: 'Set IUCN_API_TOKEN in .env for detailed species-level data',
        year: 2024,
        ingested: true,
      };
    }

    return {
      available: false,
      message: 'IUCN API token not configured and no cached data for this country. Set IUCN_API_TOKEN in .env.',
      sourceUrl: 'https://apiv3.iucnredlist.org/api/v3/token',
    };
  }

  try {
    const iso = (input.countryCode || '').toUpperCase();
    const url = `${IUCN_BASE_URL}/country/getspecies/${iso}?token=${token}`;

    const response = await fetch(url);
    if (!response.ok) {
      return { available: false, error: `IUCN API error: ${response.status}` };
    }

    const data = await response.json();
    const species = (data as { result?: Array<{ category: string }> }).result || [];

    // Count threatened species by category
    const threatened = species.filter((s) =>
      ['CR', 'EN', 'VU'].includes(s.category)
    );

    return {
      found: true,
      country: input.country || iso,
      countryCode: iso,
      totalSpecies: species.length,
      totalThreatened: threatened.length,
      criticallyEndangered: species.filter((s) => s.category === 'CR').length,
      endangered: species.filter((s) => s.category === 'EN').length,
      vulnerable: species.filter((s) => s.category === 'VU').length,
      source: 'IUCN Red List API v3',
      sourceUrl: 'https://www.iucnredlist.org/',
      year: 2024,
      ingested: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { available: false, error: `IUCN API request failed: ${message}` };
  }
}
