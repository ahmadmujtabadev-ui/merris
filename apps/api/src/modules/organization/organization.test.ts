import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { registerOrganizationRoutes } from './organization.routes.js';
import { registerAuthRoutes } from '../auth/auth.routes.js';
import { OrgProfileModel, FrameworkRecommendationModel } from './organization.model.js';
import { generateFrameworkRecommendations } from './organization.service.js';
import type { FrameworkRecommendationItem } from './organization.service.js';

let mongoServer: MongoMemoryServer;
let app: ReturnType<typeof Fastify>;

// Helper to register and get auth token
async function registerAndGetToken(overrides: Record<string, string> = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: overrides['email'] || `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      orgName: 'Test Org',
      orgType: 'corporate',
    },
  });
  const body = JSON.parse(res.body);
  return { token: body.token as string, orgId: body.organization.id as string, userId: body.user.id as string };
}

function buildProfile(overrides: Record<string, unknown> = {}) {
  return {
    legalName: 'Test Corp LLC',
    tradingName: 'TestCorp',
    country: 'SA',
    region: 'GCC',
    city: 'Riyadh',
    industryGICS: '10',
    subIndustry: 'petrochemical',
    listingStatus: 'listed',
    exchange: 'Tadawul',
    employeeCount: 5000,
    revenueRange: '100M-500M',
    facilities: [
      { name: 'HQ', type: 'office', country: 'SA' },
    ],
    supplyChainComplexity: 'medium',
    currentFrameworks: [],
    esgMaturity: 'beginner' as const,
    reportingHistory: [],
    ...overrides,
  };
}

function frameworkNames(items: FrameworkRecommendationItem[]) {
  return items.map((r) => r.framework);
}

// ============================================================
// Setup / Teardown
// ============================================================

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env['MONGODB_URI'] = mongoServer.getUri();
  process.env['JWT_SECRET'] = 'test-secret-for-org-tests';

  await mongoose.connect(mongoServer.getUri());

  app = Fastify({ logger: false });
  await registerAuthRoutes(app);
  await registerOrganizationRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await OrgProfileModel.deleteMany({});
  await FrameworkRecommendationModel.deleteMany({});
});

// ============================================================
// Framework Auto-Selection Engine — unit tests
// ============================================================

describe('generateFrameworkRecommendations', () => {
  it('Saudi listed petrochemical → Saudi Exchange + GRI + TCFD + CDP + SASB Oil & Gas', () => {
    const recs = generateFrameworkRecommendations({
      country: 'SA',
      listingStatus: 'listed',
      exchange: 'Tadawul',
      subIndustry: 'petrochemical',
      employeeCount: 5000,
      revenueRange: '100M-500M',
      esgMaturity: 'intermediate',
    });

    const names = frameworkNames(recs);
    expect(names).toContain('Saudi Exchange ESG Disclosure Guidelines');
    expect(names).toContain('GRI Standards 2021');
    expect(names).toContain('TCFD');
    expect(names).toContain('CDP Climate');
    expect(names).toContain('SASB Oil & Gas');

    // Saudi Exchange should be mandatory
    const saudiExchange = recs.find((r) => r.framework === 'Saudi Exchange ESG Disclosure Guidelines');
    expect(saudiExchange?.category).toBe('mandatory');
  });

  it('UAE listed real estate (ADX) → ADX + GRI + TCFD + GRESB + SASB Real Estate', () => {
    const recs = generateFrameworkRecommendations({
      country: 'AE',
      listingStatus: 'listed',
      exchange: 'ADX',
      subIndustry: 'real_estate',
      employeeCount: 2000,
      revenueRange: '50M-100M',
      esgMaturity: 'intermediate',
    });

    const names = frameworkNames(recs);
    expect(names).toContain('ADX ESG Reporting Guide');
    expect(names).toContain('GRI Standards 2021');
    expect(names).toContain('TCFD');
    expect(names).toContain('GRESB');
    expect(names).toContain('SASB Real Estate');

    const adx = recs.find((r) => r.framework === 'ADX ESG Reporting Guide');
    expect(adx?.category).toBe('mandatory');
  });

  it('Qatar petrochemical (QSE, QAPCO scenario) → QSE + GRI + TCFD + CDP', () => {
    const recs = generateFrameworkRecommendations({
      country: 'QA',
      listingStatus: 'listed',
      exchange: 'QSE',
      subIndustry: 'petrochemical',
      employeeCount: 3000,
      revenueRange: '500M+',
      esgMaturity: 'intermediate',
    });

    const names = frameworkNames(recs);
    expect(names).toContain('QSE ESG Guidance');
    expect(names).toContain('GRI Standards 2021');
    expect(names).toContain('TCFD');
    expect(names).toContain('CDP Climate');

    const qse = recs.find((r) => r.framework === 'QSE ESG Guidance');
    expect(qse?.category).toBe('mandatory');
  });

  it('EU large company → CSRD/ESRS mandatory + GRI', () => {
    const recs = generateFrameworkRecommendations({
      country: 'DE',
      listingStatus: 'private',
      subIndustry: 'manufacturing',
      employeeCount: 1000,
      revenueRange: '100M-500M',
      esgMaturity: 'advanced',
    });

    const names = frameworkNames(recs);
    expect(names).toContain('CSRD/ESRS');
    expect(names).toContain('GRI Standards 2021');
    expect(names).toContain('EU Taxonomy');

    const csrd = recs.find((r) => r.framework === 'CSRD/ESRS');
    expect(csrd?.category).toBe('mandatory');
  });

  it('SME with no prior reporting → GRI (starter) as recommended', () => {
    const recs = generateFrameworkRecommendations({
      country: 'SA',
      listingStatus: 'sme',
      subIndustry: 'retail',
      employeeCount: 50,
      revenueRange: '<10M',
      esgMaturity: 'none',
    });

    const names = frameworkNames(recs);
    expect(names).toContain('GRI Standards 2021');

    const gri = recs.find((r) => r.framework === 'GRI Standards 2021');
    expect(gri?.category).toBe('recommended');
    expect(gri?.reason).toMatch(/starting|baseline|guidance/i);
  });

  it('GRI is always recommended for all organisations', () => {
    const recs = generateFrameworkRecommendations({
      country: 'JP',
      listingStatus: 'private',
      subIndustry: 'technology',
      employeeCount: 100,
      revenueRange: '10M-50M',
      esgMaturity: 'intermediate',
    });

    const names = frameworkNames(recs);
    expect(names).toContain('GRI Standards 2021');
  });

  it('Financial services → TCFD + SFDR', () => {
    const recs = generateFrameworkRecommendations({
      country: 'AE',
      listingStatus: 'listed',
      exchange: 'ADX',
      subIndustry: 'financial_services',
      employeeCount: 800,
      revenueRange: '100M-500M',
      esgMaturity: 'intermediate',
    });

    const names = frameworkNames(recs);
    expect(names).toContain('TCFD');
    expect(names).toContain('SFDR');
  });

  it('EU operations flag triggers CSRD even for non-EU domicile', () => {
    const recs = generateFrameworkRecommendations({
      country: 'SA',
      listingStatus: 'listed',
      exchange: 'Tadawul',
      subIndustry: 'manufacturing',
      employeeCount: 500,
      revenueRange: '100M-500M',
      esgMaturity: 'intermediate',
      hasEuOperations: true,
    });

    const names = frameworkNames(recs);
    expect(names).toContain('CSRD/ESRS');
    expect(names).toContain('EU Taxonomy');
  });

  it('does not produce duplicate frameworks', () => {
    const recs = generateFrameworkRecommendations({
      country: 'SA',
      listingStatus: 'listed',
      exchange: 'Tadawul',
      subIndustry: 'petrochemical',
      employeeCount: 5000,
      revenueRange: '500M+',
      esgMaturity: 'beginner',
    });

    const frameworkSet = new Set(frameworkNames(recs));
    expect(frameworkSet.size).toBe(recs.length);
  });
});

// ============================================================
// API Integration Tests
// ============================================================

describe('Organization Profile API', () => {
  describe('POST /api/v1/organizations/:id/profile', () => {
    it('creates a profile and returns recommendations', async () => {
      const { token, orgId } = await registerAndGetToken();
      const profile = buildProfile();

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${token}` },
        payload: profile,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.profile.legalName).toBe('Test Corp LLC');
      expect(body.recommendations.length).toBeGreaterThan(0);
    });

    it('updates an existing profile on second POST', async () => {
      const { token, orgId } = await registerAndGetToken();

      // Create
      await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${token}` },
        payload: buildProfile(),
      });

      // Update
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${token}` },
        payload: buildProfile({ legalName: 'Updated Corp' }),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.profile.legalName).toBe('Updated Corp');

      // Only one profile in DB
      const count = await OrgProfileModel.countDocuments({ orgId });
      expect(count).toBe(1);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/someorgid/profile',
        payload: buildProfile(),
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 403 when accessing another org', async () => {
      const { token } = await registerAndGetToken({ email: 'user1@example.com' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/differentorgid/profile',
        headers: { authorization: `Bearer ${token}` },
        payload: buildProfile(),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/organizations/:id/profile', () => {
    it('returns the profile with recommendations', async () => {
      const { token, orgId } = await registerAndGetToken();

      // Create profile first
      await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${token}` },
        payload: buildProfile(),
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.profile).toBeDefined();
      expect(body.recommendations).toBeDefined();
      expect(body.selections).toBeDefined();
    });

    it('returns 404 when profile does not exist', async () => {
      const { token, orgId } = await registerAndGetToken();

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/someorgid/profile',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/organizations/:id/framework-recommendations', () => {
    it('returns categorised recommendations', async () => {
      const { token, orgId } = await registerAndGetToken();

      // Create profile first
      await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${token}` },
        payload: buildProfile(),
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/framework-recommendations`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.mandatory).toBeDefined();
      expect(body.recommended).toBeDefined();
      expect(body.optional).toBeDefined();

      // Saudi listed petrochem should have mandatory frameworks
      expect(body.mandatory.length).toBeGreaterThan(0);
      expect(body.recommended.length).toBeGreaterThan(0);
    });

    it('returns 404 when no recommendations exist', async () => {
      const { token, orgId } = await registerAndGetToken();

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/framework-recommendations`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/organizations/:id/framework-selections', () => {
    it('saves user framework selections', async () => {
      const { token, orgId } = await registerAndGetToken();

      // Create profile to generate recommendations
      await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${token}` },
        payload: buildProfile(),
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/framework-selections`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          selected: ['GRI Standards 2021', 'TCFD', 'Custom Framework X'],
          deselected: ['SASB Oil & Gas'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.selected).toContain('GRI Standards 2021');
      expect(body.selected).toContain('Custom Framework X');
      expect(body.deselected).toContain('SASB Oil & Gas');
      expect(body.confirmedAt).toBeDefined();
    });

    it('allows user to override recommendations (select additional, deselect optional)', async () => {
      const { token, orgId } = await registerAndGetToken();

      // Create profile
      await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${token}` },
        payload: buildProfile(),
      });

      // User selects an extra framework not in recommendations, deselects one
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/framework-selections`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          selected: ['GRI Standards 2021', 'TCFD', 'ISSB S1', 'ISSB S2'],
          deselected: ['CDP Climate', 'GHG Protocol'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.selected).toContain('ISSB S1');
      expect(body.selected).toContain('ISSB S2');
      expect(body.deselected).toContain('CDP Climate');
    });

    it('returns 404 when no recommendations exist', async () => {
      const { token, orgId } = await registerAndGetToken();

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/framework-selections`,
        headers: { authorization: `Bearer ${token}` },
        payload: { selected: ['GRI'], deselected: [] },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/someorgid/framework-selections',
        payload: { selected: ['GRI'], deselected: [] },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
