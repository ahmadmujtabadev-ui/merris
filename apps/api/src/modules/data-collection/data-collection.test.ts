import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { registerDataCollectionRoutes } from './data-collection.routes.js';
import { DataPointModel } from '../ingestion/ingestion.model.js';

// ============================================================
// Test Setup
// ============================================================

const JWT_SECRET = 'test-secret-key-for-data-collection-tests';
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
    { expiresIn: '1h' }
  );
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = Fastify();
  await registerDataCollectionRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await DataPointModel.deleteMany({});
});

// ============================================================
// Helpers
// ============================================================

async function createTestDataPoint(overrides: Record<string, unknown> = {}) {
  return DataPointModel.create({
    engagementId: new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID),
    frameworkRef: 'gri-305-1',
    metricName: 'GHG Emissions Scope 1',
    value: 1500,
    unit: 'tCO2e',
    period: { year: 2024 },
    confidence: 'high',
    status: 'auto_extracted',
    extractionMethod: 'llm_extract',
    auditTrail: [
      {
        action: 'created',
        userId: TEST_USER_ID,
        timestamp: new Date(),
        newValue: 1500,
      },
    ],
    ...overrides,
  });
}

// ============================================================
// Tests: POST /api/v1/engagements/:id/data-points (Create)
// ============================================================

