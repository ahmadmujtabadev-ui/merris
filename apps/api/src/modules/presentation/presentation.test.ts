import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { registerPresentationRoutes } from './presentation.routes.js';
import { PresentationModel } from './presentation.model.js';
import { DataPointModel } from '../ingestion/ingestion.model.js';

// ============================================================
// Test Setup
// ============================================================

const JWT_SECRET = 'test-secret-key-for-presentation-tests';
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
      role: 'manager',
      permissions: [
        { resource: 'presentations', actions: ['read', 'write', 'delete', 'approve'] },
      ],
      ...overrides,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = Fastify();
  await registerPresentationRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await PresentationModel.deleteMany({});
  await DataPointModel.deleteMany({});
});

// ============================================================
// Helper: Seed data points for an engagement
// ============================================================

async function seedDataPoints() {
  const engObjId = new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID);
  const metrics = [
    { metricName: 'ghg_scope1', value: 12500, unit: 'tCO2e', frameworkRef: 'GRI-305-1' },
    { metricName: 'ghg_scope2', value: 8200, unit: 'tCO2e', frameworkRef: 'GRI-305-2' },
    { metricName: 'ghg_scope3', value: 45000, unit: 'tCO2e', frameworkRef: 'GRI-305-3' },
    { metricName: 'energy_total', value: 150000, unit: 'MWh', frameworkRef: 'GRI-302-1' },
    { metricName: 'water_consumption', value: 25000, unit: 'm3', frameworkRef: 'GRI-303-5' },
    { metricName: 'safety_trir', value: 1.2, unit: 'rate', frameworkRef: 'GRI-403-9' },
    { metricName: 'safety_ltifr', value: 0.4, unit: 'rate', frameworkRef: 'GRI-403-9' },
  ];

  for (const m of metrics) {
    await DataPointModel.create({
      engagementId: engObjId,
      ...m,
      period: { year: 2025 },
      confidence: 'high',
      status: 'user_confirmed',
      extractionMethod: 'manual',
      auditTrail: [{ action: 'created', timestamp: new Date() }],
    });
  }
}

// ============================================================
// Authentication Tests
// ============================================================

describe('Presentation Routes - Authentication', () => {
  it('should return 401 for unauthenticated generate request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations/generate`,
      payload: { type: 'board_pack' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 401 for unauthenticated list request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 401 for unauthenticated detail request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/presentations/${new mongoose.Types.ObjectId().toString()}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 401 for unauthenticated download request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/presentations/${new mongoose.Types.ObjectId().toString()}/download`,
    });
    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// Generation Tests
// ============================================================

describe('Presentation Routes - Generate', () => {
  it('should generate a board pack with 12 slides', async () => {
    const token = createToken();
    await seedDataPoints();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations/generate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'board_pack' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.type).toBe('board_pack');
    expect(body.slides).toHaveLength(12);
    expect(body.status).toBe('draft');
    expect(body.generatedAt).toBeDefined();
    expect(body.title).toContain('Board ESG Pack');
  });

  it('should generate an investor presentation with 10 slides', async () => {
    const token = createToken();
    await seedDataPoints();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations/generate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'investor_presentation' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.type).toBe('investor_presentation');
    expect(body.slides).toHaveLength(10);
    expect(body.title).toContain('Investor Presentation');
  });

  it('should generate a client deliverable with 20 slides', async () => {
    const token = createToken();
    await seedDataPoints();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations/generate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'client_deliverable' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.type).toBe('client_deliverable');
    expect(body.slides).toHaveLength(20);
  });

  it('should show "Data pending" placeholder when data is missing', async () => {
    const token = createToken();
    // Do NOT seed data points

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations/generate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'board_pack' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);

    // The KPI dashboard slide (index 2) should have "Data pending" text
    const kpiSlide = body.slides.find((s: { id: string }) => s.id === 'bp-03-kpi-dashboard');
    expect(kpiSlide).toBeDefined();
    expect(kpiSlide.content.text).toContain('Data pending');
  });

  it('should apply custom branding', async () => {
    const token = createToken();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations/generate`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: 'board_pack',
        branding: {
          primaryColor: '#1a5276',
          fontFamily: 'Helvetica',
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.branding.primaryColor).toBe('#1a5276');
    expect(body.branding.fontFamily).toBe('Helvetica');
  });

  it('should return 400 for unknown deck type', async () => {
    const token = createToken();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations/generate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'nonexistent_type' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ============================================================
// List Tests
// ============================================================

describe('Presentation Routes - List', () => {
  it('should list presentations for an engagement', async () => {
    const token = createToken();

    // Generate two presentations
    await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations/generate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'board_pack' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations/generate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'investor_presentation' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(2);
  });

  it('should return empty array for engagement with no presentations', async () => {
    const token = createToken();
    const otherEngId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${otherEngId}/presentations`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(0);
  });
});

// ============================================================
// Detail Tests
// ============================================================

describe('Presentation Routes - Detail', () => {
  it('should get a single presentation', async () => {
    const token = createToken();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations/generate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'investor_presentation' },
    });

    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/presentations/${created._id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.type).toBe('investor_presentation');
    expect(body.slides).toHaveLength(10);
  });

  it('should return 404 for non-existent presentation', async () => {
    const token = createToken();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/presentations/${new mongoose.Types.ObjectId().toString()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ============================================================
// Download Tests
// ============================================================

describe('Presentation Routes - Download', () => {
  it('should download a PPTX file', async () => {
    const token = createToken();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/presentations/generate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'board_pack' },
    });

    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/presentations/${created._id}/download`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    expect(res.headers['content-disposition']).toContain('.pptx');
    // Buffer should be non-empty (PPTX files start with PK zip signature)
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });

  it('should return 404 for downloading non-existent presentation', async () => {
    const token = createToken();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/presentations/${new mongoose.Types.ObjectId().toString()}/download`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
