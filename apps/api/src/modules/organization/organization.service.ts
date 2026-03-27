import type { OrgProfile } from '@merris/shared';
import { OrgProfileModel, FrameworkRecommendationModel } from './organization.model.js';
import type { IOrgProfile, IFrameworkRecommendation } from './organization.model.js';
import { AppError } from '../auth/auth.service.js';

// ============================================================
// Constants
// ============================================================

const GCC_COUNTRY_CODES = ['SA', 'AE', 'QA', 'BH', 'KW', 'OM'];

const EU_COUNTRY_CODES = [
  'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'FI', 'IE',
  'GR', 'LU', 'SE', 'DK', 'PL', 'CZ', 'RO', 'BG', 'HR', 'SK',
  'SI', 'LT', 'LV', 'EE', 'HU', 'MT', 'CY',
];

// Sub-industries that map to oil & gas / petrochemical
const OIL_GAS_INDUSTRIES = [
  'oil_gas', 'petrochemical', 'oil_and_gas', 'petroleum',
  'energy_oil_gas', 'integrated_oil_gas', 'exploration_production',
  'refining_marketing', 'oil_gas_equipment_services',
];

const FINANCIAL_SERVICES_INDUSTRIES = [
  'financial_services', 'banking', 'insurance', 'asset_management',
  'diversified_financials', 'capital_markets',
];

const REAL_ESTATE_CONSTRUCTION_INDUSTRIES = [
  'real_estate', 'construction', 'real_estate_management',
  'real_estate_development', 'reits',
];

// CSRD size thresholds
const CSRD_EMPLOYEE_THRESHOLD = 250;
const LARGE_COMPANY_EMPLOYEE_THRESHOLD = 500;

// ============================================================
// Framework Recommendation
// ============================================================

export interface FrameworkRecommendationItem {
  framework: string;
  category: 'mandatory' | 'recommended' | 'optional';
  reason: string;
  regulation?: string;
}

/**
 * Core framework auto-selection engine. Applies all regulatory and
 * best-practice rules to determine which ESG frameworks apply to a
 * given organization profile.
 */
