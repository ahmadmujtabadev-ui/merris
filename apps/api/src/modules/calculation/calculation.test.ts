import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { registerCalculationRoutes } from './calculation.routes.js';
import {
  calculate,
  setEmissionFactorLookup,
  resetEmissionFactorLookup,
} from './calculation.service.js';
import type { IEmissionFactor } from '../../models/emission-factor.model.js';

// ============================================================
// Test Setup
// ============================================================

const JWT_SECRET = 'test-secret-key-for-calculation-tests';
process.env['JWT_SECRET'] = JWT_SECRET;

let mongoServer: MongoMemoryServer;
let app: FastifyInstance;

const TEST_ORG_ID = new mongoose.Types.ObjectId().toString();
const TEST_USER_ID = new mongoose.Types.ObjectId().toString();
const TEST_ENGAGEMENT_ID = new mongoose.Types.ObjectId().toString();

function createToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      userId: TEST_USER_ID,
      orgId: TEST_ORG_ID,
      role: 'owner',
      permissions: [
        { resource: 'data', actions: ['read', 'write', 'delete', 'approve'] },
      ],
      ...overrides,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// Mock emission factor lookup
function mockEFLookup(factors: Record<string, Partial<IEmissionFactor>>) {
  setEmissionFactorLookup(async (filters) => {
    const key = filters.country?.toLowerCase() || 'default';
    const ef = factors[key];
    if (!ef) return null;
    return {
      _id: 'mock-id',
      source: ef.source || 'mock',
      country: ef.country || key,
      year: ef.year || 2023,
      factor: ef.factor || 0,
      unit: ef.unit || 'kgCO2e/kWh',
      scope: ef.scope || 2,
      category: ef.category || 'grid-electricity',
      verified: true,
      ...ef,
    } as unknown as IEmissionFactor;
  });
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = Fastify();
  await registerCalculationRoutes(app);
  await app.ready();
});

afterAll(async () => {
  resetEmissionFactorLookup();
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  resetEmissionFactorLookup();
});

// ============================================================
// Helper
// ============================================================

function makeRequest(method: string, inputs: Record<string, unknown>) {
  return {
    method: method as any,
    inputs,
    engagementId: TEST_ENGAGEMENT_ID,
    disclosureRef: 'test-ref',
  };
}

// ============================================================
// ESG CORE TESTS (1-16)
// ============================================================

describe('GHG Scope 2 Location-Based', () => {
  it('calculates 100,000 kWh in Saudi Arabia (EF ~0.573) -> ~57.3 tCO2e', async () => {
    mockEFLookup({
      'saudi arabia': { factor: 0.573, country: 'Saudi Arabia', unit: 'kgCO2e/kWh', scope: 2 as const },
    });

    const result = await calculate(makeRequest('ghg_scope2_location', {
      electricity_kwh: 100000,
      country: 'Saudi Arabia',
    }));

    expect(result.method).toBe('ghg_scope2_location');
    expect(result.result).toBeCloseTo(57.3, 1);
    expect(result.unit).toBe('tCO2e');
    expect(result.emissionFactors).toHaveLength(1);
    expect(result.methodology).toContain('Location-Based');
    expect(result.auditTrail).toContain('100000');
  });

  it('calculates 100,000 kWh in Qatar (EF ~0.493) -> ~49.3 tCO2e', async () => {
    mockEFLookup({
      'qatar': { factor: 0.493, country: 'Qatar', unit: 'kgCO2e/kWh', scope: 2 as const },
    });

    const result = await calculate(makeRequest('ghg_scope2_location', {
      electricity_kwh: 100000,
      country: 'Qatar',
    }));

    expect(result.result).toBeCloseTo(49.3, 1);
  });
});

describe('GHG Scope 2 Market-Based', () => {
  it('calculates with supplier EF', async () => {
    const result = await calculate(makeRequest('ghg_scope2_market', {
      electricity_kwh: 100000,
      supplier_ef: 0.45,
    }));

    expect(result.result).toBeCloseTo(45, 1);
    expect(result.unit).toBe('tCO2e');
  });
});

