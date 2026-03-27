import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { registerAgentRoutes } from './agent.routes.js';
import { DataPointModel, ESGDocumentModel } from '../ingestion/ingestion.model.js';
import { getToolDefinitions } from './agent.tools.js';
import { buildAgentContext } from './agent.context.js';

// ============================================================
// Mock Claude API — MUST NOT make real API calls
// ============================================================

vi.mock('../../lib/claude.js', () => {
  const mockCreate = vi.fn();
  return {
    getClient: vi.fn(() => ({
      messages: {
        create: mockCreate,
      },
    })),
    sendMessage: vi.fn().mockResolvedValue('Mocked disclosure draft text.'),
    __mockCreate: mockCreate,
  };
});

// Import the mock after setup
const claudeMock = await import('../../lib/claude.js');
const mockCreate = (claudeMock as unknown as { __mockCreate: ReturnType<typeof vi.fn> }).__mockCreate;

// ============================================================
// Test Setup
// ============================================================

const JWT_SECRET = 'test-secret-key-for-agent-tests';
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
  await registerAgentRoutes(app);
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
  mockCreate.mockReset();
});

// ============================================================
// Route Tests
// ============================================================

describe('Agent Routes', () => {
  // ----------------------------------------------------------
  // Authentication
  // ----------------------------------------------------------
  describe('Authentication', () => {
    it('should return 401 for unauthenticated chat request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/chat',
        payload: {
          engagementId: TEST_ENGAGEMENT_ID,
          message: 'Hello',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 for unauthenticated action request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/action',
        payload: {
          engagementId: TEST_ENGAGEMENT_ID,
          action: 'get_data_point',
          params: {},
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ----------------------------------------------------------
  // Chat Endpoint
  // ----------------------------------------------------------
  describe('POST /api/v1/agent/chat', () => {
    it('should call Claude with correct context and tools', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Hello! I am the Merris ESG Agent. How can I help you today?',
          },
        ],
      });

      const token = createToken();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          engagementId: TEST_ENGAGEMENT_ID,
          message: 'What is our current ESG data completeness?',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.response).toContain('Merris ESG Agent');
      expect(body.toolCalls).toEqual([]);

      // Verify Claude was called with tools
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0]![0];
      expect(callArgs.tools).toBeDefined();
      expect(callArgs.tools.length).toBe(10);
      expect(callArgs.system).toContain('Merris ESG Agent');
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0].content).toBe(
        'What is our current ESG data completeness?'
      );
    });

    it('should handle tool_use responses — execute tool and send result back', async () => {
      // First call: Claude requests a tool
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'toolu_test123',
            name: 'get_data_point',
            input: {
              frameworkRef: 'GRI-302-1',
              metricName: 'Energy consumption',
              engagementId: TEST_ENGAGEMENT_ID,
            },
          },
        ],
      });

      // Second call: Claude generates final response with tool result
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Based on the data, no energy consumption data point has been recorded yet.',
          },
        ],
      });

      const token = createToken();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          engagementId: TEST_ENGAGEMENT_ID,
          message: 'What is our energy consumption?',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.toolCalls).toHaveLength(1);
      expect(body.toolCalls[0].name).toBe('get_data_point');
      expect(body.toolCalls[0].output).toHaveProperty('found', false);

      // Verify two Claude calls were made (tool_use + tool_result)
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should return validation error for missing message', async () => {
      const token = createToken();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          engagementId: TEST_ENGAGEMENT_ID,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should pass conversation history to Claude', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I recall our earlier discussion.' }],
      });

      const token = createToken();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/chat',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          engagementId: TEST_ENGAGEMENT_ID,
          message: 'Continue from where we left off',
          conversationHistory: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const callArgs = mockCreate.mock.calls[0]![0];
      // 2 history messages + 1 new message = 3
      expect(callArgs.messages).toHaveLength(3);
    });
  });

  // ----------------------------------------------------------
  // Action Endpoint
  // ----------------------------------------------------------
  describe('POST /api/v1/agent/action', () => {
    it('should execute get_data_point tool directly', async () => {
      // Seed a data point
      await DataPointModel.create({
        engagementId: new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID),
        frameworkRef: 'GRI-302-1',
        metricName: 'Total energy consumption',
        value: 15000,
        unit: 'MWh',
        period: { year: 2024 },
        confidence: 'high',
        status: 'user_confirmed',
        extractionMethod: 'manual',
        auditTrail: [{ action: 'created', timestamp: new Date() }],
      });

      const token = createToken();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/action',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          engagementId: TEST_ENGAGEMENT_ID,
          action: 'get_data_point',
          params: {
            frameworkRef: 'GRI-302-1',
            metricName: 'Total energy consumption',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.result.found).toBe(true);
      expect(body.result.dataPoint.value).toBe(15000);
      expect(body.result.dataPoint.unit).toBe('MWh');
    });

    it('should return error for unknown action', async () => {
      const token = createToken();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/action',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          engagementId: TEST_ENGAGEMENT_ID,
          action: 'nonexistent_tool',
          params: {},
        },
      });

      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('Unknown action');
    });

    it('should execute get_emission_factor tool', async () => {
      const token = createToken();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/action',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          engagementId: TEST_ENGAGEMENT_ID,
          action: 'get_emission_factor',
          params: {
            country: 'Saudi Arabia',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // No emission factors seeded, should return not found
      expect(body.result.found).toBe(false);
    });

    it('should execute benchmark tool (stub)', async () => {
      const token = createToken();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/action',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          engagementId: TEST_ENGAGEMENT_ID,
          action: 'benchmark',
          params: {
            metricName: 'Carbon Intensity',
            value: 120,
            sector: 'Energy',
            region: 'GCC',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.result.metricName).toBe('Carbon Intensity');
      expect(body.result.yourValue).toBe(120);
      expect(body.result.peerStats).toBeDefined();
      expect(body.result.note).toContain('simulated');
    });

    it('should execute generate_chart tool', async () => {
      const token = createToken();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/action',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          engagementId: TEST_ENGAGEMENT_ID,
          action: 'generate_chart',
          params: {
            chartType: 'bar',
            data: [
              { name: 'Scope 1', value: 500 },
              { name: 'Scope 2', value: 300 },
            ],
            title: 'GHG Emissions by Scope',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.result.spec.type).toBe('bar');
      expect(body.result.spec.title).toBe('GHG Emissions by Scope');
    });
  });
});

