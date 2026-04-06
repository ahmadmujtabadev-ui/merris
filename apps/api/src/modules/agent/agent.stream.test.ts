import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import type { StreamEvent } from '@merris/shared';
import { registerAssistantRoutes } from '../../services/assistant/assistant.router.js';

vi.mock('../../lib/claude.js', () => {
  const mockCreate = vi.fn();
  const mockGetClient = vi.fn(() => ({ messages: { create: mockCreate } }));
  return {
    getClient: mockGetClient,
    sendMessage: vi.fn(),
    __mockCreate: mockCreate,
    __mockGetClient: mockGetClient,
  };
});

const claudeMock = await import('../../lib/claude.js');
const mockCreate = (claudeMock as unknown as { __mockCreate: ReturnType<typeof vi.fn> }).__mockCreate;
const mockGetClient = (claudeMock as unknown as { __mockGetClient: ReturnType<typeof vi.fn> }).__mockGetClient;

const TEST_ORG_ID = new mongoose.Types.ObjectId().toString();
const TEST_USER_ID = new mongoose.Types.ObjectId().toString();
const TEST_ENGAGEMENT_ID = new mongoose.Types.ObjectId().toString();

// Match agent.test.ts to avoid env-var collision when vitest runs with --no-isolate
const JWT_SECRET = 'test-secret-key-for-agent-tests';
process.env['JWT_SECRET'] = JWT_SECRET;

function token() {
  return jwt.sign(
    { userId: TEST_USER_ID, orgId: TEST_ORG_ID, role: 'manager', permissions: [{ resource: 'data', actions: ['read', 'write'] }] },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  mockCreate.mockReset();
});