describe('GHG Scope 1', () => {
  it('calculates from fuel sources', async () => {
    mockEFLookup({
      'global': { factor: 2.68, country: 'global', unit: 'kgCO2e/litre', scope: 1 as const, fuelType: 'diesel' },
    });

    const result = await calculate(makeRequest('ghg_scope1', {
      sources: [
        { fuel_type: 'diesel', activity_data: 10000, unit: 'litres', country: 'global' },
      ],
    }));

    expect(result.method).toBe('ghg_scope1');
    expect(result.unit).toBe('tCO2e');
    expect(typeof result.result).toBe('number');
    expect(result.result as number).toBeGreaterThan(0);
  });
});

describe('GHG Scope 3 Cat 1 Spend-Based', () => {
  it('calculates spend-based emissions', async () => {
    const result = await calculate(makeRequest('ghg_scope3_cat1_spend', {
      spend: 1000000,
      spend_ef: 0.5,
    }));

    expect(result.result).toBeCloseTo(500, 0);
    expect(result.unit).toBe('tCO2e');
  });
});

describe('GHG Scope 3 Cat 1 Supplier-Specific', () => {
  it('sums supplier emissions', async () => {
    const result = await calculate(makeRequest('ghg_scope3_cat1_supplier', {
      suppliers: [
        { name: 'Supplier A', emissions: 100 },
        { name: 'Supplier B', emissions: 200 },
        { name: 'Supplier C', emissions: 50 },
      ],
    }));

    expect(result.result).toBe(350);
  });
});

describe('GHG Scope 3 Cat 3 (Fuel & Energy)', () => {
  it('calculates WTT + T&D losses', async () => {
    const result = await calculate(makeRequest('ghg_scope3_cat3', {
      electricity_kwh: 100000,
      wtt_ef: 0.05,
      td_loss_pct: 5,
      grid_ef: 0.573,
    }));

    // WTT: 100000 * 0.05 / 1000 = 5
    // T&D: 100000 * 0.05 * 0.573 / 1000 = 2.865
    expect(result.result).toBeCloseTo(7.865, 2);
  });
});

describe('GHG Scope 3 Cat 6 (Business Travel)', () => {
  it('calculates travel emissions', async () => {
    const result = await calculate(makeRequest('ghg_scope3_cat6', {
      trips: [
        { mode: 'air', distance_km: 5000 },
        { mode: 'rail', distance_km: 200 },
      ],
    }));

    expect(result.unit).toBe('tCO2e');
    expect(result.result as number).toBeGreaterThan(0);
  });
});

describe('GHG Scope 3 Cat 7 (Employee Commuting)', () => {
  it('calculates commuting emissions', async () => {
    const result = await calculate(makeRequest('ghg_scope3_cat7', {
      employees: 500,
      avg_distance_km: 15,
      working_days: 220,
      mode_ef: 0.171,
    }));

    // 500 * 15 * 2 * 220 * 0.171 / 1000 = 564.3
    expect(result.result).toBeCloseTo(564.3, 1);
  });
});

describe('Water Consumption', () => {
  it('calculates 1000 m3 withdrawal - 400 m3 discharge = 600 m3', async () => {
    const result = await calculate(makeRequest('water_consumption', {
      withdrawal_m3: 1000,
      discharge_m3: 400,
    }));

    expect(result.result).toBe(600);
    expect(result.unit).toBe('m3');
  });

  it('rejects discharge > withdrawal', async () => {
    await expect(
      calculate(makeRequest('water_consumption', {
        withdrawal_m3: 400,
        discharge_m3: 600,
      })),
    ).rejects.toThrow('Discharge cannot exceed withdrawal');
  });
});

describe('Safety LTIFR', () => {
  it('calculates 3 LTIs / 7.1M hours -> ~0.42', async () => {
    const result = await calculate(makeRequest('safety_ltifr', {
      lost_time_injuries: 3,
      hours_worked: 7100000,
    }));

    expect(result.result).toBeCloseTo(0.42, 2);
    expect(result.unit).toBe('per 1,000,000 hours');
  });

  it('rejects negative hours', async () => {
    await expect(
      calculate(makeRequest('safety_ltifr', {
        lost_time_injuries: 3,
        hours_worked: -100,
      })),
    ).rejects.toThrow('must not be negative');
  });

  it('rejects zero hours', async () => {
    await expect(
      calculate(makeRequest('safety_ltifr', {
        lost_time_injuries: 3,
        hours_worked: 0,
      })),
    ).rejects.toThrow('must be greater than zero');
  });
});