// ============================================================
// Tool Unit Tests
// ============================================================

describe('Agent Tools', () => {
  it('should define exactly 10 tools', () => {
    const tools = getToolDefinitions();
    expect(tools).toHaveLength(10);
  });

  it('should have unique tool names', () => {
    const tools = getToolDefinitions();
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(10);
  });

  it('should have valid input_schema for each tool', () => {
    const tools = getToolDefinitions();
    for (const tool of tools) {
      expect(tool.input_schema.type).toBe('object');
      expect(tool.input_schema.properties).toBeDefined();
      expect(tool.input_schema.required).toBeDefined();
      expect(Array.isArray(tool.input_schema.required)).toBe(true);
    }
  });

  describe('get_data_point', () => {
    it('should return correct data from database', async () => {
      await DataPointModel.create({
        engagementId: new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID),
        frameworkRef: 'GRI-305-1',
        metricName: 'Scope 1 GHG emissions',
        value: 2500,
        unit: 'tCO2e',
        period: { year: 2024 },
        confidence: 'high',
        status: 'user_confirmed',
        extractionMethod: 'manual',
        auditTrail: [{ action: 'created', timestamp: new Date() }],
      });

      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'get_data_point')!;
      const result = (await tool.handler({
        frameworkRef: 'GRI-305-1',
        metricName: 'Scope 1 GHG emissions',
        engagementId: TEST_ENGAGEMENT_ID,
      })) as { found: boolean; dataPoint: { value: number; unit: string } };

      expect(result.found).toBe(true);
      expect(result.dataPoint.value).toBe(2500);
      expect(result.dataPoint.unit).toBe('tCO2e');
    });

    it('should return not found for missing data points', async () => {
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'get_data_point')!;
      const result = (await tool.handler({
        frameworkRef: 'SASB-X',
        metricName: 'Nonexistent metric',
        engagementId: TEST_ENGAGEMENT_ID,
      })) as { found: boolean; message: string };

      expect(result.found).toBe(false);
      expect(result.message).toContain('No data point found');
    });
  });

  describe('check_consistency', () => {
    it('should detect conflicting values', async () => {
      const engId = new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID);

      await DataPointModel.create([
        {
          engagementId: engId,
          frameworkRef: 'GRI-302-1',
          metricName: 'Total energy',
          value: 1000,
          unit: 'MWh',
          period: { year: 2024 },
          confidence: 'high',
          status: 'user_confirmed',
          extractionMethod: 'manual',
          auditTrail: [{ action: 'created', timestamp: new Date() }],
        },
        {
          engagementId: engId,
          frameworkRef: 'GRI-302-1',
          metricName: 'Total energy',
          value: 2000,
          unit: 'MWh',
          period: { year: 2024 },
          confidence: 'medium',
          status: 'auto_extracted',
          extractionMethod: 'llm_extract',
          auditTrail: [{ action: 'created', timestamp: new Date() }],
        },
      ]);

      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'check_consistency')!;
      const result = (await tool.handler({ reportId: TEST_ENGAGEMENT_ID })) as {
        issuesFound: number;
        issues: Array<{ type: string }>;
      };

      expect(result.issuesFound).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.type === 'conflicting_values')).toBe(true);
    });
  });

  describe('search_documents', () => {
    it('should find matching documents', async () => {
      await ESGDocumentModel.create({
        engagementId: new mongoose.Types.ObjectId(TEST_ENGAGEMENT_ID),
        orgId: new mongoose.Types.ObjectId(TEST_ORG_ID),
        filename: 'sustainability-report-2024.pdf',
        format: 'pdf',
        size: 1024,
        hash: 'abc123',
        uploadSource: 'manual',
        status: 'ingested',
        extractedData: [
          { metric: 'GHG emissions', value: 5000, unit: 'tCO2e', confidence: 0.9 },
        ],
        extractedText: 'Total GHG emissions for the reporting period were 5000 tCO2e.',
      });

      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'search_documents')!;
      const result = (await tool.handler({
        query: 'GHG emissions',
        engagementId: TEST_ENGAGEMENT_ID,
      })) as { results: Array<{ filename: string }> };

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.filename).toBe('sustainability-report-2024.pdf');
    });

    it('should return empty for no matches', async () => {
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'search_documents')!;
      const result = (await tool.handler({
        query: 'nonexistent topic',
        engagementId: TEST_ENGAGEMENT_ID,
      })) as { results: unknown[]; message: string };

      expect(result.results).toHaveLength(0);
      expect(result.message).toContain('No documents found');
    });
  });

  describe('Agent never fabricates data (empty engagement)', () => {
    it('should say no data available when engagement is empty', async () => {
      const tools = getToolDefinitions();
      const dpTool = tools.find((t) => t.name === 'get_data_point')!;
      const emptyEngId = new mongoose.Types.ObjectId().toString();

      const result = (await dpTool.handler({
        frameworkRef: 'GRI-305-1',
        metricName: 'Any metric',
        engagementId: emptyEngId,
      })) as { found: boolean; message: string };

      expect(result.found).toBe(false);
      expect(result.message).toContain('No data point found');
    });

    it('draft_disclosure should refuse without data', async () => {
      const tools = getToolDefinitions();
      const draftTool = tools.find((t) => t.name === 'draft_disclosure')!;
      const emptyEngId = new mongoose.Types.ObjectId().toString();

      const result = (await draftTool.handler({
        frameworkRef: 'GRI',
        disclosureCode: 'GRI-302-1',
        engagementId: emptyEngId,
      })) as { draft: string | null; message: string; dataPointCount: number };

      expect(result.draft).toBeNull();
      expect(result.dataPointCount).toBe(0);
      expect(result.message).toContain('No data points available');
    });
  });
});

