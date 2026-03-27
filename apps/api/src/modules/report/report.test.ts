import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { registerReportRoutes } from './report.routes.js';
import { ReportModel } from './report.model.js';

// ============================================================
// Test Setup
// ============================================================

const JWT_SECRET = 'test-secret-key-for-report-tests';
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
        { resource: 'reports', actions: ['read', 'write', 'delete', 'approve'] },
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
  await registerReportRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await ReportModel.deleteMany({});
});

// ============================================================
// Authentication Tests
// ============================================================

describe('Report Routes - Authentication', () => {
  it('should return 401 for unauthenticated create request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      payload: {
        title: 'Test Report',
        type: 'esg_report',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 401 for unauthenticated list request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('should return 401 for unauthenticated get request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/${new mongoose.Types.ObjectId().toString()}`,
    });
    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// CRUD Tests
// ============================================================

describe('Report Routes - CRUD', () => {
  it('should create a report', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'FY2025 GRI Sustainability Report',
        type: 'sustainability_report',
        language: 'en',
        sections: [
          { title: 'General Disclosures', frameworkRef: 'GRI-2', disclosures: ['GRI-2-1', 'GRI-2-2'] },
          { title: 'Environmental', frameworkRef: 'GRI-300' },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.title).toBe('FY2025 GRI Sustainability Report');
    expect(body.type).toBe('sustainability_report');
    expect(body.status).toBe('draft');
    expect(body.structure).toHaveLength(2);
    expect(body.structure[0].title).toBe('General Disclosures');
    expect(body.structure[0].status).toBe('pending');
  });

  it('should create a report with no sections', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Empty Report',
        type: 'esg_report',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.structure).toHaveLength(0);
  });

  it('should return validation error for missing title', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: 'esg_report',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should list reports for an engagement', async () => {
    const token = createToken();

    // Create two reports
    await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Report A', type: 'esg_report' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Report B', type: 'tcfd_report' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(2);
  });

  it('should get a single report', async () => {
    const token = createToken();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Get Me',
        type: 'esg_report',
        sections: [{ title: 'Section 1' }],
      },
    });

    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/${created._id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.title).toBe('Get Me');
    expect(body.structure).toHaveLength(1);
  });

  it('should return 404 for non-existent report', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/${new mongoose.Types.ObjectId().toString()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should update report metadata', async () => {
    const token = createToken();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Original Title', type: 'esg_report' },
    });

    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/reports/${created._id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Updated Title', status: 'in_review' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.title).toBe('Updated Title');
    expect(body.status).toBe('in_review');
  });
});

// ============================================================
// Section Update Tests
// ============================================================

describe('Report Routes - Section Updates', () => {
  it('should update section content and status', async () => {
    const token = createToken();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Section Test',
        type: 'esg_report',
        sections: [{ title: 'Overview' }],
      },
    });

    const created = JSON.parse(createRes.body);
    const sectionId = created.structure[0].id;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/reports/${created._id}/sections/${sectionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        content: 'This is the overview content for the ESG report.',
        status: 'drafted',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const section = body.structure.find((s: { id: string }) => s.id === sectionId);
    expect(section.content).toBe('This is the overview content for the ESG report.');
    expect(section.status).toBe('drafted');
  });

  it('should return 404 for non-existent section', async () => {
    const token = createToken();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'No Section',
        type: 'esg_report',
        sections: [],
      },
    });

    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/reports/${created._id}/sections/nonexistent`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'test' },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ============================================================
// Review Comment Tests
// ============================================================

describe('Report Routes - Review Comments', () => {
  it('should add a review comment to a section', async () => {
    const token = createToken();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Review Test',
        type: 'esg_report',
        sections: [{ title: 'Governance' }],
      },
    });

    const created = JSON.parse(createRes.body);
    const sectionId = created.structure[0].id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reports/${created._id}/sections/${sectionId}/review`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        content: 'Please add more detail on board composition.',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    const section = body.structure.find((s: { id: string }) => s.id === sectionId);
    expect(section.reviewComments).toHaveLength(1);
    expect(section.reviewComments[0].content).toBe(
      'Please add more detail on board composition.',
    );
    expect(section.reviewComments[0].userId).toBe(TEST_USER_ID);
    expect(section.reviewComments[0].resolved).toBe(false);
  });

  it('should return validation error for empty comment', async () => {
    const token = createToken();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Review Validation',
        type: 'esg_report',
        sections: [{ title: 'Section' }],
      },
    });

    const created = JSON.parse(createRes.body);
    const sectionId = created.structure[0].id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reports/${created._id}/sections/${sectionId}/review`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        content: '',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ============================================================
// Export Tests
// ============================================================

describe('Report Routes - Export', () => {
  it('should return export stub for valid report', async () => {
    const token = createToken();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Export Test', type: 'esg_report' },
    });

    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reports/${created._id}/export`,
      headers: { authorization: `Bearer ${token}` },
      payload: { format: 'pdf' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.format).toBe('pdf');
    expect(body.url).toContain('.pdf');
    expect(body.message).toContain('PDF');
  });

  it('should return 404 for non-existent report export', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reports/${new mongoose.Types.ObjectId().toString()}/export`,
      headers: { authorization: `Bearer ${token}` },
      payload: { format: 'docx' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should return validation error for invalid format', async () => {
    const token = createToken();

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/reports`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Bad Format', type: 'esg_report' },
    });

    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reports/${created._id}/export`,
      headers: { authorization: `Bearer ${token}` },
      payload: { format: 'xlsx' },
    });

    expect(res.statusCode).toBe(400);
  });
});