describe('chatStream — phase emitter scaffold', () => {
  it('emits thinking_step active+done for every phase in order', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'A direct, sourced answer.' }],
    });

    const { chatStream } = await import('./agent.stream.js');

    const events: StreamEvent[] = [];
    await chatStream(
      {
        engagementId: TEST_ENGAGEMENT_ID,
        userId: TEST_USER_ID,
        message: 'What are our Scope 1 emissions?',
      },
      (e) => events.push(e),
    );

    const phaseOrder = events
      .filter((e): e is Extract<StreamEvent, { type: 'thinking_step' }> => e.type === 'thinking_step')
      .map((e) => `${e.step}:${e.status}`);

    expect(phaseOrder).toEqual([
      'Assessing query:active',
      'Assessing query:done',
      'Searching context:active',
      'Searching context:done',
      'Retrieving intelligence:active',
      'Retrieving intelligence:done',
      'Analyzing:active',
      'Analyzing:done',
      'Evaluating quality:active',
      'Evaluating quality:done',
      'Answering:active',
      'Answering:done',
    ]);

    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('emits token, evaluation, and done in the correct relative order', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Scope 1 emissions for FY24 were 12,400 tCO2e.' }],
    });

    const { chatStream } = await import('./agent.stream.js');

    const events: StreamEvent[] = [];
    await chatStream(
      { engagementId: TEST_ENGAGEMENT_ID, userId: TEST_USER_ID, message: 'Scope 1?' },
      (e) => events.push(e),
    );

    const tokenIdx = events.findIndex((e) => e.type === 'token');
    const evalIdx = events.findIndex((e) => e.type === 'evaluation');
    const doneIdx = events.findIndex((e) => e.type === 'done');
    const answeringActiveIdx = events.findIndex(
      (e) => e.type === 'thinking_step' && e.step === 'Answering' && e.status === 'active',
    );

    expect(tokenIdx).toBeGreaterThan(answeringActiveIdx);
    expect(evalIdx).toBeGreaterThan(tokenIdx);
    expect(doneIdx).toBe(events.length - 1);

    const token = events[tokenIdx] as Extract<StreamEvent, { type: 'token' }>;
    expect(token.text).toContain('12,400');
  });

  it('emits sources event when tool calls produce citations', async () => {
    // Seed kb_water_risk so the get_water_stress handler returns a non-empty result
    await mongoose.connection.db!.collection('kb_water_risk').insertOne({
      country: 'Qatar',
      countryCode: 'QA',
      waterStressScore: 4.8,
      label: 'Extremely High',
      ranking: 1,
      depletionScore: 4.5,
      year: 2023,
    });

    // First call: Claude wants a tool that's in TOOL_CITATION_MAP
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_test_water',
          name: 'get_water_stress',
          input: { country: 'Qatar' },
        },
      ],
    });
    // Second call: Claude returns final text after tool result
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Qatar water stress is high.' }],
    });

    const { chatStream } = await import('./agent.stream.js');

    const events: StreamEvent[] = [];
    await chatStream(
      { engagementId: TEST_ENGAGEMENT_ID, userId: TEST_USER_ID, message: 'water risk?' },
      (e) => events.push(e),
    );

    const sourcesEvent = events.find((e) => e.type === 'sources');
    expect(sourcesEvent).toBeDefined();
    const cites = (sourcesEvent as Extract<StreamEvent, { type: 'sources' }>).citations;
    expect(cites.length).toBeGreaterThanOrEqual(1);
    expect(cites[0]).toHaveProperty('title');
    expect(cites[0]).toHaveProperty('source');
  });

  it('emits thinking_sources during Retrieving intelligence when knowledgeSources provided', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'OK.' }],
    });

    const { chatStream } = await import('./agent.stream.js');

    const events: StreamEvent[] = [];
    await chatStream(
      {
        engagementId: TEST_ENGAGEMENT_ID,
        userId: TEST_USER_ID,
        message: 'Anything',
        knowledgeSources: ['K1', 'K7'],
      },
      (e) => events.push(e),
    );

    const sourcesEvent = events.find((e) => e.type === 'thinking_sources');
    expect(sourcesEvent).toBeDefined();
    expect((sourcesEvent as Extract<StreamEvent, { type: 'thinking_sources' }>).sources).toEqual(['K1', 'K7']);
  });

  it('emits error+done early when getClient returns null', async () => {
    // Force the next getClient() call to return null (missing ANTHROPIC_API_KEY path)
    mockGetClient.mockReturnValueOnce(null);

    const { chatStream } = await import('./agent.stream.js');
    const events: StreamEvent[] = [];
    await chatStream(
      { engagementId: TEST_ENGAGEMENT_ID, userId: TEST_USER_ID, message: 'no client?' },
      (e) => events.push(e),
    );

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect((errorEvent as Extract<StreamEvent, { type: 'error' }>).message).toMatch(/AI agent unavailable|ANTHROPIC_API_KEY/i);
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('emits failed-phase + error + done when the tool loop throws', async () => {
    // First Claude call: throw a synthetic error
    mockCreate.mockRejectedValueOnce(new Error('synthetic Claude failure for test'));

    const { chatStream } = await import('./agent.stream.js');
    const events: StreamEvent[] = [];
    await chatStream(
      { engagementId: TEST_ENGAGEMENT_ID, userId: TEST_USER_ID, message: 'this will fail' },
      (e) => events.push(e),
    );

    // The Analyzing phase should be marked as done with detail: 'failed'
    const analyzingFailed = events.find(
      (e) => e.type === 'thinking_step' && e.step === 'Analyzing' && e.status === 'done' && e.detail === 'failed',
    );
    expect(analyzingFailed).toBeDefined();

    // The error event should follow
    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect((errorEvent as Extract<StreamEvent, { type: 'error' }>).message).toContain('synthetic Claude failure');

    // The terminal event must be done
    expect(events.at(-1)).toEqual({ type: 'done' });
  });
});

describe('POST /api/v1/assistant/chat — content negotiation', () => {
  it('returns SSE stream when Accept: text/event-stream', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'A streamed answer.' }],
    });

    const app = Fastify();
    await registerAssistantRoutes(app);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/chat',
      headers: { authorization: `Bearer ${token()}`, accept: 'text/event-stream' },
      payload: { engagementId: TEST_ENGAGEMENT_ID, message: 'hi' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const lines = res.body.split('\n').filter((l) => l.startsWith('data: '));
    const events = lines.map((l) => JSON.parse(l.slice(6)));

    expect(events.some((e) => e.type === 'thinking_step' && e.step === 'Assessing query')).toBe(true);
    expect(events.some((e) => e.type === 'token')).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'done' });

    await app.close();
  });

  it('falls back to JSON when Accept: application/json (existing behaviour)', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'A JSON answer.' }],
    });

    const app = Fastify();
    await registerAssistantRoutes(app);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/chat',
      headers: { authorization: `Bearer ${token()}`, accept: 'application/json' },
      payload: { engagementId: TEST_ENGAGEMENT_ID, message: 'hi' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const body = JSON.parse(res.body);
    expect(body.response).toContain('JSON answer');
    expect(body.evaluation).toBeDefined();

    await app.close();
  });
});
