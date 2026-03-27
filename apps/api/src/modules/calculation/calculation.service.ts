import { z } from 'zod';
import {
  CalculationMethodSchema,
  CalculationRequestSchema,
} from '@merris/shared';
import { EmissionFactor, IEmissionFactor } from '../../models/emission-factor.model.js';
import { AppError } from '../auth/auth.service.js';

// ============================================================
// Types
// ============================================================

export type CalculationMethod = z.infer<typeof CalculationMethodSchema>;

export interface CalculationResult {
  method: CalculationMethod;
  result: number | Record<string, unknown>;
  unit: string;
  inputs: Record<string, unknown>;
  emissionFactors?: Array<{
    source: string;
    country: string;
    gridRegion?: string;
    year: number;
    factor: number;
    unit: string;
    scope: 1 | 2 | 3;
    category?: string;
    fuelType?: string;
    activityType?: string;
  }>;
  methodology: string;
  uncertainty?: number;
  auditTrail: string;
}

export interface CalculationInput {
  method: CalculationMethod;
  inputs: Record<string, unknown>;
  engagementId: string;
  disclosureRef: string;
}

// ============================================================
// Validation Helpers
// ============================================================

function requirePositive(value: unknown, name: string): number {
  const n = Number(value);
  if (isNaN(n)) throw new AppError(`${name} must be a number`, 400);
  if (n < 0) throw new AppError(`${name} must not be negative`, 400);
  return n;
}

function requireNumber(value: unknown, name: string): number {
  const n = Number(value);
  if (isNaN(n)) throw new AppError(`${name} must be a number`, 400);
  return n;
}

function requireArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new AppError(`${name} must be an array`, 400);
  if (value.length === 0) throw new AppError(`${name} must not be empty`, 400);
  return value;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new AppError(`${name} must be a non-empty string`, 400);
  return value;
}

function toEF(ef: IEmissionFactor) {
  return {
    source: ef.source,
    country: ef.country,
    gridRegion: ef.gridRegion,
    year: ef.year,
    factor: ef.factor,
    unit: ef.unit,
    scope: ef.scope as 1 | 2 | 3,
    category: ef.category,
    fuelType: ef.fuelType,
    activityType: ef.activityType,
  };
}

// ============================================================
// Emission Factor Lookup (injectable for testing)
// ============================================================

export type EmissionFactorLookup = (filters: {
  country?: string;
  scope?: number;
  category?: string;
  fuelType?: string;
}) => Promise<IEmissionFactor | null>;

let _lookupFn: EmissionFactorLookup = async (filters) => {
  const query: Record<string, unknown> = {};
  if (filters.country) query['country'] = { $regex: new RegExp(filters.country, 'i') };
  if (filters.scope) query['scope'] = filters.scope;
  if (filters.category) query['category'] = { $regex: new RegExp(filters.category, 'i') };
  if (filters.fuelType) query['fuelType'] = { $regex: new RegExp(filters.fuelType, 'i') };
  return EmissionFactor.findOne(query).sort({ year: -1 }).lean() as unknown as IEmissionFactor | null;
};

/** Override the emission factor lookup for testing */
export function setEmissionFactorLookup(fn: EmissionFactorLookup): void {
  _lookupFn = fn;
}

/** Reset to default database lookup */
export function resetEmissionFactorLookup(): void {
  _lookupFn = async (filters) => {
    const query: Record<string, unknown> = {};
    if (filters.country) query['country'] = { $regex: new RegExp(filters.country, 'i') };
    if (filters.scope) query['scope'] = filters.scope;
    if (filters.category) query['category'] = { $regex: new RegExp(filters.category, 'i') };
    if (filters.fuelType) query['fuelType'] = { $regex: new RegExp(filters.fuelType, 'i') };
    return EmissionFactor.findOne(query).sort({ year: -1 }).lean() as unknown as IEmissionFactor | null;
  };
}

async function lookupEF(filters: Parameters<EmissionFactorLookup>[0]): Promise<IEmissionFactor> {
  const ef = await _lookupFn(filters);
  if (!ef) {
    throw new AppError(
      `Emission factor not found for: ${JSON.stringify(filters)}`,
      404,
    );
  }
  return ef;
}

// ============================================================
// Master Dispatcher
// ============================================================

export async function calculate(request: CalculationInput): Promise<CalculationResult> {
  const parsed = CalculationRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new AppError(`Invalid calculation request: ${parsed.error.message}`, 400);
  }

  const { method, inputs } = parsed.data;

  switch (method) {
    case 'ghg_scope1': return calcGHGScope1(inputs);
    case 'ghg_scope2_location': return calcGHGScope2Location(inputs);
    case 'ghg_scope2_market': return calcGHGScope2Market(inputs);
    case 'ghg_scope3_cat1_spend': return calcGHGScope3Cat1Spend(inputs);
    case 'ghg_scope3_cat1_supplier': return calcGHGScope3Cat1Supplier(inputs);
    case 'ghg_scope3_cat3': return calcGHGScope3Cat3(inputs);
    case 'ghg_scope3_cat6': return calcGHGScope3Cat6(inputs);
    case 'ghg_scope3_cat7': return calcGHGScope3Cat7(inputs);
    case 'water_consumption': return calcWaterConsumption(inputs);
    case 'waste_by_type': return calcWasteByType(inputs);
    case 'safety_ltifr': return calcSafetyLTIFR(inputs);
    case 'safety_trir': return calcSafetyTRIR(inputs);
    case 'energy_total': return calcEnergyTotal(inputs);
    case 'intensity_revenue': return calcIntensityRevenue(inputs);
    case 'intensity_employee': return calcIntensityEmployee(inputs);
    case 'yoy_change': return calcYoYChange(inputs);
    // Climate Risk
    case 'carbon_budget_remaining': return calcCarbonBudgetRemaining(inputs);
    case 'physical_risk_score': return calcPhysicalRiskScore(inputs);
    case 'stranded_asset_value': return calcStrandedAssetValue(inputs);
    case 'carbon_price_impact': return calcCarbonPriceImpact(inputs);
    case 'sbti_validation': return calcSBTiValidation(inputs);
    // Sustainable Finance
    case 'portfolio_carbon_footprint': return calcPortfolioCarbonFootprint(inputs);
    case 'portfolio_carbon_intensity': return calcPortfolioCarbonIntensity(inputs);
    case 'eu_taxonomy_alignment': return calcEUTaxonomyAlignment(inputs);
    case 'green_bond_allocation': return calcGreenBondAllocation(inputs);
    case 'waci': return calcWACI(inputs);
    // Environmental
    case 'water_footprint': return calcWaterFootprint(inputs);
    case 'biodiversity_msa_loss': return calcBiodiversityMSALoss(inputs);
    case 'circular_economy_mci': return calcCircularEconomyMCI(inputs);
    default:
      throw new AppError(`Unknown calculation method: ${method}`, 400);
  }
}

// ============================================================
// 1. GHG Scope 1
// ============================================================

