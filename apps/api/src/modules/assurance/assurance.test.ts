import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { registerAssuranceRoutes } from './assurance.routes.js';
import { DataPointModel } from '../ingestion/ingestion.model.js';
import { ESGDocumentModel } from '../ingestion/ingestion.model.js';

// ============================================================
// Test Setup
// ============================================================

const JWT_SECRET = 'test-secret-key-for-assurance-tests';
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
        { resource: 'assurance', actions: ['read', 'write', 'delete', 'approve'] },
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
  await registerAssuranceRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await DataPointModel.deleteMany({});
  await ESGDocumentModel.deleteMany({});
});

// ============================================================
// Helpers
// ============================================================

async function createTestDocument(overrides: Record<string, unknown> = {}) {
  return ESGDocumentModel.create({
    engagementId: new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID),
    orgId: new mongoose.Types.ObjectId(TEST_ORG_ID),
    filename: 'annual-report-2024.pdf',
    format: 'pdf',
    size: 2048000,
    hash: 'abc123def456',
    uploadSource: 'manual',
    status: 'ingested',
    extractedData: [],
    uploadedAt: new Date(),
    ...overrides,
  });
}

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
    extractionMethod: 'llm_extract',
    auditTrail: [
      {
        action: 'created',
        userId: TEST_USER_ID,
        timestamp: new Date('2024-06-01'),
        newValue: 1500,
        notes: 'Source: Annual Report 2024',
      },
      {
        action: 'confirmed',
        userId: TEST_USER_ID,
        timestamp: new Date('2024-06-02'),
        previousValue: { status: 'auto_extracted' },
        newValue: { status: 'user_confirmed' },
      },
    ],
    ...overrides,
  });
}

// ============================================================
// Tests: Generate Assurance Pack
// ============================================================

describe('POST /api/v1/engagements/:id/assurance/generate', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/assurance/generate`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('generates evidence pack with source document tracing', async () => {
    const doc = await createTestDocument();
    await createTestDataPoint({
      sourceDocumentId: doc._id,
      sourcePage: 42,
      sourceCell: 'B7',
    });

    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/assurance/generate`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.engagementId).toBe(TEST_ENGAGEMENT_ID);
    expect(body.disclosures).toHaveLength(1);

    const disc = body.disclosures[0];
    expect(disc.disclosureCode).toBe('gri-305-1');
    expect(disc.evidenceItems).toHaveLength(1);

    const evidence = disc.evidenceItems[0];
    expect(evidence.metricName).toBe('GHG Emissions Scope 1');
    expect(evidence.value).toBe(1500);

    // Source document traced
    expect(evidence.sourceDocument).toBeDefined();
    expect(evidence.sourceDocument.filename).toBe('annual-report-2024.pdf');
    expect(evidence.sourceDocument.pageRef).toBe(42);
    expect(evidence.sourceDocument.cellRef).toBe('B7');
  });

  it('includes full audit trail in evidence', async () => {
    await createTestDataPoint();

    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/assurance/generate`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    const evidence = body.disclosures[0].evidenceItems[0];
    expect(evidence.auditTrail).toHaveLength(2);
    expect(evidence.auditTrail[0].action).toBe('created');
    expect(evidence.auditTrail[1].action).toBe('confirmed');
    expect(evidence.confirmedBy).toBe(TEST_USER_ID);
    expect(evidence.confirmedAt).toBeDefined();
  });

  it('includes calculation methodology for estimated values', async () => {
    await createTestDataPoint({
      status: 'estimated',
      extractionMethod: 'calculation',
      auditTrail: [
        {
          action: 'created',
          userId: TEST_USER_ID,
          timestamp: new Date(),
          newValue: 0,
        },
        {
          action: 'estimated',
          userId: TEST_USER_ID,
          timestamp: new Date(),
          previousValue: { value: 0 },
          newValue: { value: 1500 },
          notes: 'Method: industry_average. Based on GCC sector average',
        },
      ],
    });

    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/assurance/generate`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    const evidence = body.disclosures[0].evidenceItems[0];
    expect(evidence.calculationMethodology).toContain('industry_average');
  });

  it('handles empty engagement gracefully', async () => {
    const token = createToken();
    const emptyEngId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${emptyEngId}/assurance/generate`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.disclosures).toHaveLength(0);
    expect(body.summary.totalDisclosures).toBe(0);
    expect(body.summary.totalDataPoints).toBe(0);
  });

  it('computes summary statistics correctly', async () => {
    const doc = await createTestDocument();

    // Data point with source
    await createTestDataPoint({
      sourceDocumentId: doc._id,
    });

    // Data point without source
    await createTestDataPoint({
      frameworkRef: 'gri-303-3',
      metricName: 'Water Consumption',
      unit: 'm3',
      value: 50000,
      sourceDocumentId: undefined,
      documentId: undefined,
    });

    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/assurance/generate`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.summary.totalDataPoints).toBe(2);
    expect(body.summary.withSourceDoc).toBe(1);
    expect(body.summary.withAuditTrail).toBe(2);
    expect(body.summary.totalDisclosures).toBe(2);
  });
});

// ============================================================
// Tests: Single Disclosure Evidence
// ============================================================

describe('GET /api/v1/engagements/:id/assurance/evidence/:disclosureId', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/assurance/evidence/gri-305-1`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns evidence for specific disclosure', async () => {
    const doc = await createTestDocument();
    await createTestDataPoint({
      sourceDocumentId: doc._id,
      sourcePage: 15,
    });

    const token = createToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/assurance/evidence/gri-305-1`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.disclosureCode).toBe('gri-305-1');
    expect(body.evidenceItems).toHaveLength(1);
    expect(body.evidenceItems[0].sourceDocument.pageRef).toBe(15);
    expect(body.completeness).toBeDefined();
    expect(body.completeness.provided).toBeGreaterThan(0);
  });

  it('returns 404 for disclosure with no data', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/assurance/evidence/gri-999-99`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