// ============================================================
// Context Builder Tests
// ============================================================

describe('Agent Context Builder', () => {
  it('should produce correct structure', async () => {
    const context = await buildAgentContext(TEST_ENGAGEMENT_ID, TEST_USER_ID);

    expect(context).toHaveProperty('engagement');
    expect(context).toHaveProperty('orgProfile');
    expect(context).toHaveProperty('activeFrameworks');
    expect(context).toHaveProperty('dataCompleteness');
    expect(context).toHaveProperty('currentStage');
    expect(context).toHaveProperty('recentActivity');
    expect(context).toHaveProperty('userRole');

    expect(context.engagement).toHaveProperty('name');
    expect(context.engagement).toHaveProperty('scope');
    expect(context.engagement).toHaveProperty('deadline');
    expect(context.engagement).toHaveProperty('status');

    expect(context.orgProfile).toHaveProperty('industry');
    expect(context.orgProfile).toHaveProperty('country');
    expect(context.orgProfile).toHaveProperty('listing');
    expect(context.orgProfile).toHaveProperty('size');

    expect(context.dataCompleteness).toHaveProperty('overall');
    expect(context.dataCompleteness).toHaveProperty('byFramework');
    expect(typeof context.dataCompleteness.overall).toBe('number');
    expect(Array.isArray(context.dataCompleteness.byFramework)).toBe(true);

    expect(Array.isArray(context.activeFrameworks)).toBe(true);
    expect(Array.isArray(context.recentActivity)).toBe(true);
    expect(typeof context.userRole).toBe('string');
  });

  it('should return data_collection stage for empty engagement', async () => {
    const context = await buildAgentContext(
      new mongoose.Types.ObjectId().toString(),
      TEST_USER_ID
    );
    expect(context.currentStage).toBe('data_collection');
    expect(context.dataCompleteness.overall).toBe(0);
  });
});