describe('Safety TRIR', () => {
  it('calculates TRIR correctly', async () => {
    const result = await calculate(makeRequest('safety_trir', {
      recordable_incidents: 5,
      hours_worked: 1000000,
    }));

    expect(result.result).toBe(1);
    expect(result.unit).toBe('per 200,000 hours');
  });
});

describe('Energy Total', () => {
  it('calculates electricity + fuels in GJ', async () => {
    const result = await calculate(makeRequest('energy_total', {
      electricity_kwh: 1000000,
      fuels: [
        { type: 'natural_gas', amount: 50000, unit: 'm3' },
      ],
    }));

    // Electricity: 1,000,000 * 0.0036 = 3600 GJ
    // Gas: 50000 * 0.0388 = 1940 GJ
    expect(result.result).toBeCloseTo(5540, 0);
  });
});

describe('Intensity Revenue', () => {
  it('calculates metric per revenue', async () => {
    const result = await calculate(makeRequest('intensity_revenue', {
      metric_value: 1000,
      revenue: 50000000,
      metric_unit: 'tCO2e',
    }));

    expect(result.result).toBeCloseTo(0.00002, 5);
  });
});

describe('Intensity Employee', () => {
  it('calculates metric per FTE', async () => {
    const result = await calculate(makeRequest('intensity_employee', {
      metric_value: 5000,
      fte: 250,
      metric_unit: 'tCO2e',
    }));

    expect(result.result).toBe(20);
  });
});

describe('YoY Change', () => {
  it('calculates 487,320 vs 503,400 -> -3.19%', async () => {
    const result = await calculate(makeRequest('yoy_change', {
      current_value: 487320,
      previous_value: 503400,
    }));

    expect(result.result).toBeCloseTo(-3.19, 1);
    expect(result.unit).toBe('%');
  });

  it('rejects zero previous value', async () => {
    await expect(
      calculate(makeRequest('yoy_change', {
        current_value: 100,
        previous_value: 0,
      })),
    ).rejects.toThrow('must be non-zero');
  });
});

describe('Waste by Type', () => {
  it('calculates mass and emissions', async () => {
    const result = await calculate(makeRequest('waste_by_type', {
      waste_streams: [
        { type: 'general', mass_tonnes: 100, disposal_method: 'landfill' },
        { type: 'recyclable', mass_tonnes: 50, disposal_method: 'recycling' },
      ],
    }));

    const res = result.result as Record<string, number>;
    expect(res['total_mass_tonnes']).toBe(150);
    expect(res['total_emissions_tco2e']).toBeDefined();
  });
});

// ============================================================
// CLIMATE RISK TESTS (17-21)
// ============================================================

describe('Carbon Budget Remaining', () => {
  it('calculates budget for 100,000 tCO2e, 50% reduction by 2030, 1.5C', async () => {
    const result = await calculate(makeRequest('carbon_budget_remaining', {
      current_annual_emissions: 100000,
      reduction_target_pct: 50,
      target_year: 2030,
      scenario: '1.5C',
      base_year: 2024,
    }));

    const res = result.result as Record<string, unknown>;
    expect(res['years_remaining']).toBeDefined();
    expect(typeof res['years_remaining']).toBe('number');
    expect(res['required_annual_reduction_pct']).toBe(4.2);
    expect(res['cumulative_planned_emissions']).toBeGreaterThan(0);
    expect(res['cumulative_budget']).toBeGreaterThan(0);
    expect(result.methodology).toContain('IPCC');
  });

  it('rejects invalid scenario', async () => {
    await expect(
      calculate(makeRequest('carbon_budget_remaining', {
        current_annual_emissions: 100000,
        reduction_target_pct: 50,
        target_year: 2030,
        scenario: '3C',
      })),
    ).rejects.toThrow('scenario must be 1.5C or 2C');
  });
});

