import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { registerWorkflowRoutes } from './workflow.routes.js';
import { WorkflowModel } from './workflow.model.js';
import { OrgProfileModel, FrameworkRecommendationModel } from '../organization/organization.model.js';
import { ReportModel } from '../report/report.model.js';
import { DataPointModel } from '../ingestion/ingestion.model.js';

// ============================================================
// Test Setup
// ============================================================

const JWT_SECRET = 'test-secret-key-for-workflow-tests';
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
        { resource: 'workflow', actions: ['read', 'write', 'delete', 'approve'] },
      ],
      ...overrides,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function initWorkflow(engagementId: string = TEST_ENGAGEMENT_ID) {
  const token = createToken();
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/engagements/${engagementId}/workflow/initialize`,
    headers: { authorization: `Bearer ${token}` },
  });
  return JSON.parse(res.body);
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = Fastify();
  await registerWorkflowRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await WorkflowModel.deleteMany({});
  await OrgProfileModel.deleteMany({});
  await FrameworkRecommendationModel.deleteMany({});
  await ReportModel.deleteMany({});
  await DataPointModel.deleteMany({});
});

// ============================================================
// Helper: seed entry criteria data for Setup -> Data Collection
// ============================================================

async function seedSetupCriteria() {
  await OrgProfileModel.create({
    orgId: new mongoose.Types.ObjectId(TEST_ORG_ID),
    legalName: 'Test Corp',
    tradingName: 'Test',
    country: 'SA',
    region: 'MENA',
    city: 'Riyadh',
    industryGICS: '4010',
    subIndustry: 'Banks',
    listingStatus: 'listed',
    employeeCount: 500,
    revenueRange: '10M-50M',
    facilities: [],
    supplyChainComplexity: 'low',
    currentFrameworks: ['GRI'],
    esgMaturity: 'beginner',
    reportingHistory: [],
  });

  await FrameworkRecommendationModel.create({
    orgId: new mongoose.Types.ObjectId(TEST_ORG_ID),
    recommendations: [
      { framework: 'GRI', category: 'mandatory', reason: 'Required by regulation' },
    ],
    selections: {
      selected: ['GRI'],
      deselected: [],
      confirmedAt: new Date(),
    },
  });
}

// ============================================================
// Helper: seed data completeness for Data Collection -> Drafting
// ============================================================

async function seedDataCompleteness(completenessPercent: number) {
  const total = 10;
  const completed = Math.round((completenessPercent / 100) * total);
  const missing = total - completed;

  for (let i = 0; i < completed; i++) {
    await DataPointModel.create({
      engagementId: new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID),
      frameworkRef: `GRI-${i}`,
      metricName: `metric_${i}`,
      value: 100 + i,
      unit: 'tCO2e',
      period: { year: 2025 },
      confidence: 'high',
      status: 'user_confirmed',
      extractionMethod: 'manual',
      auditTrail: [],
    });
  }

  for (let i = 0; i < missing; i++) {
    await DataPointModel.create({
      engagementId: new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID),
      frameworkRef: `GRI-missing-${i}`,
      metricName: `metric_missing_${i}`,
      value: 0,
      unit: 'tCO2e',
      period: { year: 2025 },
      confidence: 'low',
      status: 'missing',
      extractionMethod: 'manual',
      auditTrail: [],
    });
  }
}

// ============================================================
// Initialize Tests
// ============================================================

describe('Workflow - Initialize', () => {
  it('should create a default 8-stage workflow with stage 1 active', async () => {
    const token = createToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/initialize`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.stages).toHaveLength(8);
    expect(body.currentStage).toBe('Setup');
    expect(body.stages[0].name).toBe('Setup');
    expect(body.stages[0].status).toBe('active');
    expect(body.stages[0].order).toBe(1);
    expect(body.stages[1].name).toBe('Data Collection');
    expect(body.stages[1].status).toBe('pending');
    expect(body.stages[7].name).toBe('Final');
    expect(body.stages[7].status).toBe('pending');
    expect(body.history).toHaveLength(0);
  });

  it('should return 409 if workflow already exists', async () => {
    const token = createToken();
    await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/initialize`,
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/initialize`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(409);
  });

  it('should return 401 without authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/initialize`,
    });
    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// Get Workflow Tests
// ============================================================

