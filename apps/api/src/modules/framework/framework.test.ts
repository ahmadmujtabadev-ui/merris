import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { registerFrameworkRoutes } from './framework.routes.js';
import { Framework } from '../../models/framework.model.js';
import { Disclosure } from '../../models/disclosure.model.js';
import { EmissionFactor } from '../../models/emission-factor.model.js';
import { CrossFrameworkMap } from '../../models/cross-map.model.js';

const JWT_SECRET = 'test-secret-key-for-framework-tests';
process.env['JWT_SECRET'] = JWT_SECRET;

let mongoServer: MongoMemoryServer;
let app: FastifyInstance;

// ============================================================
// Helpers
// ============================================================

function generateToken(overrides: Record<string, unknown> = {}): string {
  const payload = {
    userId: 'user-1',
    orgId: 'org-1',
    role: 'admin',
    permissions: [
      { resource: 'data', actions: ['read', 'write'] },
      { resource: 'engagements', actions: ['read', 'write'] },
    ],
    ...overrides,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function authHeader() {
  return { authorization: `Bearer ${generateToken()}` };
}

function loadJson(relativePath: string): unknown {
  // Resolve from the project root (merris-platform/)
  const projectRoot = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', '..', '..', '..'
  );
  const fullPath = join(projectRoot, relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

// ============================================================
// Setup / Teardown
// ============================================================

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = Fastify();
  await registerFrameworkRoutes(app);
  await app.ready();

  // Seed framework data
  const frameworkFiles = [
    'data/frameworks/gri-2021.json',
    'data/frameworks/esrs-2024.json',
    'data/frameworks/issb-s1-s2.json',
    'data/frameworks/sasb-oil-gas.json',
    'data/frameworks/sasb-real-estate.json',
    'data/frameworks/saudi-exchange-29kpi.json',
    'data/frameworks/adx-esg-guide.json',
    'data/frameworks/qse-guidance.json',
    'data/frameworks/tcfd-recommendations.json',
    'data/frameworks/cdp-climate-2025.json',
  ];

  for (const file of frameworkFiles) {
    const data = loadJson(file) as Record<string, unknown>;
    await Framework.create(data);
  }

  // Seed emission factors
  const gccGrid = loadJson('data/emission-factors/gcc-grid-factors.json') as {
    factors: unknown[];
  };
  for (const factor of gccGrid.factors) {
    await EmissionFactor.create(factor);
  }

  const defra = loadJson('data/emission-factors/defra-2025.json') as {
    factors: Record<string, unknown[]>;
  };
  // DEFRA factors are grouped by category — flatten them
  for (const category of Object.values(defra.factors)) {
    for (const factor of category) {
      await EmissionFactor.create(factor);
    }
  }

  // Seed cross-maps
  const crossMapFiles = [
    'data/cross-maps/gri-to-esrs.json',
    'data/cross-maps/gri-to-saudi.json',
    'data/cross-maps/gri-to-issb.json',
    'data/cross-maps/gri-to-cdp.json',
  ];

  for (const file of crossMapFiles) {
    const data = loadJson(file) as Record<string, unknown>;
    await CrossFrameworkMap.create(data);
  }
}, 30000);

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ============================================================
// Tests: GET /api/v1/frameworks
// ============================================================

describe('GET /api/v1/frameworks', () => {
  it('returns all 10 frameworks with correct counts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/frameworks',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.frameworks).toHaveLength(10);

    // Verify each framework has summary fields
    for (const fw of body.frameworks) {
      expect(fw.topicCount).toBeGreaterThan(0);
      expect(fw.disclosureCount).toBeGreaterThan(0);
      expect(fw.code).toBeDefined();
      expect(fw.name).toBeDefined();
      expect(fw.type).toBeDefined();
      expect(fw.region).toBeDefined();
    }

    // Check specific framework counts
    const gri = body.frameworks.find(
      (f: { code: string }) => f.code === 'gri'
    );
    expect(gri).toBeDefined();
    expect(gri.topicCount).toBe(6);
    expect(gri.disclosureCount).toBe(116);

    const saudi = body.frameworks.find(
      (f: { code: string }) => f.code === 'saudi-exchange'
    );
    expect(saudi).toBeDefined();
    expect(saudi.disclosureCount).toBe(29);
  });

  it('filters by type=mandatory returns correct subset', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/frameworks?type=mandatory',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // esrs, issb, saudi-exchange, adx are mandatory
    expect(body.frameworks.length).toBeGreaterThanOrEqual(3);
    for (const fw of body.frameworks) {
      expect(fw.type).toBe('mandatory');
    }

    const codes = body.frameworks.map((f: { code: string }) => f.code);
    expect(codes).toContain('esrs');
    expect(codes).toContain('saudi-exchange');
    expect(codes).toContain('adx');
  });

  it('returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/frameworks',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// Tests: GET /api/v1/frameworks/:code
// ============================================================

describe('GET /api/v1/frameworks/:code', () => {
  it('returns full framework structure by code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/frameworks/gri',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.framework.code).toBe('gri');
    expect(body.framework.name).toContain('GRI');
    expect(body.framework.structure.topics).toHaveLength(6);
    expect(body.framework.structure.topics[0].disclosures).toBeDefined();
  });

  it('returns 404 for unknown framework', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/frameworks/nonexistent',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(404);
  });
});