describe('Physical Risk Score', () => {
  it('calculates portfolio risk from assets', async () => {
    const result = await calculate(makeRequest('physical_risk_score', {
      assets: [
        { location: { lat: 24.7, lng: 46.7 }, value: 10000000, type: 'office' },
        { location: { lat: 25.3, lng: 55.3 }, value: 5000000, type: 'warehouse' },
      ],
    }));

    const res = result.result as Record<string, unknown>;
    expect(res['portfolio_score']).toBeGreaterThanOrEqual(1);
    expect(res['portfolio_score']).toBeLessThanOrEqual(100);
    expect(res['asset_scores']).toHaveLength(2);
  });
});

describe('Stranded Asset Value', () => {
  it('calculates value at risk for 1.5C scenario', async () => {
    const result = await calculate(makeRequest('stranded_asset_value', {
      fossil_fuel_assets: [
        { value: 1000000, asset_type: 'coal' },
        { value: 500000, asset_type: 'gas' },
      ],
      scenario: '1.5C',
    }));

    const res = result.result as Record<string, unknown>;
    expect(res['value_at_risk']).toBeGreaterThan(0);
    // Coal: 1M * 0.90 = 900K, Gas: 500K * 0.40 = 200K => 1.1M
    expect(res['value_at_risk']).toBeCloseTo(1100000, -3);
    expect(res['risk_percentage']).toBeGreaterThan(0);
  });
});

describe('Carbon Price Impact', () => {
  it('calculates annual cost impact', async () => {
    const result = await calculate(makeRequest('carbon_price_impact', {
      scope1_emissions: 5000,
      scope2_emissions: 3000,
      scenario: '2C',
      projection_years: 5,
    }));

    const res = result.result as Record<string, unknown>;
    expect(res['total_emissions']).toBe(8000);
    const costs = res['annual_cost_impact'] as Array<{ year: number; cost: number }>;
    expect(costs).toHaveLength(5);
    // Year 1: 8000 * 80 = 640,000
    expect(costs[0]!.cost).toBe(640000);
  });
});

describe('SBTi Target Validation', () => {
  it('validates aligned target (below pathway)', async () => {
    // Cross-sector 1.5C: 4.2%/yr over 10 years = 42% reduction needed
    // Base: 100000, target 10 years later: must be <= 58000
    const result = await calculate(makeRequest('sbti_validation', {
      base_year_emissions: 100000,
      target_year_emissions: 50000, // 50% reduction > 42% required
      target_year: 2030,
      base_year: 2020,
      scope: 'scope1+2',
      sector: 'cross-sector',
    }));

    const res = result.result as Record<string, unknown>;
    expect(res['aligned']).toBe(true);
    expect(res['gap_pct']).toBe(0);
    expect(res['pathway']).toBe('1.5C');
  });

  it('flags misaligned target (above pathway)', async () => {
    // 42% reduction needed over 10 years, but only 20% reduction
    const result = await calculate(makeRequest('sbti_validation', {
      base_year_emissions: 100000,
      target_year_emissions: 80000, // Only 20% reduction
      target_year: 2030,
      base_year: 2020,
      scope: 'scope1+2',
      sector: 'cross-sector',
    }));

    const res = result.result as Record<string, unknown>;
    expect(res['aligned']).toBe(false);
    expect(res['gap_pct']).toBeGreaterThan(0);
  });
});

// ============================================================
// SUSTAINABLE FINANCE TESTS (22-26)
// ============================================================

describe('Portfolio Carbon Footprint (SFDR PAI #1)', () => {
  it('calculates tCO2e per EUR M for 2 holdings', async () => {
    const result = await calculate(makeRequest('portfolio_carbon_footprint', {
      holdings: [
        { name: 'Company A', investment_value: 1000000, enterprise_value: 5000000, scope1: 10000, scope2: 5000 },
        { name: 'Company B', investment_value: 500000, enterprise_value: 2000000, scope1: 3000, scope2: 2000 },
      ],
      portfolio_value: 1500000,
    }));

    // A: (1M/5M) * 15000 = 3000
    // B: (500K/2M) * 5000 = 1250
    // Total attributed: 4250
    // Per M: 4250 / 1.5M * 1M = 2833.33
    expect(result.result).toBeCloseTo(2833.33, 0);
    expect(result.unit).toContain('EUR M');
  });
});

