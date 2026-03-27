import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { registerQARoutes } from './qa.routes.js';
import { DataPointModel } from '../ingestion/ingestion.model.js';
import { ReportModel } from '../report/report.model.js';
import { clearQAHistory } from './qa.service.js';

// ============================================================
// Test Setup
// ============================================================

const JWT_SECRET = 'test-secret-key-for-qa-tests';
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
        { resource: 'qa', actions: ['read', 'write', 'delete', 'approve'] },
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
  await registerQARoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await DataPointModel.deleteMany({});
  await ReportModel.deleteMany({});
  clearQAHistory();
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
    status: 'user_confirmed',
    extractionMethod: 'manual',
    sourceDocumentId: new mongoose.Types.ObjectId(),
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
// Tests: QA Run — Detecting Issues
// ============================================================

describe('POST /api/v1/engagements/:id/qa/run', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/run`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('detects conflicting values for same metric and period', async () => {
    // Plant two data points for the same metric/period with different values
    await createTestDataPoint({ value: 1500 });
    await createTestDataPoint({ value: 2000 });

    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/run`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.issues.length).toBeGreaterThan(0);
    const conflictIssue = body.issues.find(
      (i: { type: string }) => i.type === 'CONFLICTING_VALUES',
    );
    expect(conflictIssue).toBeDefined();
    expect(conflictIssue.severity).toBe('error');
    expect(conflictIssue.description).toContain('conflicting values');
  });

  it('detects unit mismatches for same metric', async () => {
    await createTestDataPoint({ unit: 'tonnes', period: { year: 2024 } });
    await createTestDataPoint({ unit: 'tons', period: { year: 2023 } });

    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/run`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    const unitIssue = [...body.issues, ...body.warnings].find(
      (i: { type: string }) => i.type === 'UNIT_MISMATCH',
    );
    expect(unitIssue).toBeDefined();
    expect(unitIssue.description).toContain('inconsistent units');
  });

  it('detects implausible YoY changes (>200%)', async () => {
    await createTestDataPoint({ value: 100, period: { year: 2023 } });
    await createTestDataPoint({ value: 500, period: { year: 2024 } });

    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/run`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    const yoyIssue = [...body.issues, ...body.warnings].find(
      (i: { type: string }) => i.type === 'IMPLAUSIBLE_YOY',
    );
    expect(yoyIssue).toBeDefined();
    expect(yoyIssue.description).toContain('400%');
  });

  it('detects data points without source document reference', async () => {
    await createTestDataPoint({
      sourceDocumentId: undefined,
      documentId: undefined,
    });

    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/run`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    const sourceIssue = [...body.issues, ...body.warnings].find(
      (i: { type: string }) => i.type === 'MISSING_SOURCE',
    );
    expect(sourceIssue).toBeDefined();
    expect(sourceIssue.description).toContain('no source document');
  });

  it('detects rounding inconsistencies for same metric', async () => {
    await createTestDataPoint({ value: 12.3 });
    await createTestDataPoint({ value: 12 });

    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/run`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    const roundingIssue = [...body.issues, ...body.warnings].find(
      (i: { type: string }) => i.type === 'ROUNDING_INCONSISTENCY',
    );
    expect(roundingIssue).toBeDefined();
    expect(roundingIssue.description).toContain('decimal precisions');
  });
});

// ============================================================
// Tests: QA Run — Clean Data (no issues)
// ============================================================

describe('POST /api/v1/engagements/:id/qa/run — clean data', () => {
  it('returns no issues for consistent data', async () => {
    await createTestDataPoint({ value: 1500, period: { year: 2024 } });

    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/run`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.issues).toHaveLength(0);
    expect(body.passed.length).toBeGreaterThan(0);
    expect(body.summary.errors).toBe(0);
  });

  it('returns empty results for engagement with no data', async () => {
    const token = createToken();
    const emptyEngId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${emptyEngId}/qa/run`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.issues).toHaveLength(0);
    expect(body.summary.errors).toBe(0);
  });
});

// ============================================================
// Tests: QA History
// ============================================================

describe('GET /api/v1/engagements/:id/qa/history', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/history`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns empty history for new engagement', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/history`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.history).toHaveLength(0);
  });

  it('stores and retrieves QA run history', async () => {
    await createTestDataPoint();

    const token = createToken();

    // Run QA twice
    await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/run`,
      headers: { authorization: `Bearer ${token}` },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/run`,
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/qa/history`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.history).toHaveLength(2);
    expect(body.history[0].engagementId).toBe(TEST_ENGAGEMENT_ID);
  });
});