async function calcGHGScope1(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const sources = requireArray(inputs['sources'], 'sources') as Array<{
    fuel_type: string;
    activity_data: number;
    unit: string;
    country?: string;
  }>;

  let totalEmissions = 0;
  const steps: string[] = [];
  const factors: CalculationResult['emissionFactors'] = [];

  for (const src of sources) {
    const activityData = requirePositive(src.activity_data, 'activity_data');
    const fuelType = requireString(src.fuel_type, 'fuel_type');
    const country = src.country || 'global';

    const ef = await lookupEF({ fuelType, scope: 1, country });
    const emissions = activityData * ef.factor / 1000; // kg to tonnes
    totalEmissions += emissions;
    factors.push(toEF(ef));
    steps.push(`${fuelType}: ${activityData} ${src.unit || 'units'} x ${ef.factor} ${ef.unit} = ${emissions.toFixed(4)} tCO2e`);
  }

  return {
    method: 'ghg_scope1',
    result: round(totalEmissions, 4),
    unit: 'tCO2e',
    inputs,
    emissionFactors: factors,
    methodology: 'GHG Protocol Corporate Standard — Scope 1 Direct Emissions. Formula: Sum(Activity Data x Emission Factor) per fuel/source.',
    uncertainty: 0.05,
    auditTrail: `GHG Scope 1 Calculation:\n${steps.join('\n')}\nTotal: ${round(totalEmissions, 4)} tCO2e`,
  };
}

// ============================================================
// 2. GHG Scope 2 Location-Based
// ============================================================

async function calcGHGScope2Location(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const electricity_kwh = requirePositive(inputs['electricity_kwh'], 'electricity_kwh');
  const country = requireString(inputs['country'], 'country');

  const ef = await lookupEF({ country, scope: 2, category: 'grid-electricity' });

  // Factor is in kgCO2e/kWh — convert to tCO2e
  const emissions = (electricity_kwh * ef.factor) / 1000;

  return {
    method: 'ghg_scope2_location',
    result: round(emissions, 4),
    unit: 'tCO2e',
    inputs,
    emissionFactors: [toEF(ef)],
    methodology: 'GHG Protocol Scope 2 Guidance — Location-Based Method. Formula: Electricity (kWh) x Grid Emission Factor (kgCO2e/kWh) / 1000.',
    uncertainty: 0.05,
    auditTrail: `GHG Scope 2 Location-Based Calculation:\nElectricity: ${electricity_kwh} kWh\nGrid EF (${country}): ${ef.factor} ${ef.unit}\nEmissions: ${electricity_kwh} x ${ef.factor} / 1000 = ${round(emissions, 4)} tCO2e`,
  };
}

// ============================================================
// 3. GHG Scope 2 Market-Based
// ============================================================

async function calcGHGScope2Market(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const electricity_kwh = requirePositive(inputs['electricity_kwh'], 'electricity_kwh');
  const supplier_ef = requirePositive(inputs['supplier_ef'], 'supplier_ef'); // kgCO2e/kWh

  const emissions = (electricity_kwh * supplier_ef) / 1000;

  return {
    method: 'ghg_scope2_market',
    result: round(emissions, 4),
    unit: 'tCO2e',
    inputs,
    methodology: 'GHG Protocol Scope 2 Guidance — Market-Based Method. Formula: Electricity (kWh) x Supplier/Residual Mix EF (kgCO2e/kWh) / 1000.',
    uncertainty: 0.03,
    auditTrail: `GHG Scope 2 Market-Based Calculation:\nElectricity: ${electricity_kwh} kWh\nSupplier EF: ${supplier_ef} kgCO2e/kWh\nEmissions: ${electricity_kwh} x ${supplier_ef} / 1000 = ${round(emissions, 4)} tCO2e`,
  };
}

// ============================================================
// 4. GHG Scope 3 Cat 1 Spend-Based
// ============================================================

async function calcGHGScope3Cat1Spend(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const spend = requirePositive(inputs['spend'], 'spend');
  const spend_ef = requirePositive(inputs['spend_ef'], 'spend_ef'); // kgCO2e per currency unit

  const emissions = (spend * spend_ef) / 1000;

  return {
    method: 'ghg_scope3_cat1_spend',
    result: round(emissions, 4),
    unit: 'tCO2e',
    inputs,
    methodology: 'GHG Protocol Scope 3 Category 1 — Spend-Based Method. Formula: Spend x Spend-Based EF.',
    uncertainty: 0.30,
    auditTrail: `GHG Scope 3 Cat 1 Spend-Based:\nSpend: ${spend}\nSpend EF: ${spend_ef} kgCO2e/unit\nEmissions: ${spend} x ${spend_ef} / 1000 = ${round(emissions, 4)} tCO2e`,
  };
}

// ============================================================
// 5. GHG Scope 3 Cat 1 Supplier-Specific
// ============================================================

async function calcGHGScope3Cat1Supplier(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const suppliers = requireArray(inputs['suppliers'], 'suppliers') as Array<{
    name: string;
    emissions: number;
  }>;

  let total = 0;
  const steps: string[] = [];

  for (const s of suppliers) {
    const e = requirePositive(s.emissions, `emissions for ${s.name}`);
    total += e;
    steps.push(`${s.name}: ${e} tCO2e`);
  }

  return {
    method: 'ghg_scope3_cat1_supplier',
    result: round(total, 4),
    unit: 'tCO2e',
    inputs,
    methodology: 'GHG Protocol Scope 3 Category 1 — Supplier-Specific Method. Formula: Sum(Supplier reported emissions).',
    uncertainty: 0.10,
    auditTrail: `GHG Scope 3 Cat 1 Supplier-Specific:\n${steps.join('\n')}\nTotal: ${round(total, 4)} tCO2e`,
  };
}

// ============================================================
// 6. GHG Scope 3 Cat 3 — Fuel & Energy
// ============================================================

async function calcGHGScope3Cat3(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const electricity_kwh = requirePositive(inputs['electricity_kwh'], 'electricity_kwh');
  const wtt_ef = requirePositive(inputs['wtt_ef'], 'wtt_ef'); // kgCO2e/kWh for well-to-tank
  const td_loss_pct = requirePositive(inputs['td_loss_pct'], 'td_loss_pct'); // T&D loss percentage
  const grid_ef = requirePositive(inputs['grid_ef'], 'grid_ef'); // kgCO2e/kWh

  const wttEmissions = (electricity_kwh * wtt_ef) / 1000;
  const tdEmissions = (electricity_kwh * (td_loss_pct / 100) * grid_ef) / 1000;
  const total = wttEmissions + tdEmissions;

  return {
    method: 'ghg_scope3_cat3',
    result: round(total, 4),
    unit: 'tCO2e',
    inputs,
    methodology: 'GHG Protocol Scope 3 Category 3 — Fuel and Energy Related Activities. Formula: WTT emissions + T&D loss emissions.',
    uncertainty: 0.15,
    auditTrail: `GHG Scope 3 Cat 3 (Fuel & Energy):\nWTT: ${electricity_kwh} kWh x ${wtt_ef} / 1000 = ${round(wttEmissions, 4)} tCO2e\nT&D: ${electricity_kwh} x ${td_loss_pct}% x ${grid_ef} / 1000 = ${round(tdEmissions, 4)} tCO2e\nTotal: ${round(total, 4)} tCO2e`,
  };
}

// ============================================================
// 7. GHG Scope 3 Cat 6 — Business Travel
// ============================================================