describe('POST /api/v1/engagements/:id/data-points', () => {
  it('creates a data point manually with audit trail', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/data-points`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        frameworkRef: 'gri-305-1',
        metricName: 'GHG Emissions Scope 1',
        value: 2000,
        unit: 'tCO2e',
        period: { year: 2024 },
        source: 'Annual Report 2024',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.dataPoint).toBeDefined();
    expect(body.dataPoint.extractionMethod).toBe('manual');
    expect(body.dataPoint.status).toBe('user_confirmed');
    expect(body.dataPoint.auditTrail).toHaveLength(1);
    expect(body.dataPoint.auditTrail[0].action).toBe('created');
    expect(body.dataPoint.auditTrail[0].userId).toBe(TEST_USER_ID);
    expect(body.dataPoint.auditTrail[0].notes).toContain('Annual Report 2024');
  });

  it('rejects negative GHG emissions value', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/data-points`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        frameworkRef: 'gri-305-1',
        metricName: 'GHG Emissions Scope 1',
        value: -500,
        unit: 'tCO2e',
        period: { year: 2024 },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('negative');
  });

  it('rejects invalid percentage values', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/data-points`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        frameworkRef: 'gri-405-1',
        metricName: 'Board Gender Diversity',
        value: 150,
        unit: '%',
        period: { year: 2024 },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('Percentage');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/data-points`,
      payload: {
        frameworkRef: 'gri-305-1',
        metricName: 'GHG Emissions',
        value: 1000,
        unit: 'tCO2e',
        period: { year: 2024 },
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// Tests: PUT /api/v1/data-points/:id (Update)
// ============================================================

describe('PUT /api/v1/data-points/:id', () => {
  it('updates data point and preserves previous value in audit trail', async () => {
    const dp = await createTestDataPoint();
    const token = createToken();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/data-points/${dp._id.toString()}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { value: 1800 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.dataPoint.value).toBe(1800);
    expect(body.dataPoint.auditTrail).toHaveLength(2);

    const updateEntry = body.dataPoint.auditTrail[1];
    expect(updateEntry.action).toBe('updated');
    expect(updateEntry.previousValue.value).toBe(1500);
    expect(updateEntry.newValue.value).toBe(1800);
  });

  it('warns on 80% YoY change', async () => {
    // Create previous year data point
    await createTestDataPoint({
      period: { year: 2023 },
      value: 1000,
      status: 'user_confirmed',
    });

    // Create current year data point
    const dp = await createTestDataPoint({
      period: { year: 2024 },
      value: 1000,
    });

    const token = createToken();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/data-points/${dp._id.toString()}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { value: 1800 }, // 80% increase
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // The warning should be recorded in audit trail notes
    const updateEntry = body.dataPoint.auditTrail[body.dataPoint.auditTrail.length - 1];
    expect(updateEntry.notes).toContain('50%');
  });

  it('returns 404 for non-existent data point', async () => {
    const token = createToken();
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/data-points/${fakeId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { value: 999 },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ============================================================
// Tests: POST /api/v1/data-points/:id/confirm
// ============================================================

describe('POST /api/v1/data-points/:id/confirm', () => {
  it('confirms auto-extracted data and changes status to user_confirmed', async () => {
    const dp = await createTestDataPoint({ status: 'auto_extracted' });
    const token = createToken();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/data-points/${dp._id.toString()}/confirm`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.dataPoint.status).toBe('user_confirmed');

    const confirmEntry = body.dataPoint.auditTrail[body.dataPoint.auditTrail.length - 1];
    expect(confirmEntry.action).toBe('confirmed');
    expect(confirmEntry.previousValue.status).toBe('auto_extracted');
    expect(confirmEntry.newValue.status).toBe('user_confirmed');
  });
});

// ============================================================
// Tests: POST /api/v1/data-points/:id/estimate
// ============================================================

describe('POST /api/v1/data-points/:id/estimate', () => {
  it('estimates data point with method recorded', async () => {
    const dp = await createTestDataPoint({ status: 'missing', value: 0 });
    const token = createToken();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/data-points/${dp._id.toString()}/estimate`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        estimatedValue: 1200,
        estimationMethod: 'industry_average',
        notes: 'Based on GCC sector average',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.dataPoint.status).toBe('estimated');
    expect(body.dataPoint.value).toBe(1200);

    const estimateEntry = body.dataPoint.auditTrail[body.dataPoint.auditTrail.length - 1];
    expect(estimateEntry.action).toBe('estimated');
    expect(estimateEntry.notes).toContain('industry_average');
    expect(estimateEntry.notes).toContain('GCC sector average');
  });
});

// ============================================================
// Tests: GET /api/v1/engagements/:id/data-points (List + Filter)
// ============================================================

describe('GET /api/v1/engagements/:id/data-points', () => {
  it('returns all data points for engagement', async () => {
    await createTestDataPoint();
    await createTestDataPoint({ metricName: 'Water Consumption', frameworkRef: 'gri-303-3', unit: 'm3' });

    const token = createToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/data-points`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.dataPoints).toHaveLength(2);
  });

  it('filters by status', async () => {
    await createTestDataPoint({ status: 'missing' });
    await createTestDataPoint({ status: 'user_confirmed', metricName: 'Water' });

    const token = createToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/data-points?status=missing`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.dataPoints).toHaveLength(1);
    expect(body.dataPoints[0].status).toBe('missing');
  });

  it('filters by framework', async () => {
    await createTestDataPoint({ frameworkRef: 'gri-305-1' });
    await createTestDataPoint({ frameworkRef: 'esrs-E1-1', metricName: 'ESRS Emissions' });

    const token = createToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/data-points?framework=gri`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.dataPoints).toHaveLength(1);
    expect(body.dataPoints[0].frameworkRef).toContain('gri');
  });

  it('filters by confidence', async () => {
    await createTestDataPoint({ confidence: 'high' });
    await createTestDataPoint({ confidence: 'low', metricName: 'Low Conf Metric' });

    const token = createToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/data-points?confidence=low`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.dataPoints).toHaveLength(1);
    expect(body.dataPoints[0].confidence).toBe('low');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/data-points`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// Tests: GET /api/v1/engagements/:id/gap-register
// ============================================================

describe('GET /api/v1/engagements/:id/gap-register', () => {
  it('returns all missing/incomplete items grouped by framework', async () => {
    await createTestDataPoint({ status: 'missing', frameworkRef: 'gri-305-1', metricName: 'Scope 1' });
    await createTestDataPoint({ status: 'missing', frameworkRef: 'gri-303-3', metricName: 'Water' });
    await createTestDataPoint({ status: 'auto_extracted', frameworkRef: 'esrs-E1-1', metricName: 'ESRS Climate' });
    await createTestDataPoint({ status: 'user_confirmed', frameworkRef: 'gri-401-1', metricName: 'Employment' });

    const token = createToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/gap-register`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    // 3 items: 2 missing + 1 auto_extracted (user_confirmed excluded)
    expect(body.total).toBe(3);
    expect(body.byFramework).toBeDefined();
    expect(body.byFramework['gri']).toHaveLength(2);
    expect(body.byFramework['esrs']).toHaveLength(1);
  });
});

// ============================================================
// Tests: POST /api/v1/engagements/:id/gap-register/assign
// ============================================================

describe('POST /api/v1/engagements/:id/gap-register/assign', () => {
  it('assigns gaps to responsible parties and records in audit trail', async () => {
    const dp1 = await createTestDataPoint({ status: 'missing', metricName: 'Gap 1' });
    const dp2 = await createTestDataPoint({ status: 'missing', metricName: 'Gap 2' });

    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/gap-register/assign`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        dataPointIds: [dp1._id.toString(), dp2._id.toString()],
        assignee: {
          name: 'Sarah Ahmad',
          email: 'sarah@company.com',
          department: 'Sustainability',
        },
        deadline: '2026-04-30T00:00:00.000Z',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.assigned).toBe(2);
    expect(body.assignee.name).toBe('Sarah Ahmad');

    // Verify audit trail was updated
    const updated = await DataPointModel.findById(dp1._id);
    const assignEntry = updated!.auditTrail[updated!.auditTrail.length - 1];
    expect(assignEntry!.action).toBe('assigned');
    expect(assignEntry!.notes).toContain('Sarah Ahmad');
    expect(assignEntry!.notes).toContain('sarah@company.com');
  });
});

// ============================================================
// Tests: GET /api/v1/engagements/:id/completeness
// ============================================================

describe('GET /api/v1/engagements/:id/completeness', () => {
  it('returns accurate completeness calculation', async () => {
    // Create a mix of statuses
    await createTestDataPoint({ status: 'user_confirmed', frameworkRef: 'gri-305-1', metricName: 'Scope 1', confidence: 'high' });
    await createTestDataPoint({ status: 'user_confirmed', frameworkRef: 'gri-305-2', metricName: 'Scope 2', confidence: 'high' });
    await createTestDataPoint({ status: 'estimated', frameworkRef: 'gri-305-3', metricName: 'Scope 3', confidence: 'medium' });
    await createTestDataPoint({ status: 'missing', frameworkRef: 'gri-303-3', metricName: 'Water', confidence: 'low' });
    await createTestDataPoint({ status: 'auto_extracted', frameworkRef: 'esrs-E1-1', metricName: 'ESRS Climate', confidence: 'medium' });

    const token = createToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/completeness`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    // 3 completed (user_confirmed x2 + estimated), 5 total
    expect(body.overall.total).toBe(5);
    expect(body.overall.completed).toBe(3);
    expect(body.overall.percentage).toBe(60);

    // By framework
    expect(body.byFramework).toBeDefined();
    expect(Array.isArray(body.byFramework)).toBe(true);

    // By confidence
    expect(body.byConfidence.high).toBe(2);
    expect(body.byConfidence.medium).toBe(2);
    expect(body.byConfidence.low).toBe(1);

    // Trend exists
    expect(body.trend).toBeDefined();
    expect(Array.isArray(body.trend)).toBe(true);
  });
});
