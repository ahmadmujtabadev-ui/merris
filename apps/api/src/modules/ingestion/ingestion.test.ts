import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { registerIngestionRoutes } from './ingestion.routes.js';
import { ESGDocumentModel, DataPointModel } from './ingestion.model.js';
import { normalizeUnit, mapToFramework, assignConfidence } from './ingestion.normalizer.js';

// ============================================================
// Test Setup
// ============================================================

const JWT_SECRET = 'test-secret-key-for-ingestion-tests';
process.env['JWT_SECRET'] = JWT_SECRET;

let mongoServer: MongoMemoryServer;
let app: FastifyInstance;

const TEST_ORG_ID = new mongoose.Types.ObjectId().toString();

function createToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      userId: new mongoose.Types.ObjectId().toString(),
      orgId: TEST_ORG_ID,
      role: 'owner',
      permissions: [
        { resource: 'data', actions: ['read', 'write', 'delete', 'approve'] },
        { resource: 'evidence', actions: ['read', 'write', 'delete', 'approve'] },
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
  await registerIngestionRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await ESGDocumentModel.deleteMany({});
  await DataPointModel.deleteMany({});
});

// ============================================================
// Helpers
// ============================================================

function createTestCSV(): Buffer {
  const csv = [
    'Metric,Value,Unit,Year',
    'GHG Emissions Scope 1,1500,tCO2e,2024',
    'Water Consumption,50000,m³,2024',
    'Energy Consumption,12000,MWh,2024',
    'Employee Count,250,employees,2024',
  ].join('\n');
  return Buffer.from(csv);
}

// ============================================================
// Tests: POST /api/v1/engagements/:id/documents
// ============================================================