async function calcGHGScope3Cat6(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const trips = requireArray(inputs['trips'], 'trips') as Array<{
    mode: string;
    distance_km: number;
    ef?: number; // kgCO2e/km, optional
  }>;

  // Default mode EFs (kgCO2e per passenger-km) — DEFRA 2023 approx
  const DEFAULT_MODE_EFS: Record<string, number> = {
    'air_short': 0.255,
    'air_long': 0.195,
    'air': 0.195,
    'rail': 0.041,
    'car': 0.171,
    'bus': 0.089,
    'taxi': 0.209,
  };

  let total = 0;
  const steps: string[] = [];

  for (const trip of trips) {
    const distance = requirePositive(trip.distance_km, 'distance_km');
    const mode = requireString(trip.mode, 'mode');
    const ef = trip.ef ?? DEFAULT_MODE_EFS[mode.toLowerCase()];
    if (ef === undefined) throw new AppError(`Unknown travel mode: ${mode}. Provide ef manually.`, 400);

    const emissions = (distance * ef) / 1000;
    total += emissions;
    steps.push(`${mode}: ${distance} km x ${ef} kgCO2e/km / 1000 = ${round(emissions, 4)} tCO2e`);
  }

  return {
    method: 'ghg_scope3_cat6',
    result: round(total, 4),
    unit: 'tCO2e',
    inputs,
    methodology: 'GHG Protocol Scope 3 Category 6 — Business Travel. Formula: Sum(Distance x Mode EF). Default EFs from DEFRA 2023.',
    uncertainty: 0.10,
    auditTrail: `GHG Scope 3 Cat 6 (Business Travel):\n${steps.join('\n')}\nTotal: ${round(total, 4)} tCO2e`,
  };
}

// ============================================================
// 8. GHG Scope 3 Cat 7 — Employee Commuting
// ============================================================

async function calcGHGScope3Cat7(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const employees = requirePositive(inputs['employees'], 'employees');
  const avg_distance_km = requirePositive(inputs['avg_distance_km'], 'avg_distance_km');
  const working_days = requirePositive(inputs['working_days'], 'working_days');
  const mode_ef = requirePositive(inputs['mode_ef'], 'mode_ef'); // kgCO2e/km

  // Round trip = x2
  const totalKm = employees * avg_distance_km * 2 * working_days;
  const emissions = (totalKm * mode_ef) / 1000;

  return {
    method: 'ghg_scope3_cat7',
    result: round(emissions, 4),
    unit: 'tCO2e',
    inputs,
    methodology: 'GHG Protocol Scope 3 Category 7 — Employee Commuting. Formula: Employees x Distance (round trip) x Mode EF x Working Days.',
    uncertainty: 0.30,
    auditTrail: `GHG Scope 3 Cat 7 (Employee Commuting):\nEmployees: ${employees}\nAvg round-trip: ${avg_distance_km * 2} km\nWorking days: ${working_days}\nMode EF: ${mode_ef} kgCO2e/km\nTotal km: ${totalKm}\nEmissions: ${totalKm} x ${mode_ef} / 1000 = ${round(emissions, 4)} tCO2e`,
  };
}

// ============================================================
// 9. Water Consumption
// ============================================================

async function calcWaterConsumption(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const withdrawal = requirePositive(inputs['withdrawal_m3'], 'withdrawal_m3');
  const discharge = requirePositive(inputs['discharge_m3'], 'discharge_m3');

  if (discharge > withdrawal) {
    throw new AppError('Discharge cannot exceed withdrawal', 400);
  }

  const consumption = withdrawal - discharge;

  return {
    method: 'water_consumption',
    result: round(consumption, 2),
    unit: 'm3',
    inputs,
    methodology: 'GRI 303-5 Water Consumption. Formula: Withdrawal - Discharge.',
    uncertainty: 0.05,
    auditTrail: `Water Consumption:\nWithdrawal: ${withdrawal} m3\nDischarge: ${discharge} m3\nConsumption: ${withdrawal} - ${discharge} = ${round(consumption, 2)} m3`,
  };
}

// ============================================================
// 10. Waste by Type
// ============================================================

async function calcWasteByType(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const waste_streams = requireArray(inputs['waste_streams'], 'waste_streams') as Array<{
    type: string;
    mass_tonnes: number;
    disposal_method: string;
    ef?: number; // kgCO2e/tonne, optional
  }>;

  // Default disposal EFs (kgCO2e per tonne) — EPA/DEFRA approx
  const DEFAULT_DISPOSAL_EFS: Record<string, number> = {
    'landfill': 587,
    'incineration': 21.3,
    'recycling': -46,
    'composting': -23,
    'anaerobic_digestion': -46,
  };

  let totalMass = 0;
  let totalEmissions = 0;
  const steps: string[] = [];

  for (const ws of waste_streams) {
    const mass = requirePositive(ws.mass_tonnes, 'mass_tonnes');
    const disposal = requireString(ws.disposal_method, 'disposal_method');
    const ef = ws.ef ?? DEFAULT_DISPOSAL_EFS[disposal.toLowerCase()];
    if (ef === undefined) throw new AppError(`Unknown disposal method: ${disposal}. Provide ef manually.`, 400);

    totalMass += mass;
    const emissions = (mass * ef) / 1000;
    totalEmissions += emissions;
    steps.push(`${ws.type} (${disposal}): ${mass} t x ${ef} kgCO2e/t / 1000 = ${round(emissions, 4)} tCO2e`);
  }

  return {
    method: 'waste_by_type',
    result: {
      total_mass_tonnes: round(totalMass, 2),
      total_emissions_tco2e: round(totalEmissions, 4),
    },
    unit: 'tonnes + tCO2e',
    inputs,
    methodology: 'GRI 306-3/4/5 Waste by Type. Formula: Sum(Mass x Disposal EF). Default EFs from EPA WARM/DEFRA.',
    uncertainty: 0.15,
    auditTrail: `Waste by Type:\n${steps.join('\n')}\nTotal mass: ${round(totalMass, 2)} tonnes\nTotal emissions: ${round(totalEmissions, 4)} tCO2e`,
  };
}

// ============================================================
// 11. Safety LTIFR
// ============================================================

async function calcSafetyLTIFR(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const ltis = requirePositive(inputs['lost_time_injuries'], 'lost_time_injuries');
  const hours = requirePositive(inputs['hours_worked'], 'hours_worked');

  if (hours === 0) throw new AppError('hours_worked must be greater than zero', 400);

  const rate = (ltis * 1_000_000) / hours;

  return {
    method: 'safety_ltifr',
    result: round(rate, 2),
    unit: 'per 1,000,000 hours',
    inputs,
    methodology: 'Lost Time Injury Frequency Rate (LTIFR). Formula: (LTIs x 1,000,000) / Hours Worked.',
    uncertainty: 0.02,
    auditTrail: `LTIFR Calculation:\nLTIs: ${ltis}\nHours worked: ${hours}\nRate: (${ltis} x 1,000,000) / ${hours} = ${round(rate, 2)}`,
  };
}

// ============================================================
// 12. Safety TRIR
// ============================================================

async function calcSafetyTRIR(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const recordable = requirePositive(inputs['recordable_incidents'], 'recordable_incidents');
  const hours = requirePositive(inputs['hours_worked'], 'hours_worked');

  if (hours === 0) throw new AppError('hours_worked must be greater than zero', 400);

  const rate = (recordable * 200_000) / hours;

  return {
    method: 'safety_trir',
    result: round(rate, 2),
    unit: 'per 200,000 hours',
    inputs,
    methodology: 'Total Recordable Incident Rate (TRIR/OSHA). Formula: (Recordable Incidents x 200,000) / Hours Worked.',
    uncertainty: 0.02,
    auditTrail: `TRIR Calculation:\nRecordable incidents: ${recordable}\nHours worked: ${hours}\nRate: (${recordable} x 200,000) / ${hours} = ${round(rate, 2)}`,
  };
}