export function generateFrameworkRecommendations(profile: {
  country: string;
  listingStatus: string;
  exchange?: string;
  subIndustry: string;
  employeeCount: number;
  revenueRange: string;
  esgMaturity: string;
  hasEuOperations?: boolean;
  facilities?: Array<{ country: string }>;
}): FrameworkRecommendationItem[] {
  const recommendations: FrameworkRecommendationItem[] = [];
  const added = new Set<string>();

  function add(item: FrameworkRecommendationItem) {
    // Avoid duplicates; upgrade category if re-added as mandatory
    const existing = recommendations.find((r) => r.framework === item.framework);
    if (existing) {
      if (item.category === 'mandatory' && existing.category !== 'mandatory') {
        existing.category = 'mandatory';
        existing.reason = item.reason;
        existing.regulation = item.regulation;
      }
      return;
    }
    added.add(item.framework);
    recommendations.push(item);
  }

  const country = profile.country.toUpperCase();
  const exchange = profile.exchange?.toUpperCase() ?? '';
  const subIndustry = profile.subIndustry.toLowerCase().replace(/\s+/g, '_');
  const isListed = profile.listingStatus === 'listed';
  const isGCC = GCC_COUNTRY_CODES.includes(country);
  const isEU = EU_COUNTRY_CODES.includes(country);
  const hasEuOps = profile.hasEuOperations === true;
  const isOilGas = OIL_GAS_INDUSTRIES.some((ind) => subIndustry.includes(ind));
  const isFinancial = FINANCIAL_SERVICES_INDUSTRIES.some((ind) => subIndustry.includes(ind));
  const isRealEstate = REAL_ESTATE_CONSTRUCTION_INDUSTRIES.some((ind) => subIndustry.includes(ind));

  // -------------------------------------------------------
  // Rule 1: Saudi Tadawul listed
  // -------------------------------------------------------
  if (isListed && exchange === 'TADAWUL') {
    add({
      framework: 'Saudi Exchange ESG Disclosure Guidelines',
      category: 'mandatory',
      reason: 'Mandatory for all Tadawul-listed companies (29 KPIs)',
      regulation: 'Saudi Exchange ESG Disclosure Guidelines',
    });
    add({
      framework: 'GRI Standards 2021',
      category: 'recommended',
      reason: 'Internationally recognised baseline, complements Saudi Exchange requirements',
    });
    add({
      framework: 'TCFD',
      category: 'recommended',
      reason: 'Climate disclosure best practice for listed companies',
    });
  }

  // -------------------------------------------------------
  // Rule 2: UAE listed (ADX or DFM)
  // -------------------------------------------------------
  if (isListed && (exchange === 'ADX' || exchange === 'DFM')) {
    add({
      framework: 'ADX ESG Reporting Guide',
      category: 'mandatory',
      reason: `Mandatory for all ${exchange}-listed companies`,
      regulation: 'ADX ESG Reporting Guide',
    });
    add({
      framework: 'GRI Standards 2021',
      category: 'recommended',
      reason: 'Internationally recognised baseline, complements ADX requirements',
    });
    add({
      framework: 'TCFD',
      category: 'recommended',
      reason: 'Climate disclosure best practice for listed companies',
    });
  }

  // -------------------------------------------------------
  // Rule 3: Qatar listed (QSE)
  // -------------------------------------------------------
  if (isListed && exchange === 'QSE') {
    add({
      framework: 'QSE ESG Guidance',
      category: 'mandatory',
      reason: 'Mandatory for all QSE-listed companies',
      regulation: 'QSE ESG Guidance',
    });
    add({
      framework: 'GRI Standards 2021',
      category: 'recommended',
      reason: 'Internationally recognised baseline, complements QSE requirements',
    });
  }

  // -------------------------------------------------------
  // Rule 4: GCC oil & gas / petrochemical
  // -------------------------------------------------------
  if (isGCC && isOilGas) {
    add({
      framework: 'TCFD',
      category: 'recommended',
      reason: 'Critical for oil & gas sector climate risk disclosure in GCC',
    });
    add({
      framework: 'CDP Climate',
      category: 'recommended',
      reason: 'Industry standard for carbon disclosure in the energy sector',
    });
    add({
      framework: 'GHG Protocol',
      category: 'recommended',
      reason: 'Foundational methodology for greenhouse gas accounting',
    });
    add({
      framework: 'SASB Oil & Gas',
      category: 'recommended',
      reason: 'Sector-specific sustainability metrics for oil & gas companies',
    });
  }

  // -------------------------------------------------------
  // Rule 5: EU nexus (domiciled or operations)
  // -------------------------------------------------------
  if (isEU || hasEuOps) {
    if (profile.employeeCount >= CSRD_EMPLOYEE_THRESHOLD) {
      add({
        framework: 'CSRD/ESRS',
        category: 'mandatory',
        reason: 'Mandatory under CSRD for companies meeting size thresholds in the EU',
        regulation: 'EU Corporate Sustainability Reporting Directive',
      });
    } else {
      add({
        framework: 'CSRD/ESRS',
        category: 'recommended',
        reason: 'Upcoming EU requirement; early adoption recommended',
      });
    }
    add({
      framework: 'EU Taxonomy',
      category: 'recommended',
      reason: 'Alignment with EU sustainable finance classification system',
    });
  }

  // -------------------------------------------------------
  // Rule 6: Large company (>500 employees)
  // -------------------------------------------------------
  if (profile.employeeCount > LARGE_COMPANY_EMPLOYEE_THRESHOLD) {
    add({
      framework: 'GRI Standards 2021',
      category: 'recommended',
      reason: 'Comprehensive reporting standard recommended for large organisations',
    });
  }

  // -------------------------------------------------------
  // Rule 7: Beginner / no maturity
  // -------------------------------------------------------
  if (profile.esgMaturity === 'none' || profile.esgMaturity === 'beginner') {
    add({
      framework: 'GRI Standards 2021',
      category: 'recommended',
      reason: 'Best starting framework with most guidance and templates available',
    });
  }

  // -------------------------------------------------------
  // Rule 8: Financial services
  // -------------------------------------------------------
  if (isFinancial) {
    add({
      framework: 'TCFD',
      category: 'recommended',
      reason: 'Essential climate-risk framework for financial institutions (now ISSB)',
    });
    add({
      framework: 'SFDR',
      category: 'recommended',
      reason: 'Sustainable Finance Disclosure Regulation for financial products',
    });
  }

  // -------------------------------------------------------
  // Rule 9: Real estate / construction
  // -------------------------------------------------------
  if (isRealEstate) {
    add({
      framework: 'GRESB',
      category: 'recommended',
      reason: 'Leading ESG benchmark for real estate and infrastructure',
    });
    add({
      framework: 'SASB Real Estate',
      category: 'recommended',
      reason: 'Sector-specific sustainability metrics for real estate',
    });
  }

  // -------------------------------------------------------
  // Rule 10: Universal baseline — GRI always recommended
  // -------------------------------------------------------
  add({
    framework: 'GRI Standards 2021',
    category: 'recommended',
    reason: 'Universal baseline for all organisations',
  });

  return recommendations;
}