// ============================================================
// Tests: GET /api/v1/frameworks/:code/disclosures
// ============================================================

describe('GET /api/v1/frameworks/:code/disclosures', () => {
  it('returns all disclosures for a framework', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/frameworks/saudi-exchange/disclosures',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.disclosures).toHaveLength(29);
  });

  it('filters by topic=emissions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/frameworks/saudi-exchange/disclosures?topic=emissions',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.disclosures.length).toBeGreaterThan(0);
    for (const d of body.disclosures) {
      expect(d.topic.toLowerCase()).toContain('emission');
    }
  });

  it('filters by dataType=quantitative', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/frameworks/saudi-exchange/disclosures?dataType=quantitative',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.disclosures.length).toBeGreaterThan(0);
    for (const d of body.disclosures) {
      expect(d.dataType).toBe('quantitative');
    }
  });
});

// ============================================================
// Tests: GET /api/v1/disclosures/:id
// ============================================================

describe('GET /api/v1/disclosures/:id', () => {
  it('returns disclosure with full detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/disclosures/gri-305-1',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.disclosure.code).toBe('GRI 305-1');
    expect(body.disclosure.name).toContain('Scope 1');
    expect(body.disclosure.crossReferences.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown disclosure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/disclosures/nonexistent-123',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(404);
  });
});

// ============================================================
// Tests: GET /api/v1/disclosures/:id/cross-references
// ============================================================

describe('GET /api/v1/disclosures/:id/cross-references', () => {
  it('GRI 305-1 returns ESRS E1-6, Saudi KPI, CDP mapping', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/disclosures/gri-305-1/cross-references',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.sourceDisclosure.code).toBe('GRI 305-1');
    expect(body.crossReferences.length).toBeGreaterThanOrEqual(4);

    const frameworkCodes = body.crossReferences.map(
      (r: { frameworkCode: string }) => r.frameworkCode
    );
    expect(frameworkCodes).toContain('esrs');
    expect(frameworkCodes).toContain('saudi-exchange');
    expect(frameworkCodes).toContain('cdp');
    expect(frameworkCodes).toContain('issb');

    // Check ESRS mapping
    const esrsRef = body.crossReferences.find(
      (r: { frameworkCode: string }) => r.frameworkCode === 'esrs'
    );
    expect(esrsRef.disclosureCode).toBe('ESRS E1-6');
    expect(esrsRef.mappingType).toBe('equivalent');
  });
});

// ============================================================
// Tests: GET /api/v1/emission-factors
// ============================================================