describe('Workflow - Get Current State', () => {
  it('should return the current workflow state', async () => {
    await initWorkflow();

    const token = createToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.currentStage).toBe('Setup');
    expect(body.stages).toHaveLength(8);
  });

  it('should return 404 for non-existent workflow', async () => {
    const token = createToken();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${fakeId}/workflow`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ============================================================
// Advance Tests
// ============================================================

describe('Workflow - Advance', () => {
  it('should advance when entry criteria are met', async () => {
    await initWorkflow();
    await seedSetupCriteria();

    const token = createToken({ role: 'owner' });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
      payload: { approvalNotes: 'Setup complete, moving forward' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.currentStage).toBe('Data Collection');
    expect(body.stages[0].status).toBe('completed');
    expect(body.stages[0].approvedBy).toBe(TEST_USER_ID);
    expect(body.stages[0].approvalNotes).toBe('Setup complete, moving forward');
    expect(body.stages[1].status).toBe('active');
    expect(body.history).toHaveLength(1);
    expect(body.history[0].action).toBe('advance');
    expect(body.history[0].fromStage).toBe('Setup');
    expect(body.history[0].toStage).toBe('Data Collection');
  });

  it('should block advance when entry criteria are not met', async () => {
    await initWorkflow();
    // No org profile or framework selections seeded

    const token = createToken({ role: 'admin' });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('Entry criteria not met');
    expect(body.error).toContain('Organization profile must exist');
  });

  it('should block advance when data completeness < 80%', async () => {
    // Advance to Data Collection first
    await initWorkflow();
    await seedSetupCriteria();

    const token = createToken({ role: 'owner' });
    await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Seed 50% completeness
    await seedDataCompleteness(50);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('Data completeness');
    expect(body.error).toContain('80%');
  });

  it('should only allow owner/admin/manager to advance (analyst gets 403)', async () => {
    await initWorkflow();

    const token = createToken({ role: 'analyst' });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should not advance past Final stage', async () => {
    // Create workflow already at Final
    await WorkflowModel.create({
      engagementId: new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID),
      stages: [
        { name: 'Setup', order: 1, status: 'completed' },
        { name: 'Data Collection', order: 2, status: 'completed' },
        { name: 'Drafting', order: 3, status: 'completed' },
        { name: 'Internal Review', order: 4, status: 'completed' },
        { name: 'Partner Approval', order: 5, status: 'completed' },
        { name: 'Client Review', order: 6, status: 'completed' },
        { name: 'Assurance Prep', order: 7, status: 'completed' },
        { name: 'Final', order: 8, status: 'active' },
      ],
      currentStage: 'Final',
      history: [],
    });

    const token = createToken({ role: 'owner' });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('Cannot advance past Final');
  });
});

// ============================================================
// Return to Earlier Stage Tests
// ============================================================

describe('Workflow - Return to Earlier Stage', () => {
  it('should return to an earlier stage with reason', async () => {
    // Create workflow at Internal Review
    await WorkflowModel.create({
      engagementId: new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID),
      stages: [
        { name: 'Setup', order: 1, status: 'completed' },
        { name: 'Data Collection', order: 2, status: 'completed' },
        { name: 'Drafting', order: 3, status: 'completed' },
        { name: 'Internal Review', order: 4, status: 'active' },
        { name: 'Partner Approval', order: 5, status: 'pending' },
        { name: 'Client Review', order: 6, status: 'pending' },
        { name: 'Assurance Prep', order: 7, status: 'pending' },
        { name: 'Final', order: 8, status: 'pending' },
      ],
      currentStage: 'Internal Review',
      history: [],
    });

    const token = createToken({ role: 'manager' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/return`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        returnToStage: 'Data Collection',
        reason: 'Missing Scope 3 emissions data',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.currentStage).toBe('Data Collection');
    expect(body.stages[1].status).toBe('active');
    // Stages between target and current should be reset to pending
    expect(body.stages[2].status).toBe('pending');
    expect(body.stages[3].status).toBe('pending');
    expect(body.history).toHaveLength(1);
    expect(body.history[0].action).toBe('return');
    expect(body.history[0].reason).toBe('Missing Scope 3 emissions data');
  });

  it('should not allow return to a future stage', async () => {
    await initWorkflow();
    // Currently at Setup — cannot return to Data Collection (a future stage)

    const token = createToken({ role: 'owner' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/return`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        returnToStage: 'Data Collection',
        reason: 'Test',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('earlier stage');
  });

  it('should not allow return to the same stage', async () => {
    await initWorkflow();

    const token = createToken({ role: 'owner' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/return`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        returnToStage: 'Setup',
        reason: 'Test',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should return 400 for invalid stage name', async () => {
    await initWorkflow();

    const token = createToken({ role: 'owner' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/return`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        returnToStage: 'Nonexistent Stage',
        reason: 'Test',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ============================================================
// History Tests
// ============================================================

describe('Workflow - Transition History', () => {
  it('should record all transitions in history', async () => {
    // Set up workflow and advance through two stages
    await initWorkflow();
    await seedSetupCriteria();

    const token = createToken({ role: 'owner' });

    // Advance Setup -> Data Collection
    await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
      payload: { approvalNotes: 'First advance' },
    });

    // Seed 90% data completeness for next advance
    await seedDataCompleteness(90);

    // Advance Data Collection -> Drafting
    await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/history`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const history = JSON.parse(res.body);
    expect(history).toHaveLength(2);
    expect(history[0].fromStage).toBe('Setup');
    expect(history[0].toStage).toBe('Data Collection');
    expect(history[0].action).toBe('advance');
    expect(history[0].approvalNotes).toBe('First advance');
    expect(history[1].fromStage).toBe('Data Collection');
    expect(history[1].toStage).toBe('Drafting');
    expect(history[1].action).toBe('advance');
  });

  it('should record return transitions in history', async () => {
    // Create workflow at Drafting
    await WorkflowModel.create({
      engagementId: new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID),
      stages: [
        { name: 'Setup', order: 1, status: 'completed' },
        { name: 'Data Collection', order: 2, status: 'completed' },
        { name: 'Drafting', order: 3, status: 'active' },
        { name: 'Internal Review', order: 4, status: 'pending' },
        { name: 'Partner Approval', order: 5, status: 'pending' },
        { name: 'Client Review', order: 6, status: 'pending' },
        { name: 'Assurance Prep', order: 7, status: 'pending' },
        { name: 'Final', order: 8, status: 'pending' },
      ],
      currentStage: 'Drafting',
      history: [],
    });

    const token = createToken({ role: 'admin' });

    // Return to Setup
    await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/return`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        returnToStage: 'Setup',
        reason: 'Need to reconfigure org profile',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/history`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const history = JSON.parse(res.body);
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe('return');
    expect(history[0].fromStage).toBe('Drafting');
    expect(history[0].toStage).toBe('Setup');
    expect(history[0].reason).toBe('Need to reconfigure org profile');
  });
});

// ============================================================
// Role-Based Access Tests
// ============================================================

describe('Workflow - Role-Based Access', () => {
  it('should allow manager to advance', async () => {
    await initWorkflow();
    await seedSetupCriteria();

    const token = createToken({ role: 'manager' });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should allow admin to advance', async () => {
    await initWorkflow();
    await seedSetupCriteria();

    const token = createToken({ role: 'admin' });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should deny reviewer from advancing', async () => {
    await initWorkflow();

    const token = createToken({ role: 'reviewer' });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should deny auditor_readonly from advancing', async () => {
    await initWorkflow();

    const token = createToken({ role: 'auditor_readonly' });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/advance`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should deny analyst from returning to earlier stage', async () => {
    await WorkflowModel.create({
      engagementId: new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID),
      stages: [
        { name: 'Setup', order: 1, status: 'completed' },
        { name: 'Data Collection', order: 2, status: 'active' },
        { name: 'Drafting', order: 3, status: 'pending' },
        { name: 'Internal Review', order: 4, status: 'pending' },
        { name: 'Partner Approval', order: 5, status: 'pending' },
        { name: 'Client Review', order: 6, status: 'pending' },
        { name: 'Assurance Prep', order: 7, status: 'pending' },
        { name: 'Final', order: 8, status: 'pending' },
      ],
      currentStage: 'Data Collection',
      history: [],
    });

    const token = createToken({ role: 'analyst' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${TEST_ENGAGEMENT_ID}/workflow/return`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        returnToStage: 'Setup',
        reason: 'Test',
      },
    });

    expect(res.statusCode).toBe(403);
  });
});