// ============================================================
// 13. Energy Total
// ============================================================

async function calcEnergyTotal(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const electricity_kwh = requirePositive(inputs['electricity_kwh'], 'electricity_kwh');
  const fuels = (inputs['fuels'] as Array<{ type: string; amount: number; unit: string; conversion_factor_gj?: number }>) || [];

  // kWh to GJ: 1 kWh = 0.0036 GJ
  const electricityGJ = electricity_kwh * 0.0036;
  const steps: string[] = [`Electricity: ${electricity_kwh} kWh x 0.0036 = ${round(electricityGJ, 4)} GJ`];

  let fuelGJ = 0;
  // Default conversion factors to GJ
  const DEFAULT_FUEL_GJ: Record<string, number> = {
    'natural_gas_m3': 0.0388,
    'diesel_litres': 0.0385,
    'gasoline_litres': 0.0342,
    'lpg_kg': 0.0495,
    'coal_kg': 0.0295,
    'fuel_oil_litres': 0.0404,
  };

  for (const fuel of fuels) {
    const amount = requirePositive(fuel.amount, `fuel amount (${fuel.type})`);
    const key = `${fuel.type}_${fuel.unit}`.toLowerCase();
    const convFactor = fuel.conversion_factor_gj ?? DEFAULT_FUEL_GJ[key];
    if (convFactor === undefined) {
      throw new AppError(`No conversion factor for ${fuel.type} (${fuel.unit}). Provide conversion_factor_gj.`, 400);
    }
    const gj = amount * convFactor;
    fuelGJ += gj;
    steps.push(`${fuel.type}: ${amount} ${fuel.unit} x ${convFactor} = ${round(gj, 4)} GJ`);
  }

  const total = electricityGJ + fuelGJ;

  return {
    method: 'energy_total',
    result: round(total, 4),
    unit: 'GJ',
    inputs,
    methodology: 'Total Energy Consumption (GRI 302-1). Formula: Sum(Fuel x Conversion) + Electricity (kWh x 0.0036).',
    uncertainty: 0.05,
    auditTrail: `Energy Total:\n${steps.join('\n')}\nTotal: ${round(total, 4)} GJ`,
  };
}

// ============================================================
// 14. Intensity — Revenue
// ============================================================

async function calcIntensityRevenue(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const metric_value = requireNumber(inputs['metric_value'], 'metric_value');
  const revenue = requirePositive(inputs['revenue'], 'revenue');

  if (revenue === 0) throw new AppError('revenue must be greater than zero', 400);

  const intensity = metric_value / revenue;
  const metric_unit = (inputs['metric_unit'] as string) || 'unit';

  return {
    method: 'intensity_revenue',
    result: round(intensity, 6),
    unit: `${metric_unit} per currency unit`,
    inputs,
    methodology: 'Intensity Ratio (Revenue). Formula: Metric Value / Revenue.',
    uncertainty: 0.03,
    auditTrail: `Intensity (Revenue):\nMetric: ${metric_value} ${metric_unit}\nRevenue: ${revenue}\nIntensity: ${metric_value} / ${revenue} = ${round(intensity, 6)} ${metric_unit}/currency unit`,
  };
}

// ============================================================
// 15. Intensity — Employee
// ============================================================

async function calcIntensityEmployee(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const metric_value = requireNumber(inputs['metric_value'], 'metric_value');
  const fte = requirePositive(inputs['fte'], 'fte');

  if (fte === 0) throw new AppError('fte must be greater than zero', 400);

  const intensity = metric_value / fte;
  const metric_unit = (inputs['metric_unit'] as string) || 'unit';

  return {
    method: 'intensity_employee',
    result: round(intensity, 6),
    unit: `${metric_unit} per employee`,
    inputs,
    methodology: 'Intensity Ratio (Employee). Formula: Metric Value / FTE.',
    uncertainty: 0.03,
    auditTrail: `Intensity (Employee):\nMetric: ${metric_value} ${metric_unit}\nFTE: ${fte}\nIntensity: ${metric_value} / ${fte} = ${round(intensity, 6)} ${metric_unit}/employee`,
  };
}

// ============================================================
// 16. YoY Change
// ============================================================

async function calcYoYChange(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const current = requireNumber(inputs['current_value'], 'current_value');
  const previous = requireNumber(inputs['previous_value'], 'previous_value');

  if (previous === 0) throw new AppError('previous_value must be non-zero for YoY calculation', 400);

  const change = ((current - previous) / Math.abs(previous)) * 100;

  return {
    method: 'yoy_change',
    result: round(change, 2),
    unit: '%',
    inputs,
    methodology: 'Year-over-Year Change. Formula: ((Current - Previous) / |Previous|) x 100.',
    uncertainty: 0.01,
    auditTrail: `YoY Change:\nCurrent: ${current}\nPrevious: ${previous}\nChange: ((${current} - ${previous}) / |${previous}|) x 100 = ${round(change, 2)}%`,
  };
}

// ============================================================
// 17. Carbon Budget Remaining
// ============================================================

async function calcCarbonBudgetRemaining(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const current_annual = requirePositive(inputs['current_annual_emissions'], 'current_annual_emissions');
  const target_pct = requirePositive(inputs['reduction_target_pct'], 'reduction_target_pct');
  const target_year = requirePositive(inputs['target_year'], 'target_year');
  const scenario = requireString(inputs['scenario'], 'scenario') as '1.5C' | '2C';
  const base_year = inputs['base_year'] ? requirePositive(inputs['base_year'], 'base_year') : 2024;

  if (target_pct > 100) throw new AppError('reduction_target_pct cannot exceed 100', 400);
  if (!['1.5C', '2C'].includes(scenario)) throw new AppError('scenario must be 1.5C or 2C', 400);

  const years_to_target = target_year - base_year;
  if (years_to_target <= 0) throw new AppError('target_year must be after base_year', 400);

  // Target annual emissions after reduction
  const target_annual = current_annual * (1 - target_pct / 100);

  // Cumulative emissions under linear reduction (trapezoid)
  const cumulative_planned = ((current_annual + target_annual) / 2) * years_to_target;

  // Allocated carbon budgets (simplified, based on IPCC AR6 global budgets scaled)
  // 1.5C: ~400 Gt remaining from 2024, roughly 4.2% annual decline needed globally
  // 2C: ~1150 Gt remaining from 2024, roughly 2.5% annual decline needed globally
  const required_annual_reduction_rate = scenario === '1.5C' ? 4.2 : 2.5;
  const required_annual_reduction_pct = required_annual_reduction_rate;

  // Calculate when overshoot occurs: year when cumulative linear exceeds budget
  // Budget for this entity is proportional — we use the required reduction rate
  let budget = 0;
  let cumulative = 0;
  let overshoot_year: number | null = null;

  for (let y = 0; y <= years_to_target; y++) {
    const year_emissions_planned = current_annual - (current_annual - target_annual) * (y / years_to_target);
    const year_emissions_required = current_annual * Math.pow(1 - required_annual_reduction_rate / 100, y);
    budget += year_emissions_required;
    cumulative += year_emissions_planned;

    if (cumulative > budget && overshoot_year === null) {
      overshoot_year = base_year + y;
    }
  }

  const years_remaining = overshoot_year ? overshoot_year - base_year : years_to_target;

  return {
    method: 'carbon_budget_remaining',
    result: {
      years_remaining,
      overshoot_year,
      required_annual_reduction_pct: round(required_annual_reduction_pct, 2),
      cumulative_planned_emissions: round(cumulative_planned, 2),
      cumulative_budget: round(budget, 2),
    },
    unit: 'years + tCO2e',
    inputs,
    methodology: 'Carbon Budget Analysis based on IPCC AR6. Compares linear reduction trajectory against scenario-aligned budget (1.5C: 4.2%/yr, 2C: 2.5%/yr required reduction).',
    uncertainty: 0.20,
    auditTrail: `Carbon Budget Remaining:\nCurrent annual: ${current_annual} tCO2e\nTarget: ${target_pct}% reduction by ${target_year}\nScenario: ${scenario}\nRequired annual reduction: ${required_annual_reduction_pct}%/yr\nYears remaining: ${years_remaining}\nOvershoot year: ${overshoot_year ?? 'none within target period'}\nCumulative planned: ${round(cumulative_planned, 2)} tCO2e\nCumulative budget: ${round(budget, 2)} tCO2e`,
  };
}