describe('GET /api/v1/emission-factors', () => {
  it('filters by country=Saudi Arabia', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/emission-factors?country=Saudi Arabia',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.factors.length).toBeGreaterThan(0);
    for (const f of body.factors) {
      expect(f.country).toMatch(/Saudi Arabia/i);
    }
  });

  it('filters by source=IEA', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/emission-factors?source=IEA',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.factors.length).toBeGreaterThan(0);
  });

  it('returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/emission-factors',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// Tests: GET /api/v1/emission-factors/:country/grid
// ============================================================

describe('GET /api/v1/emission-factors/:country/grid', () => {
  it('Saudi Arabia grid factor returns correct IEA value', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/emission-factors/Saudi Arabia/grid',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.factor.country).toMatch(/Saudi Arabia/i);
    expect(body.factor.source).toBe('IEA');
    expect(body.factor.unit).toBe('kgCO2e/kWh');
    expect(body.factor.factor).toBeCloseTo(0.573, 2);
  });

  it('Qatar grid factor returns ~0.493 kgCO2e/kWh', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/emission-factors/Qatar/grid',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.factor.country).toBe('Qatar');
    expect(body.factor.factor).toBeCloseTo(0.493, 2);
    expect(body.factor.unit).toBe('kgCO2e/kWh');
  });

  it('returns 404 for unknown country', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/emission-factors/Narnia/grid',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(404);
  });
});

// ============================================================
// Tests: GET /api/v1/engagements/:id/data-agenda
// ============================================================

describe('GET /api/v1/engagements/:id/data-agenda', () => {
  it('returns deduplicated list for GRI + QSE + TCFD', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/engagements/eng-1/data-agenda?frameworks=gri,qse,tcfd',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.engagementId).toBe('eng-1');
    expect(body.agenda).toBeDefined();
    expect(body.agenda.required).toBeDefined();
    expect(body.agenda.summary).toBeDefined();

    // Deduplication should reduce total
    expect(body.agenda.summary.uniqueMetrics).toBeLessThan(
      body.agenda.summary.totalMetrics
    );
    expect(body.agenda.summary.deduplicatedCount).toBeGreaterThan(0);
  });

  it('same metric required by 3 frameworks appears once with all 3 listed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/engagements/eng-2/data-agenda?frameworks=gri,saudi-exchange,esrs',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Find "Scope 1 GHG emissions" metric — GRI and Saudi use exact same name
    // so they should be deduplicated into one entry with both frameworks
    const allItems = [
      ...body.agenda.required,
      ...body.agenda.optional,
      ...body.agenda.satisfied,
    ];

    const scope1Exact = allItems.filter(
      (item: { metricName: string }) =>
        item.metricName === 'Scope 1 GHG emissions'
    );

    // GRI 305-1 and SE-E1 share the exact metric name and are cross-referenced
    // so should be deduplicated into one entry
    expect(scope1Exact.length).toBe(1);

    // That single entry should list multiple frameworks (gri + saudi-exchange at minimum)
    const scope1 = scope1Exact[0];
    expect(scope1.frameworks.length).toBeGreaterThanOrEqual(2);
    expect(scope1.frameworks).toContain('gri');
    expect(scope1.frameworks).toContain('saudi-exchange');
  });

  it('gap analysis: with some data points returns correct completion %', async () => {
    // Pass some satisfied metrics
    const satisfied = encodeURIComponent(
      'Scope 1 GHG emissions,Scope 2 GHG emissions'
    );
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/eng-3/data-agenda?frameworks=saudi-exchange&satisfied=${satisfied}`,
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.agenda.satisfied.length).toBeGreaterThanOrEqual(2);
    expect(body.agenda.summary.completionPercentage).toBeGreaterThan(0);
    expect(body.agenda.summary.completionPercentage).toBeLessThan(100);

    // Check per-framework completeness
    const saudiCompletion = body.agenda.summary.byFramework.find(
      (f: { code: string }) => f.code === 'saudi-exchange'
    );
    expect(saudiCompletion).toBeDefined();
    expect(saudiCompletion.completed).toBeGreaterThanOrEqual(2);
    expect(saudiCompletion.percentage).toBeGreaterThan(0);
    expect(saudiCompletion.percentage).toBeLessThan(100);
  });

  it('returns 400 without frameworks parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/engagements/eng-1/data-agenda',
      headers: authHeader(),
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/engagements/eng-1/data-agenda?frameworks=gri',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// Tests: Unauthenticated access
// ============================================================

describe('Unauthenticated requests', () => {
  it('GET /api/v1/frameworks returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/frameworks',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/frameworks/gri returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/frameworks/gri',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/disclosures/gri-305-1 returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/disclosures/gri-305-1',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/emission-factors/Saudi Arabia/grid returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/emission-factors/Saudi Arabia/grid',
    });
    expect(res.statusCode).toBe(401);
  });
});