describe('Portfolio Carbon Intensity (SFDR PAI #2)', () => {
  it('calculates intensity per EUR M revenue', async () => {
    const result = await calculate(makeRequest('portfolio_carbon_intensity', {
      holdings: [
        { name: 'Co A', investment_value: 1000000, enterprise_value: 5000000, emissions: 10000, revenue: 20000000 },
      ],
    }));

    // (1M/5M) * (10000/20M) * 1M = 0.2 * 0.0005 * 1M = 100
    expect(result.result).toBeCloseTo(100, 0);
  });
});

describe('EU Taxonomy Alignment', () => {
  it('calculates alignment for 3 activities (2 aligned)', async () => {
    const result = await calculate(makeRequest('eu_taxonomy_alignment', {
      activities: [
        { nace_code: 'D35.11', revenue: 5000000, capex: 1000000, opex: 500000, meets_screening: true, meets_dnsh: true, meets_safeguards: true },
        { nace_code: 'F41.1', revenue: 3000000, capex: 2000000, opex: 300000, meets_screening: true, meets_dnsh: true, meets_safeguards: true },
        { nace_code: 'C20.1', revenue: 2000000, capex: 500000, opex: 200000, meets_screening: true, meets_dnsh: false, meets_safeguards: true },
      ],
    }));

    const res = result.result as Record<string, unknown>;
    // Revenue aligned: (5M+3M)/10M = 80%
    expect(res['revenue_aligned_pct']).toBe(80);
    // CapEx aligned: (1M+2M)/3.5M = 85.71%
    expect(res['capex_aligned_pct']).toBeCloseTo(85.71, 1);
    // OpEx aligned: (500K+300K)/1M = 80%
    expect(res['opex_aligned_pct']).toBe(80);
    expect(res['aligned_activities']).toBe(2);
    expect(res['total_activities']).toBe(3);
  });
});

describe('Green Bond Allocation', () => {
  it('calculates allocation percentage', async () => {
    const result = await calculate(makeRequest('green_bond_allocation', {
      proceeds_total: 10000000,
      allocations: [
        { category: 'renewable_energy', amount: 4000000, project_id: 'RE-001' },
        { category: 'energy_efficiency', amount: 3000000, project_id: 'EE-001' },
        { category: 'clean_transport', amount: 2000000, project_id: 'CT-001' },
      ],
    }));

    const res = result.result as Record<string, unknown>;
    expect(res['allocation_pct']).toBe(90);
    expect(res['unallocated']).toBe(1000000);
    expect(res['total_allocated']).toBe(9000000);
  });

  it('rejects over-allocation', async () => {
    await expect(
      calculate(makeRequest('green_bond_allocation', {
        proceeds_total: 1000000,
        allocations: [
          { category: 'energy', amount: 600000, project_id: 'P1' },
          { category: 'water', amount: 500000, project_id: 'P2' },
        ],
      })),
    ).rejects.toThrow('exceed');
  });
});

describe('WACI', () => {
  it('calculates weighted average carbon intensity for 3 holdings', async () => {
    const result = await calculate(makeRequest('waci', {
      holdings: [
        { name: 'Co A', weight_pct: 50, emissions: 10000, revenue: 100000000 },
        { name: 'Co B', weight_pct: 30, emissions: 5000, revenue: 50000000 },
        { name: 'Co C', weight_pct: 20, emissions: 2000, revenue: 20000000 },
      ],
    }));

    // A: 0.50 * (10000/100M) * 1M = 50
    // B: 0.30 * (5000/50M) * 1M = 30
    // C: 0.20 * (2000/20M) * 1M = 20
    // Total: 100
    expect(result.result).toBeCloseTo(100, 0);
    expect(result.unit).toContain('$M revenue');
  });
});

// ============================================================
// ENVIRONMENTAL TESTS (27-29)
// ============================================================

