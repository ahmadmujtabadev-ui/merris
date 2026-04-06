// Climatiq API client for live emission factor lookup
// API docs: https://www.climatiq.io/docs
// Free tier: 100 requests/month

const CLIMATIQ_BASE_URL = 'https://api.climatiq.io/data/v1';

function getApiKey(): string | null {
  return process.env['CLIMATIQ_API_KEY'] || null;
}

export interface ClimatiqEstimate {
  co2e: number;
  co2e_unit: string;
  emission_factor: {
    name: string;
    activity_id: string;
    source: string;
    region: string;
    year: number;
    lca_activity: string;
  };
}

export async function getEmissionFactorLive(input: {
  activity?: string;
  country?: string;
  region?: string;
  year?: number;
  category?: string;
}): Promise<unknown> {
  const apiKey = getApiKey();

  if (!apiKey) {
    // Fallback: return a helpful message with known static factors
    return {
      available: false,
      message: 'Climatiq API key not configured. Set CLIMATIQ_API_KEY in .env for live emission factor lookup.',
      suggestion: 'Using static emission factors from Merris database instead.',
      sourceUrl: 'https://www.climatiq.io/',
    };
  }

  try {
    // Search for emission factors matching the criteria
    const searchParams = new URLSearchParams();
    if (input.activity) searchParams.append('query', input.activity);
    if (input.region || input.country) searchParams.append('region', input.region || input.country || '');
    if (input.year) searchParams.append('year', String(input.year));
    if (input.category) searchParams.append('category', input.category);
    searchParams.append('results_per_page', '5');

    const searchUrl = `${CLIMATIQ_BASE_URL}/search?${searchParams.toString()}`;

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        available: false,
        error: `Climatiq API error: ${response.status}`,
        details: errorText.substring(0, 200),
      };
    }

    const data = await response.json();
    const results = (data.results || []).slice(0, 5);

    if (results.length === 0) {
      return {
        available: true,
        found: false,
        message: `No emission factors found for: ${input.activity || ''} in ${input.country || input.region || 'global'}`,
      };
    }

    return {
      available: true,
      found: true,
      factors: results.map((r: any) => ({
        name: r.name,
        activityId: r.activity_id,
        factor: r.factor,
        factorUnit: r.unit,
        source: r.source,
        region: r.region,
        year: r.year,
        category: r.category,
        lcaActivity: r.lca_activity,
      })),
      source: 'Climatiq API',
      sourceUrl: 'https://www.climatiq.io/',
      totalResults: data.total_results,
      ingested: true,
    };
  } catch (err: any) {
    return {
      available: false,
      error: `Climatiq API request failed: ${err.message}`,
    };
  }
}