describe('POST /api/v1/engagements/:id/documents', () => {
  it('creates document with status queued on upload', async () => {
    const token = createToken();
    const engagementId = new mongoose.Types.ObjectId().toString();
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    const csvContent = createTestCSV();

    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test-report.csv"\r\n` +
        `Content-Type: text/csv\r\n\r\n`
      ),
      csvContent,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${engagementId}/documents`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    const result = JSON.parse(res.body);

    expect(res.statusCode).toBe(201);
    expect(result.document).toBeDefined();
    expect(result.document.filename).toBe('test-report.csv');
    expect(result.document.format).toBe('csv');
    expect(result.document.status).toBe('queued');
    expect(result.document.id).toBeDefined();
    expect(result.document.engagementId).toBe(engagementId);
  });

  it('returns 401 when no authentication provided', async () => {
    const engagementId = new mongoose.Types.ObjectId().toString();
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    const csvContent = createTestCSV();

    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.csv"\r\n` +
        `Content-Type: text/csv\r\n\r\n`
      ),
      csvContent,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${engagementId}/documents`,
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// Tests: GET /api/v1/engagements/:id/documents
// ============================================================

describe('GET /api/v1/engagements/:id/documents', () => {
  it('returns list of documents with correct fields', async () => {
    const token = createToken();
    const engagementId = new mongoose.Types.ObjectId();

    // Create test documents directly in DB
    await ESGDocumentModel.create([
      {
        engagementId,
        orgId: new mongoose.Types.ObjectId(),
        filename: 'report-2024.pdf',
        format: 'pdf',
        size: 1024000,
        hash: 'abc123',
        uploadSource: 'manual',
        status: 'ingested',
        extractedData: [
          { metric: 'GHG Scope 1', value: 1500, unit: 'tCO2e', confidence: 0.95 },
        ],
        uploadedAt: new Date(),
        processedAt: new Date(),
      },
      {
        engagementId,
        orgId: new mongoose.Types.ObjectId(),
        filename: 'data-2024.xlsx',
        format: 'xlsx',
        size: 512000,
        hash: 'def456',
        uploadSource: 'manual',
        status: 'queued',
        extractedData: [],
        uploadedAt: new Date(),
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${engagementId.toString()}/documents`,
      headers: { authorization: `Bearer ${token}` },
    });

    const result = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(result.documents).toBeDefined();
    expect(result.documents.length).toBe(2);

    const doc = result.documents[0];
    expect(doc.id).toBeDefined();
    expect(doc.filename).toBeDefined();
    expect(doc.format).toBeDefined();
    expect(doc.size).toBeDefined();
    expect(doc.status).toBeDefined();
    expect(doc.uploadedAt).toBeDefined();
    expect(doc.extractedDataCount).toBeDefined();
  });

  it('returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/engagements/eng-001/documents',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// Tests: GET /api/v1/documents/:id
// ============================================================

describe('GET /api/v1/documents/:id', () => {
  it('returns full document detail including data points', async () => {
    const token = createToken();
    const engagementId = new mongoose.Types.ObjectId();
    const orgId = new mongoose.Types.ObjectId();

    // Create document
    const doc = await ESGDocumentModel.create({
      engagementId,
      orgId,
      filename: 'sustainability-report.pdf',
      format: 'pdf',
      size: 2048000,
      hash: 'ghi789',
      uploadSource: 'manual',
      status: 'ingested',
      extractedData: [
        { metric: 'Energy Consumption', value: 12000, unit: 'kWh', confidence: 0.92 },
      ],
      extractedText: 'Sample extracted text content',
      uploadedAt: new Date(),
      processedAt: new Date(),
    });

    // Create associated data points
    await DataPointModel.create({
      engagementId,
      documentId: doc._id,
      frameworkRef: 'GRI 302-1',
      metricName: 'Energy Consumption',
      value: 12000,
      unit: 'kWh',
      period: { year: 2024 },
      sourceDocumentId: doc._id,
      sourcePage: 15,
      confidence: 'high',
      status: 'auto_extracted',
      extractionMethod: 'llm_extract',
      auditTrail: [
        {
          action: 'created',
          timestamp: new Date(),
          notes: 'Auto-extracted via LLM',
          newValue: 12000,
        },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/documents/${doc._id.toString()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    const result = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(result.document).toBeDefined();
    expect(result.document.filename).toBe('sustainability-report.pdf');
    expect(result.document.status).toBe('ingested');
    expect(result.document.extractedText).toBe('Sample extracted text content');
    expect(result.document.dataPoints).toBeDefined();
    expect(result.document.dataPoints.length).toBe(1);
    expect(result.document.dataPoints[0].frameworkRef).toBe('GRI 302-1');
    expect(result.document.dataPoints[0].auditTrail).toBeDefined();
    expect(result.document.dataPoints[0].auditTrail.length).toBeGreaterThan(0);
  });

  it('returns 404 for non-existent document', async () => {
    const token = createToken();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/documents/${fakeId.toString()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ============================================================
// Tests: Unit Normalization
// ============================================================

describe('Unit Normalization', () => {
  it('converts ML (milliliters) to m³', () => {
    const result = normalizeUnit(1000000, 'ML');
    expect(result.unit).toBe('m³');
    expect(result.value).toBeCloseTo(1.0, 2);
  });

  it('converts MWh to kWh', () => {
    const result = normalizeUnit(5, 'MWh');
    expect(result.unit).toBe('kWh');
    expect(result.value).toBe(5000);
  });

  it('converts short tons to metric tonnes', () => {
    const result = normalizeUnit(100, 'short tons');
    expect(result.unit).toBe('metric tonnes');
    expect(result.value).toBeCloseTo(90.7185, 2);
  });

  it('keeps m³ unchanged', () => {
    const result = normalizeUnit(500, 'm³');
    expect(result.unit).toBe('m³');
    expect(result.value).toBe(500);
  });

  it('keeps kWh unchanged', () => {
    const result = normalizeUnit(1000, 'kWh');
    expect(result.unit).toBe('kWh');
    expect(result.value).toBe(1000);
  });

  it('returns as-is for unknown units', () => {
    const result = normalizeUnit(42, 'widgets');
    expect(result.unit).toBe('widgets');
    expect(result.value).toBe(42);
  });

  it('converts GJ to kWh', () => {
    const result = normalizeUnit(1, 'GJ');
    expect(result.unit).toBe('kWh');
    expect(result.value).toBeCloseTo(277.778, 1);
  });

  it('converts kg to metric tonnes', () => {
    const result = normalizeUnit(1000, 'kg');
    expect(result.unit).toBe('metric tonnes');
    expect(result.value).toBeCloseTo(1.0, 4);
  });
});

// ============================================================
// Tests: Confidence Assignment
// ============================================================

describe('Confidence Assignment', () => {
  it('assigns high for score >= 0.9', () => {
    expect(assignConfidence(0.95)).toBe('high');
    expect(assignConfidence(0.9)).toBe('high');
    expect(assignConfidence(1.0)).toBe('high');
  });

  it('assigns medium for score >= 0.7 and < 0.9', () => {
    expect(assignConfidence(0.8)).toBe('medium');
    expect(assignConfidence(0.7)).toBe('medium');
    expect(assignConfidence(0.89)).toBe('medium');
  });

  it('assigns low for score < 0.7', () => {
    expect(assignConfidence(0.5)).toBe('low');
    expect(assignConfidence(0.69)).toBe('low');
    expect(assignConfidence(0.0)).toBe('low');
  });
});

// ============================================================
// Tests: Framework Mapping
// ============================================================

describe('Framework Mapping', () => {
  it('maps GHG emissions to GRI 305-1', () => {
    expect(mapToFramework('GHG Emissions Scope 1')).toBe('GRI 305-1');
  });

  it('maps energy consumption to GRI 302-1', () => {
    expect(mapToFramework('Energy Consumption')).toBe('GRI 302-1');
  });

  it('maps water consumption to GRI 303-5', () => {
    expect(mapToFramework('Water Consumption')).toBe('GRI 303-5');
  });

  it('maps waste to GRI 306-3', () => {
    expect(mapToFramework('Waste Generated')).toBe('GRI 306-3');
  });

  it('returns UNCLASSIFIED for unknown metrics', () => {
    expect(mapToFramework('Random Unknown Metric XYZ')).toBe('UNCLASSIFIED');
  });
});

// ============================================================
// Tests: Data Points with Audit Trail
// ============================================================

describe('DataPoint Audit Trail', () => {
  it('creates data points with audit trail entries', async () => {
    const engagementId = new mongoose.Types.ObjectId();
    const documentId = new mongoose.Types.ObjectId();

    const dp = await DataPointModel.create({
      engagementId,
      documentId,
      frameworkRef: 'GRI 305-1',
      metricName: 'GHG Emissions Scope 1',
      value: 1500,
      unit: 'tCO2e',
      period: { year: 2024 },
      sourceDocumentId: documentId,
      sourcePage: 12,
      confidence: 'high',
      status: 'auto_extracted',
      extractionMethod: 'llm_extract',
      auditTrail: [
        {
          action: 'created',
          timestamp: new Date(),
          notes: 'Auto-extracted via LLM from test-report.pdf',
          newValue: 1500,
        },
      ],
    });

    expect(dp.auditTrail).toBeDefined();
    expect(dp.auditTrail.length).toBe(1);
    expect(dp.auditTrail[0]!.action).toBe('created');
    expect(dp.auditTrail[0]!.notes).toContain('Auto-extracted via LLM');
  });

  it('stores extraction method on data points', async () => {
    const engagementId = new mongoose.Types.ObjectId();
    const documentId = new mongoose.Types.ObjectId();

    const dp = await DataPointModel.create({
      engagementId,
      documentId,
      frameworkRef: 'GRI 302-1',
      metricName: 'Energy Consumption',
      value: 12000,
      unit: 'kWh',
      period: { year: 2024 },
      confidence: 'medium',
      status: 'auto_extracted',
      extractionMethod: 'llm_extract',
      auditTrail: [],
    });

    expect(dp.extractionMethod).toBe('llm_extract');
    expect(dp.status).toBe('auto_extracted');
  });
});

// ============================================================
// Tests: Document Model
// ============================================================

describe('ESGDocument Model', () => {
  it('creates document with correct default status', async () => {
    const doc = await ESGDocumentModel.create({
      engagementId: new mongoose.Types.ObjectId(),
      orgId: new mongoose.Types.ObjectId(),
      filename: 'test.pdf',
      format: 'pdf',
      size: 1024,
      hash: 'testhash123',
      uploadSource: 'manual',
      extractedData: [],
      uploadedAt: new Date(),
    });

    expect(doc.status).toBe('queued');
    expect(doc.extractedData).toHaveLength(0);
  });

  it('updates status to failed with error message', async () => {
    const doc = await ESGDocumentModel.create({
      engagementId: new mongoose.Types.ObjectId(),
      orgId: new mongoose.Types.ObjectId(),
      filename: 'bad-file.pdf',
      format: 'pdf',
      size: 100,
      hash: 'badhash',
      uploadSource: 'manual',
      extractedData: [],
      uploadedAt: new Date(),
    });

    doc.status = 'failed';
    doc.errorMessage = 'Parsing error: corrupted file';
    await doc.save();

    const updated = await ESGDocumentModel.findById(doc._id);
    expect(updated!.status).toBe('failed');
    expect(updated!.errorMessage).toBe('Parsing error: corrupted file');
  });
});
