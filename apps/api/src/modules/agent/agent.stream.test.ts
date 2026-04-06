import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { StreamEvent } from '@merris/shared';

vi.mock('../../lib/claude.js', () => {
  const mockCreate = vi.fn();
  return {
    getClient: vi.fn(() => ({ messages: { create: mockCreate } })),
    sendMessage: vi.fn(),
    __mockCreate: mockCreate,
  };
});

const claudeMock = await import('../../lib/claude.js');
const mockCreate = (claudeMock as unknown as { __mockCreate: ReturnType<typeof vi.fn> }).__mockCreate;

const TEST_ORG_ID = new mongoose.Types.ObjectId().toString();
const TEST_USER_ID = new mongoose.Types.ObjectId().toString();
const TEST_ENGAGEMENT_ID = new mongoose.Types.ObjectId().toString();

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
});