describe('Water Footprint', () => {
  it('calculates blue=500, green=200, grey=300 -> total=1000', async () => {
    const result = await calculate(makeRequest('water_footprint', {
      blue_m3: 500,
      green_m3: 200,
      grey_m3: 300,
    }));

    const res = result.result as Record<string, unknown>;
    expect(res['total_m3']).toBe(1000);
    expect(res['blue_m3']).toBe(500);
    expect(res['green_m3']).toBe(200);
    expect(res['grey_m3']).toBe(300);
    expect(res['blue_pct']).toBe(50);
    expect(res['green_pct']).toBe(20);
    expect(res['grey_pct']).toBe(30);
  });
});

describe('Biodiversity MSA Loss', () => {
  it('calculates MSA.ha from land use changes', async () => {
    const result = await calculate(makeRequest('biodiversity_msa_loss', {
      land_use_changes: [
        { area_ha: 100, use_type: 'urban', previous_use: 'grassland', duration_years: 1 },
        { area_ha: 50, use_type: 'cropland_intensive', previous_use: 'secondary_forest', duration_years: 1 },
      ],
    }));

    // Urban from grassland: 100 * (0.95 - 0.10) * 1 = 85
    // Cropland from secondary_forest: 50 * (0.70 - 0.15) * 1 = 27.5
    expect(result.result).toBeCloseTo(112.5, 1);
    expect(result.unit).toBe('MSA.ha');
  });
});

describe('Circular Economy MCI', () => {
  it('calculates MCI between 0 and 1', async () => {
    const result = await calculate(makeRequest('circular_economy_mci', {
      virgin_material_input: 600,
      recycled_input: 400,
      waste_to_landfill: 200,
      waste_recycled: 800,
      product_lifetime: 10,
      industry_avg_lifetime: 8,
    }));

    expect(result.result as number).toBeGreaterThan(0);
    expect(result.result as number).toBeLessThanOrEqual(1);
    expect(result.unit).toBe('score (0-1)');
  });

  it('returns low MCI for highly linear product', async () => {
    const result = await calculate(makeRequest('circular_economy_mci', {
      virgin_material_input: 1000,
      recycled_input: 0,
      waste_to_landfill: 1000,
      waste_recycled: 0,
      product_lifetime: 5,
      industry_avg_lifetime: 10,
    }));

    // Fully linear: LFI close to 1, short lifetime => low MCI
    expect(result.result as number).toBeLessThan(0.3);
  });

  it('returns high MCI for circular product', async () => {
    const result = await calculate(makeRequest('circular_economy_mci', {
      virgin_material_input: 100,
      recycled_input: 900,
      waste_to_landfill: 50,
      waste_recycled: 950,
      product_lifetime: 15,
      industry_avg_lifetime: 10,
    }));

    expect(result.result as number).toBeGreaterThan(0.7);
  });
});

// ============================================================
// API Route Tests
// ============================================================

describe('POST /api/v1/calculate', () => {
  it('returns 200 for valid calculation via API', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/calculate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        method: 'water_consumption',
        inputs: { withdrawal_m3: 1000, discharge_m3: 400 },
        engagementId: TEST_ENGAGEMENT_ID,
        disclosureRef: 'gri-303-5',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.result.result).toBe(600);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/calculate',
      payload: {
        method: 'water_consumption',
        inputs: { withdrawal_m3: 1000, discharge_m3: 400 },
        engagementId: TEST_ENGAGEMENT_ID,
        disclosureRef: 'gri-303-5',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for invalid method', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/calculate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        method: 'invalid_method',
        inputs: {},
        engagementId: TEST_ENGAGEMENT_ID,
        disclosureRef: 'test',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for validation error (negative hours)', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/calculate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        method: 'safety_ltifr',
        inputs: { lost_time_injuries: 3, hours_worked: -100 },
        engagementId: TEST_ENGAGEMENT_ID,
        disclosureRef: 'test',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/v1/engagements/:id/auto-calculate', () => {
  it('returns available methods', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/auto-calculate`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.availableMethods).toContain('ghg_scope1');
    expect(body.availableMethods).toContain('carbon_budget_remaining');
    expect(body.availableMethods).toContain('waci');
    expect(body.availableMethods).toContain('circular_economy_mci');
    expect(body.availableMethods).toHaveLength(29);
  });
});