// ============================================================
// Service Functions
// ============================================================

export interface ProfileInput {
  legalName: string;
  tradingName: string;
  country: string;
  region: string;
  city: string;
  industryGICS: string;
  subIndustry: string;
  listingStatus: 'listed' | 'private' | 'state_owned' | 'sme';
  exchange?: string;
  employeeCount: number;
  revenueRange: string;
  facilities: Array<{
    name: string;
    type: string;
    country: string;
    coordinates?: { lat: number; lng: number };
    scope1Sources?: string[];
  }>;
  supplyChainComplexity: string;
  currentFrameworks: string[];
  esgMaturity: 'none' | 'beginner' | 'intermediate' | 'advanced';
  reportingHistory: Array<{
    year: number;
    frameworks: string[];
    url?: string;
  }>;
  hasEuOperations?: boolean;
}

export async function createOrUpdateProfile(orgId: string, input: ProfileInput) {
  const recommendations = generateFrameworkRecommendations({
    country: input.country,
    listingStatus: input.listingStatus,
    exchange: input.exchange,
    subIndustry: input.subIndustry,
    employeeCount: input.employeeCount,
    revenueRange: input.revenueRange,
    esgMaturity: input.esgMaturity,
    hasEuOperations: input.hasEuOperations,
    facilities: input.facilities,
  });

  const profile = await OrgProfileModel.findOneAndUpdate(
    { orgId },
    {
      ...input,
      orgId,
    },
    { upsert: true, new: true, runValidators: true }
  );

  // Save recommendations
  await FrameworkRecommendationModel.findOneAndUpdate(
    { orgId },
    {
      orgId,
      recommendations,
      // Preserve existing selections on profile update
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { profile, recommendations };
}

export async function getProfile(orgId: string) {
  const profile = await OrgProfileModel.findOne({ orgId });
  if (!profile) {
    throw new AppError('Organization profile not found', 404);
  }

  const frameworkRec = await FrameworkRecommendationModel.findOne({ orgId });

  return {
    profile,
    recommendations: frameworkRec?.recommendations ?? [],
    selections: frameworkRec?.selections ?? { selected: [], deselected: [] },
  };
}

export async function getFrameworkRecommendations(orgId: string) {
  const frameworkRec = await FrameworkRecommendationModel.findOne({ orgId });
  if (!frameworkRec) {
    throw new AppError('No framework recommendations found. Create an organization profile first.', 404);
  }

  const mandatory = frameworkRec.recommendations.filter((r) => r.category === 'mandatory');
  const recommended = frameworkRec.recommendations.filter((r) => r.category === 'recommended');
  const optional = frameworkRec.recommendations.filter((r) => r.category === 'optional');

  return { mandatory, recommended, optional };
}

export async function saveFrameworkSelections(
  orgId: string,
  selections: { selected: string[]; deselected: string[] }
) {
  const frameworkRec = await FrameworkRecommendationModel.findOne({ orgId });
  if (!frameworkRec) {
    throw new AppError('No framework recommendations found. Create an organization profile first.', 404);
  }

  frameworkRec.selections = {
    selected: selections.selected,
    deselected: selections.deselected,
    confirmedAt: new Date(),
  };

  await frameworkRec.save();

  return {
    selected: frameworkRec.selections.selected,
    deselected: frameworkRec.selections.deselected,
    confirmedAt: frameworkRec.selections.confirmedAt,
  };
}
