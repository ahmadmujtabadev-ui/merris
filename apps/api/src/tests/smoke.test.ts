/**
 * API Smoke Tests
 *
 * Quick verification that every major endpoint responds correctly.
 * Tests health, auth, and 401 enforcement on all authenticated routes.
 *
 * Uses mongodb-memory-server for isolation.
 * Claude API and Azure Blob are mocked.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// ============================================================
// Mock external dependencies
// ============================================================

vi.mock('../lib/claude.js', () => ({
  getClient: vi.fn(() => ({
    messages: { create: vi.fn() },
  })),
  sendMessage: vi.fn().mockResolvedValue('Mock response'),
}));

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: vi.fn(() => ({
      getContainerClient: vi.fn(() => ({
        getBlockBlobClient: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({}),
          url: 'https://mock.test/blob',
        })),
        createIfNotExists: vi.fn().mockResolvedValue({}),
      })),
    })),
  },
}));

// Route imports
import { registerAuthRoutes } from '../modules/auth/auth.routes.js';
import { registerOrganizationRoutes } from '../modules/organization/organization.routes.js';
import { registerFrameworkRoutes } from '../modules/framework/framework.routes.js';
import { registerDataCollectionRoutes } from '../modules/data-collection/data-collection.routes.js';
import { registerCalculationRoutes } from '../modules/calculation/calculation.routes.js';
import { registerAgentRoutes } from '../modules/agent/agent.routes.js';
import { registerReportRoutes } from '../modules/report/report.routes.js';
import { registerQARoutes } from '../modules/qa/qa.routes.js';
import { registerAssuranceRoutes } from '../modules/assurance/assurance.routes.js';
import { registerPresentationRoutes } from '../modules/presentation/presentation.routes.js';
import { registerWorkflowRoutes } from '../modules/workflow/workflow.routes.js';

// Seed data
import { Framework } from '../models/framework.model.js';
import { EmissionFactor } from '../models/emission-factor.model.js';

// ============================================================
// Environment
// ============================================================

const JWT_SECRET = 'smoke-test-secret-key';
process.env['JWT_SECRET'] = JWT_SECRET;
process.env['ANTHROPIC_API_KEY'] = 'mock-key';

let mongoServer: MongoMemoryServer;
let app: FastifyInstance;

// ============================================================
// Setup / Teardown
// ============================================================

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = Fastify();

  // Health check
  app.get('/api/v1/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  await registerAuthRoutes(app);
  await registerOrganizationRoutes(app);
  await registerFrameworkRoutes(app);
  await registerDataCollectionRoutes(app);
  await registerCalculationRoutes(app);
  await registerAgentRoutes(app);
  await registerReportRoutes(app);
  await registerQARoutes(app);
  await registerAssuranceRoutes(app);
  await registerPresentationRoutes(app);
  await registerWorkflowRoutes(app);

  await app.ready();

  // Seed minimal framework and emission factor data
  await Framework.create({
    id: 'gri-2021-smoke',
    code: 'GRI',
    name: 'Global Reporting Initiative',
    version: '2021',
    type: 'voluntary',
    region: 'global',
    issuingBody: 'GRI Foundation',
    effectiveDate: new Date('2023-01-01'),
    structure: {
      topics: [
        {
          code: 'GRI-300',
          name: 'Emissions',
          disclosures: [
            {
              id: 'gri-305-1-smoke',
              frameworkId: 'gri-2021-smoke',
              code: '305-1',
              name: 'Direct GHG',
              description: 'Direct Scope 1 GHG emissions',
              topic: 'Emissions',
              requiredMetrics: [
                { name: 'scope1', unit: 'tCO2e', description: 'Scope 1 GHG emissions' },
              ],
              dataType: 'quantitative',
              guidanceText: 'Report direct GHG emissions in tCO2e.',
            },
          ],
        },
      ],
    },
  });

  await EmissionFactor.create({
    country: 'QA',
    gridRegion: 'Qatar',
    source: 'IEA',
    year: 2023,
    factor: 0.493,
    unit: 'tCO2e/MWh',
    scope: 2,
    category: 'grid-electricity',
  });
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ============================================================
// Helpers
// ============================================================

async function registerAndLogin() {
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: `smoke-${Date.now()}@test.com`,
      password: 'TestPass123!',
      name: 'Smoke Tester',
      orgName: 'Smoke Org',
      orgType: 'consulting',
    },
  });
  const body = JSON.parse(regRes.body);
  return {
    token: body.token as string,
    orgId: body.organization.id as string,
    userId: body.user.id as string,
  };
}

// ============================================================
// Tests
// ============================================================

describe('Smoke: Health Check', () => {
  it('GET /api/v1/health returns 200 with status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});

describe('Smoke: Auth Endpoints', () => {
  it('POST /api/v1/auth/register returns 201 with token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'smoke-reg@test.com',
        password: 'StrongPass123!',
        name: 'Smoke Register',
        orgName: 'Smoke Register Org',
        orgType: 'corporate',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.user).toBeDefined();
    expect(body.organization).toBeDefined();
  });

  it('POST /api/v1/auth/login returns 200 with token', async () => {
    // Register first
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'smoke-login@test.com',
        password: 'LoginPass123!',
        name: 'Login User',
        orgName: 'Login Org',
        orgType: 'consulting',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'smoke-login@test.com',
        password: 'LoginPass123!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.user.email).toBe('smoke-login@test.com');
  });
});

describe('Smoke: Authenticated Endpoints Return 401 Without Token', () => {
  const engId = new mongoose.Types.ObjectId().toString();
  const reportId = new mongoose.Types.ObjectId().toString();
  const sectionId = new mongoose.Types.ObjectId().toString();

  const protectedEndpoints = [
    { method: 'GET' as const, url: '/api/v1/auth/me' },
    { method: 'POST' as const, url: '/api/v1/auth/refresh' },
    { method: 'GET' as const, url: '/api/v1/users' },
    { method: 'GET' as const, url: `/api/v1/organizations/${engId}/profile` },
    { method: 'POST' as const, url: `/api/v1/organizations/${engId}/profile` },
    { method: 'GET' as const, url: `/api/v1/engagements/${engId}/data-points` },
    { method: 'POST' as const, url: `/api/v1/engagements/${engId}/data-points` },
    { method: 'GET' as const, url: `/api/v1/engagements/${engId}/gap-register` },
    { method: 'GET' as const, url: `/api/v1/engagements/${engId}/completeness` },
    { method: 'POST' as const, url: '/api/v1/calculate' },
    { method: 'GET' as const, url: '/api/v1/frameworks' },
    { method: 'GET' as const, url: '/api/v1/emission-factors' },
    { method: 'GET' as const, url: '/api/v1/emission-factors/QA/grid' },
    { method: 'POST' as const, url: '/api/v1/agent/chat' },
    { method: 'POST' as const, url: `/api/v1/engagements/${engId}/reports` },
    { method: 'GET' as const, url: `/api/v1/reports/${reportId}` },
    { method: 'PUT' as const, url: `/api/v1/reports/${reportId}/sections/${sectionId}` },
    { method: 'POST' as const, url: `/api/v1/engagements/${engId}/qa/run` },
    { method: 'POST' as const, url: `/api/v1/engagements/${engId}/assurance/generate` },
    { method: 'POST' as const, url: `/api/v1/engagements/${engId}/presentations/generate` },
    { method: 'POST' as const, url: `/api/v1/engagements/${engId}/workflow/initialize` },
    { method: 'GET' as const, url: `/api/v1/engagements/${engId}/workflow` },
    { method: 'PUT' as const, url: `/api/v1/engagements/${engId}/workflow/advance` },
  ];

  for (const endpoint of protectedEndpoints) {
    it(`${endpoint.method} ${endpoint.url} returns 401 without token`, async () => {
      const res = await app.inject({
        method: endpoint.method,
        url: endpoint.url,
      });
      expect(res.statusCode).toBe(401);
    });
  }
});

describe('Smoke: Framework Data Accessible', () => {
  it('GET /api/v1/frameworks returns seeded frameworks', async () => {
    const { token } = await registerAndLogin();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/frameworks',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.frameworks).toBeDefined();
    expect(body.frameworks.length).toBeGreaterThanOrEqual(1);

    const gri = body.frameworks.find((f: { code: string }) => f.code === 'GRI');
    expect(gri).toBeDefined();
    expect(gri.name).toBe('Global Reporting Initiative');
  });

  it('GET /api/v1/emission-factors returns data for Qatar', async () => {
    const { token } = await registerAndLogin();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/emission-factors?country=QA',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.factors).toBeDefined();
    expect(body.factors.length).toBeGreaterThanOrEqual(1);
    expect(body.factors[0].country).toBe('QA');
  });

  it('GET /api/v1/emission-factors/QA/grid returns Qatar grid factor', async () => {
    const { token } = await registerAndLogin();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/emission-factors/QA/grid',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.factor).toBeDefined();
  });
});
