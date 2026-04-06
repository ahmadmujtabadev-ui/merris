// KB Tier 1: WRI Aqueduct, ND-GAIN, SBTi datasets
// KB Tier 2: Forced labour risk datasets (Walk Free Global Slavery Index + US DOL ILAB)

import mongoose from 'mongoose';

// ============================================================
// Water Stress (WRI Aqueduct 4.0)
// ============================================================

export async function getWaterStress(input: { country?: string; countryCode?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {};
  if (input.countryCode) filter['countryCode'] = input.countryCode.toUpperCase();
  else if (input.country) filter['country'] = { $regex: new RegExp(input.country, 'i') };
  else return { error: 'Provide country or countryCode' };

  const entry = await db.collection('kb_water_risk').findOne(filter);
  if (!entry) return { found: false, message: `No water risk data for ${input.country || input.countryCode}` };

  return {
    found: true,
    country: entry['country'],
    countryCode: entry['countryCode'],
    waterStressScore: entry['waterStressScore'],
    label: entry['label'],
    ranking: entry['ranking'],
    depletionScore: entry['depletionScore'],
    source: 'WRI Aqueduct 4.0',
    sourceUrl: 'https://www.wri.org/aqueduct',
    year: entry['year'],
    ingested: true,
  };
}

// ============================================================
// Climate Vulnerability (ND-GAIN Country Index)
// ============================================================

export async function getClimateVulnerability(input: { country?: string; countryCode?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {};
  if (input.countryCode) filter['countryCode'] = input.countryCode.toUpperCase();
  else if (input.country) filter['country'] = { $regex: new RegExp(input.country, 'i') };
  else return { error: 'Provide country or countryCode' };

  const entry = await db.collection('kb_climate_vulnerability').findOne(filter);
  if (!entry) return { found: false, message: `No climate vulnerability data for ${input.country || input.countryCode}` };

  return {
    found: true,
    country: entry['country'],
    ndGainScore: entry['ndGainScore'],
    vulnerabilityScore: entry['vulnerabilityScore'],
    readinessScore: entry['readinessScore'],
    ranking: `${entry['ranking']} out of 192`,
    source: 'ND-GAIN Country Index',
    sourceUrl: 'https://gain.nd.edu/our-work/country-index/',
    year: entry['year'],
    ingested: true,
  };
}

// ============================================================
// SBTi Status (Science Based Targets initiative)
// ============================================================

export async function getSBTiStatus(input: { companyName?: string; sector?: string; country?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {};
  if (input.companyName) filter['companyName'] = { $regex: new RegExp(input.companyName, 'i') };
  if (input.sector) filter['sector'] = { $regex: new RegExp(input.sector, 'i') };
  if (input.country) filter['country'] = { $regex: new RegExp(input.country, 'i') };

  const entries = await db.collection('kb_sbti_targets').find(filter).limit(10).toArray();
  if (entries.length === 0) return { found: false, companies: [], message: 'No SBTi data found' };

  return {
    found: true,
    companies: entries.map(e => ({
      companyName: e['companyName'],
      sector: e['sector'],
      country: e['country'],
      targetStatus: e['targetStatus'],
      targetClassification: e['targetClassification'],
      netZeroCommitted: e['netZeroCommitted'],
      netZeroYear: e['netZeroYear'],
      dateSet: e['dateSet'],
    })),
    source: 'SBTi Companies Taking Action',
    sourceUrl: 'https://sciencebasedtargets.org/companies-taking-action',
    ingested: true,
  };
}

// ============================================================
// Forced Labour Risk (Walk Free Global Slavery Index)
// ============================================================

export async function getForcedLabourRisk(input: { country?: string; countryCode?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, any> = {};
  if (input.countryCode) filter.countryCode = input.countryCode.toUpperCase();
  else if (input.country) filter.country = { $regex: new RegExp(input.country, 'i') };
  else return { error: 'Provide country or countryCode' };

  const entry = await db.collection('kb_slavery_risk').findOne(filter);
  if (!entry) return { found: false, message: `No slavery risk data for ${input.country || input.countryCode}` };

  return {
    found: true,
    country: entry.country,
    prevalencePer1000: entry.prevalencePer1000,
    estimatedVictims: entry.estimatedVictims,
    vulnerabilityScore: entry.vulnerabilityScore,
    govResponseScore: entry.govResponseScore,
    importRiskUsd: entry.importRiskUsd,
    source: 'Walk Free Global Slavery Index 2023',
    sourceUrl: 'https://www.walkfree.org/global-slavery-index/',
    year: entry.year,
    ingested: true,
  };
}

// ============================================================
// Product Labour Risk (US DOL ILAB List of Goods)
// ============================================================

export async function getProductLabourRisk(input: { product?: string; country?: string; sector?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, any> = {};
  if (input.product) filter.good = { $regex: new RegExp(input.product, 'i') };
  if (input.country) filter.country = { $regex: new RegExp(input.country, 'i') };
  if (input.sector) filter.sector = { $regex: new RegExp(input.sector, 'i') };

  const entries = await db.collection('kb_forced_labour_goods').find(filter).limit(20).toArray();
  if (entries.length === 0) return { found: false, message: 'No forced labour risk data found' };

  return {
    found: true,
    goods: entries.map(e => ({
      good: e.good,
      country: e.country,
      exploitationType: e.exploitationType,
      sector: e.sector,
    })),
    source: 'US DOL ILAB List of Goods 2024',
    sourceUrl: 'https://www.dol.gov/agencies/ilab/reports/child-labor/list-of-goods',
    ingested: true,
  };
}

// ============================================================
// Country Emissions (EDGAR)
// ============================================================

export async function getCountryEmissions(input: { countryCode?: string; country?: string; year?: number; sector?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {};
  if (input.countryCode) filter['countryCode'] = input.countryCode.toUpperCase();
  else if (input.country) filter['country'] = { $regex: new RegExp(input.country, 'i') };
  if (input.year) filter['year'] = input.year;
  if (input.sector) filter['sector'] = input.sector;

  const entry = await db.collection('kb_country_emissions').findOne(filter);
  if (!entry) return { found: false, message: `No emissions data for ${input.country || input.countryCode}` };

  return {
    found: true,
    country: entry['country'],
    countryCode: entry['countryCode'],
    total_ghg_mt_co2e: entry['total_ghg_mt_co2e'],
    co2_mt: entry['co2_mt'],
    sector_breakdown: entry['sector_breakdown'],
    year: entry['year'],
    source: 'EDGAR',
    sourceUrl: 'https://edgar.jrc.ec.europa.eu/',
    ingested: true,
  };
}

// ============================================================
// NDC Targets (Climate Watch / UNFCCC)
// ============================================================

export async function getNDCTarget(input: { countryCode?: string; country?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {};
  if (input.countryCode) filter['countryCode'] = input.countryCode.toUpperCase();
  else if (input.country) filter['country'] = { $regex: new RegExp(input.country, 'i') };
  else return { error: 'Provide country or countryCode' };

  const entry = await db.collection('kb_ndc_targets').findOne(filter);
  if (!entry) return { found: false, message: `No NDC target data for ${input.country || input.countryCode}` };

  return {
    found: true,
    country: entry['country'],
    countryCode: entry['countryCode'],
    ndc_version: entry['ndc_version'],
    target_type: entry['target_type'],
    target_value: entry['target_value'],
    base_year: entry['base_year'],
    target_year: entry['target_year'],
    sectors_covered: entry['sectors_covered'],
    conditional: entry['conditional'],
    source: 'Climate Watch / UNFCCC',
    sourceUrl: 'https://www.climatewatchdata.org/ndcs-explore',
    ingested: true,
  };
}

// ============================================================
// Corruption Perception Index (Transparency International)
// ============================================================

export async function getCorruptionIndex(input: { countryCode?: string; country?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {};
  if (input.countryCode) filter['countryCode'] = input.countryCode.toUpperCase();
  else if (input.country) filter['country'] = { $regex: new RegExp(input.country, 'i') };
  else return { error: 'Provide country or countryCode' };

  const entry = await db.collection('kb_corruption_index').findOne(filter);
  if (!entry) return { found: false, message: `No corruption index data for ${input.country || input.countryCode}` };

  return {
    found: true,
    country: entry['country'],
    countryCode: entry['countryCode'],
    cpi_score: entry['cpi_score'],
    rank: entry['rank'],
    year: entry['year'],
    source: 'Transparency International',
    sourceUrl: 'https://www.transparency.org/cpi2024',
    ingested: true,
  };
}

// ============================================================
// Facility / Sector Emissions (Climate TRACE)
// ============================================================

export async function getFacilityEmissions(input: { countryCode?: string; country?: string; sector?: string; year?: number }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {};
  if (input.countryCode) filter['countryCode'] = input.countryCode.toUpperCase();
  else if (input.country) filter['country'] = { $regex: new RegExp(input.country, 'i') };
  if (input.sector) filter['sector'] = { $regex: new RegExp(input.sector, 'i') };
  if (input.year) filter['year'] = input.year;

  const entries = await db.collection('kb_facility_emissions').find(filter).limit(20).toArray();
  if (entries.length === 0) return { found: false, message: `No facility emissions data found` };

  return {
    found: true,
    sectors: entries.map(e => ({
      country: e['country'],
      countryCode: e['countryCode'],
      sector: e['sector'],
      emissions_mt_co2e: e['emissions_mt_co2e'],
      year: e['year'],
    })),
    source: 'Climate TRACE',
    sourceUrl: 'https://climatetrace.org/',
    ingested: true,
  };
}

// ============================================================
// Deforestation Data (Global Forest Watch 2023)
// ============================================================

export async function getDeforestationData(input: { countryCode?: string; country?: string; year?: number }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {};
  if (input.countryCode) filter['countryCode'] = input.countryCode.toUpperCase();
  else if (input.country) filter['country'] = { $regex: new RegExp(input.country, 'i') };
  if (input.year) filter['year'] = input.year;

  const entries = await db.collection('kb_forest_data').find(filter).limit(20).toArray();
  if (entries.length === 0) return { found: false, message: `No deforestation data for ${input.country || input.countryCode || 'query'}` };

  return {
    found: true,
    countries: entries.map(e => ({
      country: e['country'],
      countryCode: e['countryCode'],
      tree_cover_loss_ha: e['tree_cover_loss_ha'],
      primary_forest_loss_ha: e['primary_forest_loss_ha'],
      co2_from_loss_mt: e['co2_from_loss_mt'],
      year: e['year'],
    })),
    source: 'Global Forest Watch',
    sourceUrl: 'https://www.globalforestwatch.org/',
    ingested: true,
  };
}

// ============================================================
// Protected Areas (UNEP Protected Planet)
// ============================================================

export async function getProtectedAreas(input: { countryCode?: string; country?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {};
  if (input.countryCode) filter['countryCode'] = input.countryCode.toUpperCase();
  else if (input.country) filter['country'] = { $regex: new RegExp(input.country, 'i') };
  else return { error: 'Provide country or countryCode' };

  const entries = await db.collection('kb_protected_areas').find(filter).toArray();
  if (entries.length === 0) return { found: false, message: `No protected areas for ${input.country || input.countryCode}` };

  return {
    found: true,
    areas: entries.map(e => ({
      name: e['name'],
      country: e['country'],
      countryCode: e['countryCode'],
      iucnCategory: e['iucnCategory'],
      area_km2: e['area_km2'],
      latitude: e['latitude'],
      longitude: e['longitude'],
      marine: e['marine'],
      near_industrial: e['near_industrial'],
    })),
    source: 'UNEP Protected Planet',
    sourceUrl: 'https://www.protectedplanet.net/',
    ingested: true,
  };
}

export async function getProtectedAreasNear(input: { lat: number; lon: number; radiusKm?: number }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const radiusKm = input.radiusKm || 200;
  // Approximate degree offset for latitude/longitude filtering
  const degOffset = radiusKm / 111;

  const entries = await db.collection('kb_protected_areas').find({
    latitude: { $gte: input.lat - degOffset, $lte: input.lat + degOffset },
    longitude: { $gte: input.lon - degOffset, $lte: input.lon + degOffset },
  }).toArray();

  if (entries.length === 0) return { found: false, message: `No protected areas within ${radiusKm}km of (${input.lat}, ${input.lon})` };

  // Calculate approximate distance and filter
  const results: Array<Record<string, any>> = entries.map(e => {
    const dLat = (e['latitude'] as number) - input.lat;
    const dLon = (e['longitude'] as number) - input.lon;
    const approxKm = Math.sqrt(dLat * dLat + dLon * dLon) * 111;
    return { ...e, approxDistanceKm: Math.round(approxKm) };
  }).filter(e => e.approxDistanceKm <= radiusKm)
    .sort((a, b) => a.approxDistanceKm - b.approxDistanceKm);

  if (results.length === 0) return { found: false, message: `No protected areas within ${radiusKm}km of (${input.lat}, ${input.lon})` };

  return {
    found: true,
    areas: results.map(e => ({
      name: e['name'],
      country: e['country'],
      countryCode: e['countryCode'],
      iucnCategory: e['iucnCategory'],
      area_km2: e['area_km2'],
      latitude: e['latitude'],
      longitude: e['longitude'],
      marine: e['marine'],
      near_industrial: e['near_industrial'],
      approxDistanceKm: e.approxDistanceKm,
    })),
    source: 'UNEP Protected Planet',
    sourceUrl: 'https://www.protectedplanet.net/',
    ingested: true,
  };
}

// ============================================================
// KnowTheChain Benchmarks
// ============================================================

export async function getKnowTheChainScore(input: { company?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  if (!input.company) return { error: 'Provide company name' };

  const filter: Record<string, unknown> = {
    company: { $regex: new RegExp(input.company, 'i') },
  };

  const entries = await db.collection('kb_knowthechain').find(filter).toArray();
  if (entries.length === 0) return { found: false, message: `No KnowTheChain data for ${input.company}` };

  return {
    found: true,
    benchmarks: entries.map(e => ({
      company: e['company'],
      sector: e['sector'],
      year: e['year'],
      overall_score: e['overall_score'],
      theme_scores: e['theme_scores'],
    })),
    source: 'KnowTheChain',
    sourceUrl: 'https://knowthechain.org/',
    ingested: true,
  };
}

// ============================================================
// Assurance Requirements (kb_assurance_standards)
// ============================================================

export async function getAssuranceRequirement(input: { framework: string; jurisdiction?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {
    applicable_frameworks: { $regex: new RegExp(input.framework, 'i') },
  };

  const entries = await db.collection('kb_assurance_standards').find(filter).toArray();
  if (entries.length === 0) return { found: false, message: `No assurance requirements found for framework ${input.framework}` };

  return {
    found: true,
    standards: entries.map(e => ({
      standard_code: e['standard_code'],
      standard_name: e['standard_name'],
      issuing_body: e['issuing_body'],
      scope: e['scope'],
      assurance_levels: e['assurance_levels'],
      key_requirements: e['key_requirements'],
      what_verifiers_check: e['what_verifiers_check'],
      triggers_for_qualification: e['triggers_for_qualification'],
      evidence_requirements: e['evidence_requirements'],
      applicable_frameworks: e['applicable_frameworks'],
    })),
    source: 'Merris Assurance Standards KB',
    ingested: true,
  };
}

export async function getVerifierChecklist(input: { standardCode: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const entry = await db.collection('kb_assurance_standards').findOne({ standard_code: input.standardCode });
  if (!entry) return { found: false, message: `No assurance standard found with code ${input.standardCode}` };

  return {
    found: true,
    standard_code: entry['standard_code'],
    standard_name: entry['standard_name'],
    issuing_body: entry['issuing_body'],
    assurance_levels: entry['assurance_levels'],
    what_verifiers_check: entry['what_verifiers_check'],
    triggers_for_qualification: entry['triggers_for_qualification'],
    evidence_requirements: entry['evidence_requirements'],
    url: entry['url'],
    source: entry['source'],
    ingested: true,
  };
}

export async function getKnowTheChainSector(input: { sector: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {
    sector: { $regex: new RegExp(input.sector, 'i') },
  };

  const entries = await db.collection('kb_knowthechain').find(filter).sort({ overall_score: -1 }).toArray();
  if (entries.length === 0) return { found: false, message: `No KnowTheChain data for sector ${input.sector}` };

  return {
    found: true,
    benchmarks: entries.map(e => ({
      company: e['company'],
      sector: e['sector'],
      year: e['year'],
      overall_score: e['overall_score'],
      theme_scores: e['theme_scores'],
    })),
    source: 'KnowTheChain',
    sourceUrl: 'https://knowthechain.org/',
    ingested: true,
  };
}

// ============================================================
// Abatement Technologies (IEA, IRENA, Global CCS Institute)
// ============================================================

export async function getAbatementOptions(input: { sector: string; region?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {
    sector: { $regex: new RegExp(input.sector, 'i') },
  };
  if (input.region) {
    filter['regions'] = { $regex: new RegExp(input.region, 'i') };
  }

  const entries = await db.collection('kb_abatement_technologies')
    .find(filter)
    .sort({ trl: -1, 'abatement_cost.mid': 1 })
    .toArray();

  if (entries.length === 0) return { found: false, message: `No abatement technologies for sector ${input.sector}` };

  return {
    found: true,
    sector: input.sector,
    region: input.region || 'all',
    technologies: entries.map(e => ({
      technology: e['technology'],
      sector: e['sector'],
      abatement_cost_usd_per_tco2e: e['abatement_cost'],
      abatement_potential_percent: e['abatement_potential_percent'],
      trl: e['trl'],
      deployment: e['deployment'],
      capex: e['capex'],
      regions: e['regions'],
      source: e['source'],
      url: e['url'],
    })),
    ingested: true,
  };
}

// ============================================================
// Carbon Pricing (ETS, Carbon Tax, CBAM, Scenarios)
// ============================================================

export async function getCarbonPrice(input: { jurisdiction?: string; scheme_type?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {};
  if (input.jurisdiction) filter['jurisdiction'] = { $regex: new RegExp(input.jurisdiction, 'i') };
  if (input.scheme_type) filter['scheme_type'] = { $regex: new RegExp(input.scheme_type, 'i') };

  if (!input.jurisdiction && !input.scheme_type) {
    // Return all non-scenario entries
    filter['scheme_type'] = { $ne: 'scenario' };
  }

  const entries = await db.collection('kb_carbon_pricing')
    .find(filter)
    .sort({ price_usd_per_tco2e: -1 })
    .toArray();

  if (entries.length === 0) return { found: false, message: `No carbon pricing data found` };

  return {
    found: true,
    schemes: entries.map(e => ({
      jurisdiction: e['jurisdiction'],
      scheme_type: e['scheme_type'],
      scheme_name: e['scheme_name'],
      price_usd_per_tco2e: e['price_usd_per_tco2e'],
      status: e['status'],
      coverage_percent: e['coverage_percent'],
      sectors_covered: e['sectors_covered'],
      year_started: e['year_started'],
      phase: e['phase'],
      source: e['source'],
      url: e['url'],
    })),
    ingested: true,
  };
}

export async function getCarbonPriceScenario(input: { scenario: string; year?: number }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {
    scheme_type: 'scenario',
    jurisdiction: { $regex: new RegExp(input.scenario, 'i') },
  };

  const entries = await db.collection('kb_carbon_pricing').find(filter).toArray();
  if (entries.length === 0) return { found: false, message: `No scenario data for ${input.scenario}` };

  return {
    found: true,
    scenarios: entries.map(e => {
      const scenarioPrices = e['scenario_prices'] as Record<string, number> | undefined;
      const result: Record<string, unknown> = {
        scenario: e['scheme_name'],
        jurisdiction: e['jurisdiction'],
        price_2050_usd: e['price_usd_per_tco2e'],
        scenario_prices: scenarioPrices,
        source: e['source'],
        url: e['url'],
      };
      if (input.year && scenarioPrices) {
        const yearStr = String(input.year);
        result['price_at_year'] = scenarioPrices[yearStr] ?? null;
        result['requested_year'] = input.year;
      }
      return result;
    }),
    ingested: true,
  };
}

// ============================================================
// Energy Instruments (I-REC, GO, REC, PPA)
// ============================================================

export async function getEnergyInstrument(input: { countryCode?: string; instrumentType?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {};
  if (input.instrumentType) filter['instrument_type'] = { $regex: new RegExp(input.instrumentType, 'i') };
  if (input.countryCode) filter['countries_active'] = input.countryCode.toUpperCase();

  const entries = await db.collection('kb_energy_instruments').find(filter).toArray();
  if (entries.length === 0) return { found: false, message: `No energy instrument data found` };

  return {
    found: true,
    instruments: entries.map(e => ({
      instrument_type: e['instrument_type'],
      full_name: e['full_name'],
      issuing_body: e['issuing_body'],
      ghg_protocol_qualifying: e['ghg_protocol_qualifying'],
      scope2_method: e['scope2_method'],
      geographic_scope: e['geographic_scope'],
      unit: e['unit'],
      tradeable: e['tradeable'],
      gcc_status: e['gcc_status'],
      notes: e['notes'],
      source: e['source'],
      url: e['url'],
    })),
    ingested: true,
  };
}

export async function getRECMarketStatus(input: { countryCode: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const code = input.countryCode.toUpperCase();

  // Find country-specific status entries first
  const countryStatus = await db.collection('kb_energy_instruments').find({
    instrument_type: 'country_status',
    countries_active: code,
  }).toArray();

  // Find qualifying instruments available in this country
  const instruments = await db.collection('kb_energy_instruments').find({
    instrument_type: { $ne: 'country_status' },
    countries_active: code,
    ghg_protocol_qualifying: true,
  }).toArray();

  if (countryStatus.length === 0 && instruments.length === 0) {
    return {
      found: false,
      countryCode: code,
      message: `No REC market data for ${code}. Country may not have established energy attribute certificate infrastructure. Consider I-RECs from neighbouring markets (with GHG Protocol market boundary caveats).`,
    };
  }

  return {
    found: true,
    countryCode: code,
    country_status: countryStatus.map(e => ({
      full_name: e['full_name'],
      gcc_status: e['gcc_status'],
      notes: e['notes'],
      ghg_protocol_qualifying: e['ghg_protocol_qualifying'],
    })),
    qualifying_instruments: instruments.map(e => ({
      instrument_type: e['instrument_type'],
      full_name: e['full_name'],
      ghg_protocol_qualifying: e['ghg_protocol_qualifying'],
      scope2_method: e['scope2_method'],
      tradeable: e['tradeable'],
      gcc_status: e['gcc_status'],
    })),
    ingested: true,
  };
}

// ============================================================
// Partner Intelligence (Merris Domain Expertise)
// ============================================================

export async function getPartnerInsight(input: { domain: string; topic?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, any> = {
    domain: { $regex: new RegExp(input.domain, 'i') },
  };
  if (input.topic) filter.topic = { $regex: new RegExp(input.topic, 'i') };

  const entries = await db.collection('kb_partner_intelligence').find(filter).limit(3).toArray();
  if (entries.length === 0) return { found: false, message: `No partner intelligence for ${input.domain}` };

  return {
    found: true,
    insights: entries.map(e => ({
      domain: e.domain,
      topic: e.topic,
      partner_view: e.partner_view,
      why_it_matters: e.why_it_matters,
    })),
    source: 'Merris Partner Intelligence',
    ingested: true,
  };
}

// ============================================================
// Sector Benchmarks & Anomaly Detection (kb_sector_benchmarks)
// ============================================================

export async function getAnomalyCheck(input: { sector: string; metric: string; value: number }): Promise<unknown> {
  const db = mongoose.connection.db!;

  // PRIMARY: Try dynamic peer comparison from kb_knowledge_reports
  // (for now, go straight to reference data — dynamic mode comes when K1 has more ingested reports)

  // FALLBACK: Reference data from kb_sector_benchmarks
  const benchmark = await db.collection('kb_sector_benchmarks').findOne({
    sector: { $regex: new RegExp(input.sector, 'i') },
    metric: { $regex: new RegExp(input.metric, 'i') },
  });

  if (!benchmark) {
    return { found: false, message: `No benchmark data for ${input.sector} / ${input.metric}` };
  }

  const value = input.value;
  const range = benchmark['expected_range'] as { low: number; mid: number; high: number };
  const threshold = benchmark['anomaly_threshold'] as { below: number; above: number };

  const withinRange = value >= range.low && value <= range.high;
  const anomaly = value < threshold.below || value > threshold.above;

  let position = 'within expected range';
  if (value < range.low) position = 'below expected range';
  else if (value > range.high) position = 'above expected range';
  else if (value <= range.mid) position = 'lower half of expected range';
  else position = 'upper half of expected range';

  return {
    found: true,
    sector: input.sector,
    metric: input.metric,
    value: input.value,
    unit: benchmark['unit'],
    expected_range: range,
    anomaly_threshold: threshold,
    within_range: withinRange,
    anomaly,
    position,
    context: benchmark['context'],
    region_adjustments: benchmark['region_adjustments'],
    mode: 'reference',
    peers_used: 0,
    source: benchmark['source'],
    sourceUrl: benchmark['sourceUrl'] || '',
    ingested: true,
  };
}

// ============================================================
// Precedent Cases (Merris Precedent Case Library)
// ============================================================

export async function getPrecedent(input: { caseType?: string; sector?: string; jurisdiction?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, any> = {};
  if (input.caseType) filter.case_type = { $regex: new RegExp(input.caseType, 'i') };
  if (input.sector) filter.sector = { $regex: new RegExp(input.sector, 'i') };
  if (input.jurisdiction) filter.jurisdiction = { $regex: new RegExp(input.jurisdiction, 'i') };

  const entries = await db.collection('kb_precedent_cases').find(filter).limit(5).toArray();
  if (entries.length === 0) return { found: false, message: 'No precedent cases found matching criteria' };

  return {
    found: true,
    cases: entries.map(e => ({
      title: e.title,
      case_type: e.case_type,
      jurisdiction: e.jurisdiction,
      sector: e.sector,
      year: e.year,
      what_happened: e.what_happened,
      lesson: e.lesson,
    })),
    source: 'Merris Precedent Case Library',
    ingested: true,
  };
}

// ============================================================
// Decarbonisation Pathways (IEA, SBTi, TPI)
// ============================================================

export async function getDecarbonisationPathway(input: { sector: string; source?: string }): Promise<unknown> {
  const db = mongoose.connection.db!;
  const filter: Record<string, unknown> = {
    sector: { $regex: new RegExp(input.sector, 'i') },
  };
  if (input.source) filter['pathway_source'] = { $regex: new RegExp(input.source, 'i') };

  const entries = await db.collection('kb_decarbonisation_pathways').find(filter).toArray();
  if (entries.length === 0) return { found: false, message: `No decarbonisation pathways for sector ${input.sector}` };

  return {
    found: true,
    sector: input.sector,
    pathways: entries.map(e => ({
      pathway_name: e['pathway_name'],
      pathway_source: e['pathway_source'],
      base_year: e['base_year'],
      base_intensity: e['base_intensity_kgco2_per_unit'],
      intensity_unit: e['intensity_unit'],
      milestones: e['milestones'],
      key_levers: e['key_levers'],
      source: e['source'],
      url: e['url'],
    })),
    ingested: true,
  };
}