// ============================================================
// 18. Physical Risk Score
// ============================================================

async function calcPhysicalRiskScore(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const assets = requireArray(inputs['assets'], 'assets') as Array<{
    location: { lat: number; lng: number };
    value: number;
    type: string;
  }>;
  const hazard_weights = (inputs['hazard_weights'] as Record<string, number>) || {
    flooding: 0.25,
    heat_stress: 0.25,
    water_stress: 0.20,
    cyclone: 0.15,
    sea_level_rise: 0.15,
  };

  // Vulnerability factors by asset type (simplified)
  const VULNERABILITY: Record<string, number> = {
    'office': 0.3,
    'warehouse': 0.5,
    'manufacturing': 0.7,
    'data_center': 0.6,
    'retail': 0.4,
    'infrastructure': 0.8,
  };

  // Simplified hazard exposure by latitude bands
  function getHazardExposure(lat: number): Record<string, number> {
    const absLat = Math.abs(lat);
    if (absLat < 15) return { flooding: 0.7, heat_stress: 0.9, water_stress: 0.6, cyclone: 0.8, sea_level_rise: 0.5 };
    if (absLat < 30) return { flooding: 0.5, heat_stress: 0.7, water_stress: 0.8, cyclone: 0.4, sea_level_rise: 0.4 };
    if (absLat < 45) return { flooding: 0.4, heat_stress: 0.4, water_stress: 0.3, cyclone: 0.2, sea_level_rise: 0.3 };
    return { flooding: 0.3, heat_stress: 0.2, water_stress: 0.2, cyclone: 0.1, sea_level_rise: 0.2 };
  }

  const totalValue = assets.reduce((sum, a) => sum + a.value, 0);
  const assetScores: Array<{ type: string; score: number; value: number }> = [];
  let weightedPortfolioScore = 0;
  const steps: string[] = [];

  for (const asset of assets) {
    const value = requirePositive(asset.value, 'asset value');
    const vulnerability = VULNERABILITY[asset.type.toLowerCase()] ?? 0.5;
    const hazardExposure = getHazardExposure(asset.location.lat);

    // Weighted hazard score
    let hazardScore = 0;
    let totalWeight = 0;
    for (const [hazard, weight] of Object.entries(hazard_weights)) {
      const exposure = hazardExposure[hazard] ?? 0.3;
      hazardScore += exposure * weight;
      totalWeight += weight;
    }
    if (totalWeight > 0) hazardScore /= totalWeight;

    const rawScore = hazardScore * vulnerability * 100;
    const score = Math.min(100, Math.max(1, round(rawScore, 1)));
    assetScores.push({ type: asset.type, score, value });

    const normalizedValue = totalValue > 0 ? value / totalValue : 1 / assets.length;
    weightedPortfolioScore += score * normalizedValue;

    steps.push(`${asset.type} (lat: ${asset.location.lat}): hazard=${round(hazardScore, 3)}, vulnerability=${vulnerability}, score=${score}`);
  }

  const portfolioScore = round(Math.min(100, Math.max(1, weightedPortfolioScore)), 1);

  return {
    method: 'physical_risk_score',
    result: {
      portfolio_score: portfolioScore,
      asset_scores: assetScores,
    },
    unit: 'score (1-100)',
    inputs,
    methodology: 'Physical Risk Assessment. Formula: Weighted(Hazard Exposure x Vulnerability x Normalized Asset Value). Hazard exposure estimated by latitude band.',
    uncertainty: 0.25,
    auditTrail: `Physical Risk Score:\n${steps.join('\n')}\nPortfolio score: ${portfolioScore}`,
  };
}

// ============================================================
// 19. Stranded Asset Value
// ============================================================

async function calcStrandedAssetValue(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const assets = requireArray(inputs['fossil_fuel_assets'], 'fossil_fuel_assets') as Array<{
    value: number;
    asset_type: string;
  }>;
  const scenario = requireString(inputs['scenario'], 'scenario');
  const carbon_price_trajectory = (inputs['carbon_price_trajectory'] as number[]) || [];

  // Stranding probabilities by scenario and asset type
  const STRANDING_PROB: Record<string, Record<string, number>> = {
    '1.5c': { 'coal': 0.90, 'oil': 0.65, 'gas': 0.40, 'oil_sands': 0.85, 'arctic_oil': 0.95 },
    '2c':   { 'coal': 0.70, 'oil': 0.40, 'gas': 0.20, 'oil_sands': 0.60, 'arctic_oil': 0.80 },
    'ndc':  { 'coal': 0.40, 'oil': 0.20, 'gas': 0.10, 'oil_sands': 0.30, 'arctic_oil': 0.50 },
  };

  const scenarioProbs = STRANDING_PROB[scenario.toLowerCase()];
  if (!scenarioProbs) {
    throw new AppError(`Unknown scenario: ${scenario}. Use 1.5C, 2C, or ndc.`, 400);
  }

  let totalValue = 0;
  let totalAtRisk = 0;
  const steps: string[] = [];

  for (const asset of assets) {
    const value = requirePositive(asset.value, 'asset value');
    const assetType = requireString(asset.asset_type, 'asset_type').toLowerCase();
    const prob = scenarioProbs[assetType] ?? 0.30;

    const atRisk = value * prob;
    totalValue += value;
    totalAtRisk += atRisk;
    steps.push(`${asset.asset_type}: ${value} x ${prob} (stranding prob) = ${round(atRisk, 2)} at risk`);
  }

  return {
    method: 'stranded_asset_value',
    result: {
      total_asset_value: round(totalValue, 2),
      value_at_risk: round(totalAtRisk, 2),
      risk_percentage: round((totalAtRisk / totalValue) * 100, 2),
      scenario,
    },
    unit: 'currency',
    inputs,
    methodology: 'Transition Risk — Stranded Asset Value. Formula: Asset Value x Stranding Probability (by asset type and scenario). Based on Carbon Tracker methodology.',
    uncertainty: 0.30,
    auditTrail: `Stranded Asset Value (${scenario} scenario):\n${steps.join('\n')}\nTotal value: ${round(totalValue, 2)}\nValue at risk: ${round(totalAtRisk, 2)} (${round((totalAtRisk / totalValue) * 100, 2)}%)`,
  };
}

// ============================================================
// 20. Carbon Price Impact
// ============================================================

async function calcCarbonPriceImpact(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const scope1 = requirePositive(inputs['scope1_emissions'], 'scope1_emissions');
  const scope2 = requirePositive(inputs['scope2_emissions'], 'scope2_emissions');
  const scenario = requireString(inputs['scenario'], 'scenario');
  const projection_years = requirePositive(inputs['projection_years'], 'projection_years');

  // Carbon price trajectories (USD/tCO2e) by scenario
  const PRICE_TRAJECTORIES: Record<string, number[]> = {
    '1.5c': [130, 145, 160, 180, 200, 220, 245, 270, 300, 330],
    '2c':   [80, 90, 100, 110, 120, 135, 150, 165, 180, 200],
    'ndc':  [40, 45, 50, 55, 60, 65, 70, 75, 80, 90],
  };

  const prices = (inputs['carbon_price_trajectory'] as number[]) || PRICE_TRAJECTORIES[scenario.toLowerCase()];
  if (!prices) throw new AppError(`Unknown scenario: ${scenario}`, 400);

  const totalEmissions = scope1 + scope2;
  const yearCount = Math.min(Math.floor(projection_years), prices.length);
  const annual_costs: Array<{ year: number; price: number; cost: number }> = [];
  const steps: string[] = [];

  for (let i = 0; i < yearCount; i++) {
    const price = prices[i]!;
    const cost = totalEmissions * price;
    annual_costs.push({ year: i + 1, price, cost: round(cost, 2) });
    steps.push(`Year ${i + 1}: ${totalEmissions} tCO2e x $${price}/t = $${round(cost, 2)}`);
  }

  return {
    method: 'carbon_price_impact',
    result: {
      total_emissions: round(totalEmissions, 2),
      annual_cost_impact: annual_costs,
      scenario,
    },
    unit: 'USD',
    inputs,
    methodology: 'Carbon Price Impact Analysis. Formula: Total Emissions (Scope 1+2) x Projected Carbon Price per year. Price trajectories based on IEA World Energy Outlook scenarios.',
    uncertainty: 0.35,
    auditTrail: `Carbon Price Impact (${scenario} scenario):\nScope 1: ${scope1} tCO2e, Scope 2: ${scope2} tCO2e\nTotal: ${totalEmissions} tCO2e\n${steps.join('\n')}`,
  };
}

// ============================================================
// 21. SBTi Target Validation
// ============================================================

async function calcSBTiValidation(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const base_year_emissions = requirePositive(inputs['base_year_emissions'], 'base_year_emissions');
  const target_year_emissions = requirePositive(inputs['target_year_emissions'], 'target_year_emissions');
  const target_year = requirePositive(inputs['target_year'], 'target_year');
  const base_year = inputs['base_year'] ? requirePositive(inputs['base_year'], 'base_year') : 2020;
  const scope = requireString(inputs['scope'], 'scope');

  // SBTi minimum pathway rates (% reduction per year from base year)
  // Cross-sector 1.5C pathway: 4.2% per year for Scope 1+2
  // Well-below 2C: 2.5% per year for Scope 1+2
  const SECTOR_PATHWAYS: Record<string, { rate: number; pathway: string }> = {
    'power': { rate: 4.2, pathway: '1.5C' },
    'transport': { rate: 3.5, pathway: 'well-below 2C' },
    'buildings': { rate: 4.0, pathway: '1.5C' },
    'manufacturing': { rate: 3.0, pathway: 'well-below 2C' },
    'services': { rate: 4.2, pathway: '1.5C' },
    'cross-sector': { rate: 4.2, pathway: '1.5C' },
  };

  const sector = (inputs['sector'] as string || 'cross-sector').toLowerCase();
  const pathwayInfo = SECTOR_PATHWAYS[sector] || SECTOR_PATHWAYS['cross-sector']!;

  const years = target_year - base_year;
  if (years <= 0) throw new AppError('target_year must be after base_year', 400);

  // Actual reduction achieved
  const actual_reduction_pct = ((base_year_emissions - target_year_emissions) / base_year_emissions) * 100;
  const actual_annual_rate = actual_reduction_pct / years;

  // Required reduction for the pathway
  const required_total_reduction = pathwayInfo.rate * years;
  const required_target = base_year_emissions * (1 - required_total_reduction / 100);

  const aligned = target_year_emissions <= required_target;
  const gap_pct = aligned ? 0 : round(((target_year_emissions - required_target) / base_year_emissions) * 100, 2);

  return {
    method: 'sbti_validation',
    result: {
      aligned,
      pathway: pathwayInfo.pathway,
      gap_pct,
      actual_annual_reduction_rate: round(actual_annual_rate, 2),
      required_annual_reduction_rate: pathwayInfo.rate,
      required_target_emissions: round(required_target, 2),
    },
    unit: 'boolean + %',
    inputs,
    methodology: `SBTi Target Validation. Compares target reduction against ${pathwayInfo.pathway} pathway (${pathwayInfo.rate}%/yr). Sector: ${sector}.`,
    uncertainty: 0.05,
    auditTrail: `SBTi Validation:\nBase year (${base_year}): ${base_year_emissions} tCO2e\nTarget year (${target_year}): ${target_year_emissions} tCO2e\nActual reduction: ${round(actual_reduction_pct, 2)}% (${round(actual_annual_rate, 2)}%/yr)\nRequired: ${round(required_total_reduction, 2)}% (${pathwayInfo.rate}%/yr)\nRequired target: ${round(required_target, 2)} tCO2e\nAligned: ${aligned}${gap_pct > 0 ? `\nGap: ${gap_pct}% of base year` : ''}`,
  };
}

// ============================================================
// 22. Portfolio Carbon Footprint (SFDR PAI #1)
// ============================================================

async function calcPortfolioCarbonFootprint(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const holdings = requireArray(inputs['holdings'], 'holdings') as Array<{
    investment_value: number;
    enterprise_value: number;
    scope1: number;
    scope2: number;
    name?: string;
  }>;
  const portfolio_value = requirePositive(inputs['portfolio_value'], 'portfolio_value');

  let attributedEmissions = 0;
  const steps: string[] = [];

  for (const h of holdings) {
    const inv = requirePositive(h.investment_value, 'investment_value');
    const ev = requirePositive(h.enterprise_value, 'enterprise_value');
    const s1 = requirePositive(h.scope1, 'scope1');
    const s2 = requirePositive(h.scope2, 'scope2');

    const attributed = (inv / ev) * (s1 + s2);
    attributedEmissions += attributed;
    steps.push(`${h.name || 'holding'}: (${inv}/${ev}) x (${s1}+${s2}) = ${round(attributed, 4)} tCO2e`);
  }

  // Result per million invested
  const footprint = (attributedEmissions / portfolio_value) * 1_000_000;

  return {
    method: 'portfolio_carbon_footprint',
    result: round(footprint, 4),
    unit: 'tCO2e per EUR M invested',
    inputs,
    methodology: 'SFDR PAI #1 — Portfolio Carbon Footprint. Formula: Sum((Investment/Enterprise Value) x Company Scope1+2) / Portfolio Value x 1,000,000.',
    uncertainty: 0.15,
    auditTrail: `Portfolio Carbon Footprint:\n${steps.join('\n')}\nTotal attributed: ${round(attributedEmissions, 4)} tCO2e\nPortfolio value: ${portfolio_value}\nFootprint: ${round(footprint, 4)} tCO2e per EUR M`,
  };
}

// ============================================================
// 23. Portfolio Carbon Intensity (SFDR PAI #2)
// ============================================================

async function calcPortfolioCarbonIntensity(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const holdings = requireArray(inputs['holdings'], 'holdings') as Array<{
    investment_value: number;
    enterprise_value: number;
    emissions: number;
    revenue: number;
    name?: string;
  }>;

  let intensity = 0;
  const steps: string[] = [];

  for (const h of holdings) {
    const inv = requirePositive(h.investment_value, 'investment_value');
    const ev = requirePositive(h.enterprise_value, 'enterprise_value');
    const emissions = requirePositive(h.emissions, 'emissions');
    const revenue = requirePositive(h.revenue, 'revenue');

    const contribution = (inv / ev) * (emissions / revenue);
    intensity += contribution;
    steps.push(`${h.name || 'holding'}: (${inv}/${ev}) x (${emissions}/${revenue}) = ${round(contribution, 6)}`);
  }

  // Per million revenue
  const result = intensity * 1_000_000;

  return {
    method: 'portfolio_carbon_intensity',
    result: round(result, 4),
    unit: 'tCO2e per EUR M revenue',
    inputs,
    methodology: 'SFDR PAI #2 — Portfolio Carbon Intensity. Formula: Sum((Investment/Enterprise Value) x (Emissions/Revenue)) x 1,000,000.',
    uncertainty: 0.15,
    auditTrail: `Portfolio Carbon Intensity:\n${steps.join('\n')}\nWeighted intensity: ${round(result, 4)} tCO2e per EUR M revenue`,
  };
}

// ============================================================
// 24. EU Taxonomy Alignment
// ============================================================

async function calcEUTaxonomyAlignment(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const activities = requireArray(inputs['activities'], 'activities') as Array<{
    nace_code: string;
    revenue: number;
    capex: number;
    opex: number;
    meets_screening: boolean;
    meets_dnsh: boolean;
    meets_safeguards: boolean;
  }>;

  let totalRevenue = 0, totalCapex = 0, totalOpex = 0;
  let alignedRevenue = 0, alignedCapex = 0, alignedOpex = 0;
  const steps: string[] = [];

  for (const act of activities) {
    const rev = requirePositive(act.revenue, 'revenue');
    const capex = requirePositive(act.capex, 'capex');
    const opex = requirePositive(act.opex, 'opex');

    totalRevenue += rev;
    totalCapex += capex;
    totalOpex += opex;

    const isAligned = act.meets_screening && act.meets_dnsh && act.meets_safeguards;
    if (isAligned) {
      alignedRevenue += rev;
      alignedCapex += capex;
      alignedOpex += opex;
    }
    steps.push(`${act.nace_code}: screening=${act.meets_screening}, DNSH=${act.meets_dnsh}, safeguards=${act.meets_safeguards} => ${isAligned ? 'ALIGNED' : 'NOT aligned'}`);
  }

  const revPct = totalRevenue > 0 ? round((alignedRevenue / totalRevenue) * 100, 2) : 0;
  const capexPct = totalCapex > 0 ? round((alignedCapex / totalCapex) * 100, 2) : 0;
  const opexPct = totalOpex > 0 ? round((alignedOpex / totalOpex) * 100, 2) : 0;

  return {
    method: 'eu_taxonomy_alignment',
    result: {
      revenue_aligned_pct: revPct,
      capex_aligned_pct: capexPct,
      opex_aligned_pct: opexPct,
      aligned_activities: activities.filter(a => a.meets_screening && a.meets_dnsh && a.meets_safeguards).length,
      total_activities: activities.length,
    },
    unit: '%',
    inputs,
    methodology: 'EU Taxonomy Regulation. Formula: (Taxonomy-aligned KPI / Total KPI) x 100. Activity must meet: Technical Screening Criteria + DNSH + Minimum Safeguards.',
    uncertainty: 0.05,
    auditTrail: `EU Taxonomy Alignment:\n${steps.join('\n')}\nRevenue: ${alignedRevenue}/${totalRevenue} = ${revPct}%\nCapEx: ${alignedCapex}/${totalCapex} = ${capexPct}%\nOpEx: ${alignedOpex}/${totalOpex} = ${opexPct}%`,
  };
}

// ============================================================
// 25. Green Bond Allocation
// ============================================================

async function calcGreenBondAllocation(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const proceeds_total = requirePositive(inputs['proceeds_total'], 'proceeds_total');
  const allocations = requireArray(inputs['allocations'], 'allocations') as Array<{
    category: string;
    amount: number;
    project_id: string;
  }>;

  let totalAllocated = 0;
  const byCategory: Record<string, number> = {};
  const steps: string[] = [];

  for (const alloc of allocations) {
    const amount = requirePositive(alloc.amount, 'allocation amount');
    totalAllocated += amount;
    const cat = requireString(alloc.category, 'category');
    byCategory[cat] = (byCategory[cat] || 0) + amount;
    steps.push(`${cat} (${alloc.project_id}): ${amount}`);
  }

  if (totalAllocated > proceeds_total) {
    throw new AppError('Total allocations exceed total proceeds', 400);
  }

  const unallocated = proceeds_total - totalAllocated;
  const allocationPct = round((totalAllocated / proceeds_total) * 100, 2);

  return {
    method: 'green_bond_allocation',
    result: {
      allocation_pct: allocationPct,
      unallocated: round(unallocated, 2),
      by_category: byCategory,
      total_allocated: round(totalAllocated, 2),
    },
    unit: '%',
    inputs,
    methodology: 'ICMA Green Bond Principles. Formula: Allocated Proceeds / Total Proceeds x 100.',
    uncertainty: 0.02,
    auditTrail: `Green Bond Allocation:\nTotal proceeds: ${proceeds_total}\n${steps.join('\n')}\nTotal allocated: ${round(totalAllocated, 2)} (${allocationPct}%)\nUnallocated: ${round(unallocated, 2)}`,
  };
}

// ============================================================
// 26. WACI (Weighted Average Carbon Intensity)
// ============================================================

async function calcWACI(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const holdings = requireArray(inputs['holdings'], 'holdings') as Array<{
    weight_pct: number;
    emissions: number;
    revenue: number;
    name?: string;
  }>;

  let waci = 0;
  let totalWeight = 0;
  const steps: string[] = [];

  for (const h of holdings) {
    const weight = requirePositive(h.weight_pct, 'weight_pct');
    const emissions = requirePositive(h.emissions, 'emissions');
    const revenue = requirePositive(h.revenue, 'revenue');

    const intensity = emissions / revenue; // tCO2e per unit revenue
    const contribution = (weight / 100) * intensity * 1_000_000; // per M revenue
    waci += contribution;
    totalWeight += weight;
    steps.push(`${h.name || 'holding'}: ${weight}% x (${emissions}/${revenue} x 1M) = ${round(contribution, 4)}`);
  }

  if (Math.abs(totalWeight - 100) > 0.01) {
    // Normalize if weights don't sum to 100
    // Not an error, but note it
  }

  return {
    method: 'waci',
    result: round(waci, 4),
    unit: 'tCO2e per $M revenue',
    inputs,
    methodology: 'TCFD — Weighted Average Carbon Intensity (WACI). Formula: Sum(Portfolio Weight x Company Carbon Intensity). Carbon intensity = Emissions / Revenue.',
    uncertainty: 0.10,
    auditTrail: `WACI Calculation:\n${steps.join('\n')}\nTotal WACI: ${round(waci, 4)} tCO2e per $M revenue\nTotal weight: ${round(totalWeight, 2)}%`,
  };
}

// ============================================================
// 27. Water Footprint (Blue/Green/Grey)
// ============================================================

async function calcWaterFootprint(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const blue = requirePositive(inputs['blue_m3'], 'blue_m3');
  const green = requirePositive(inputs['green_m3'], 'green_m3');
  const grey = requirePositive(inputs['grey_m3'], 'grey_m3');

  const total = blue + green + grey;
  const bluePct = total > 0 ? round((blue / total) * 100, 2) : 0;
  const greenPct = total > 0 ? round((green / total) * 100, 2) : 0;
  const greyPct = total > 0 ? round((grey / total) * 100, 2) : 0;

  return {
    method: 'water_footprint',
    result: {
      total_m3: round(total, 2),
      blue_m3: round(blue, 2),
      green_m3: round(green, 2),
      grey_m3: round(grey, 2),
      blue_pct: bluePct,
      green_pct: greenPct,
      grey_pct: greyPct,
    },
    unit: 'm3',
    inputs,
    methodology: 'Water Footprint Network — Blue/Green/Grey Water Footprint. Blue: surface/groundwater consumed. Green: rainwater consumed. Grey: volume needed to dilute pollutants.',
    uncertainty: 0.10,
    auditTrail: `Water Footprint:\nBlue: ${blue} m3 (${bluePct}%)\nGreen: ${green} m3 (${greenPct}%)\nGrey: ${grey} m3 (${greyPct}%)\nTotal: ${total} m3`,
  };
}

// ============================================================
// 28. Biodiversity Impact — MSA Loss
// ============================================================

async function calcBiodiversityMSALoss(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const changes = requireArray(inputs['land_use_changes'], 'land_use_changes') as Array<{
    area_ha: number;
    use_type: string;
    previous_use: string;
    duration_years?: number;
  }>;

  // Land use intensity factors (MSA loss per ha) — based on GLOBIO model
  const LAND_USE_MSA: Record<string, number> = {
    'cropland_intensive': 0.70,
    'cropland_light': 0.50,
    'pasture_intensive': 0.55,
    'pasture_light': 0.30,
    'urban': 0.95,
    'industrial': 0.90,
    'forestry_plantation': 0.60,
    'forestry_selective': 0.25,
    'mining': 0.85,
    'infrastructure': 0.80,
  };

  const PREVIOUS_USE_MSA: Record<string, number> = {
    'primary_forest': 0.00,
    'secondary_forest': 0.15,
    'grassland': 0.10,
    'wetland': 0.05,
    'cropland': 0.50,
    'degraded': 0.60,
  };

  let totalMSAha = 0;
  const steps: string[] = [];

  for (const change of changes) {
    const area = requirePositive(change.area_ha, 'area_ha');
    const useType = requireString(change.use_type, 'use_type').toLowerCase();
    const prevUse = requireString(change.previous_use, 'previous_use').toLowerCase();
    const duration = change.duration_years ?? 1;

    const newMSALoss = LAND_USE_MSA[useType] ?? 0.50;
    const prevMSALoss = PREVIOUS_USE_MSA[prevUse] ?? 0.20;

    // Net MSA loss = (new loss - previous loss) * area * duration
    const netLoss = Math.max(0, newMSALoss - prevMSALoss) * area * duration;
    totalMSAha += netLoss;
    steps.push(`${useType} (from ${prevUse}): ${area} ha x (${newMSALoss} - ${prevMSALoss}) x ${duration} yr = ${round(netLoss, 4)} MSA.ha`);
  }

  return {
    method: 'biodiversity_msa_loss',
    result: round(totalMSAha, 4),
    unit: 'MSA.ha',
    inputs,
    methodology: 'GLOBIO Model — Mean Species Abundance (MSA) Loss. Formula: Area x (New Land Use MSA Loss - Previous Use MSA Loss) x Duration.',
    uncertainty: 0.30,
    auditTrail: `Biodiversity MSA Loss:\n${steps.join('\n')}\nTotal: ${round(totalMSAha, 4)} MSA.ha`,
  };
}

// ============================================================
// 29. Circular Economy — Material Circularity Indicator
// ============================================================

async function calcCircularEconomyMCI(inputs: Record<string, unknown>): Promise<CalculationResult> {
  const virgin = requirePositive(inputs['virgin_material_input'], 'virgin_material_input');
  const recycled_input = requirePositive(inputs['recycled_input'], 'recycled_input');
  const waste_landfill = requirePositive(inputs['waste_to_landfill'], 'waste_to_landfill');
  const waste_recycled = requirePositive(inputs['waste_recycled'], 'waste_recycled');
  const product_lifetime = requirePositive(inputs['product_lifetime'], 'product_lifetime');
  const industry_avg_lifetime = requirePositive(inputs['industry_avg_lifetime'], 'industry_avg_lifetime');

  if (product_lifetime === 0 || industry_avg_lifetime === 0) {
    throw new AppError('Lifetimes must be greater than zero', 400);
  }

  const totalInput = virgin + recycled_input;
  if (totalInput === 0) throw new AppError('Total material input must be greater than zero', 400);

  const totalWaste = waste_landfill + waste_recycled;

  // Fraction from recycled/reused sources
  const Fr = recycled_input / totalInput;
  // Fraction going to recycling/reuse
  const Fc = totalWaste > 0 ? waste_recycled / totalWaste : 0;

  // Linear Flow Index (LFI)
  // LFI = (V + W0) / (2M + Wf - Wc)
  // V = virgin input, W0 = waste to landfill, M = total input,
  // Wf = total waste generated, Wc = waste recycled
  const linearFlow = (virgin + waste_landfill) / (2 * totalInput);
  const LFI = Math.min(1, Math.max(0, linearFlow));

  // Utility factor: product_lifetime / industry_avg_lifetime
  const utilityFactor = product_lifetime / industry_avg_lifetime;
  const F_utility = 0.9 / utilityFactor; // Utility scaling

  // MCI = 1 - LFI * F(utility)
  const mci = Math.min(1, Math.max(0, 1 - LFI * F_utility));

  return {
    method: 'circular_economy_mci',
    result: round(mci, 4),
    unit: 'score (0-1)',
    inputs,
    methodology: 'Ellen MacArthur Foundation — Material Circularity Indicator (MCI). Formula: MCI = 1 - (Linear Flow Index x Utility Factor). LFI considers virgin input and waste to landfill vs total material flow.',
    uncertainty: 0.10,
    auditTrail: `Circular Economy MCI:\nTotal input: ${totalInput} (virgin: ${virgin}, recycled: ${recycled_input})\nWaste: ${totalWaste} (landfill: ${waste_landfill}, recycled: ${waste_recycled})\nFr (recycled fraction): ${round(Fr, 4)}\nFc (recovery fraction): ${round(Fc, 4)}\nLFI: ${round(LFI, 4)}\nUtility factor: ${round(utilityFactor, 4)} (lifetime: ${product_lifetime}/${industry_avg_lifetime})\nMCI: ${round(mci, 4)}`,
  };
}

// ============================================================
// Utility
// ============================================================

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
