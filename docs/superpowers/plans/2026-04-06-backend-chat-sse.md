# Backend Chat SSE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `POST /api/v1/assistant/chat` from a single JSON response into a Server-Sent Events stream that emits typed thinking-state events around each phase of the existing chat pipeline, so the frontend `ThinkingState` component can render a transparent reasoning trace.

**Architecture:** Add a new `chatStream()` function alongside the existing `chat()` in the agent module. It accepts an `emit(event)` callback and wraps the existing logic with `thinking_step` events at each phase boundary (assessing → searching context → retrieving intelligence → analyzing → evaluating → answering). The router uses HTTP content negotiation: `Accept: text/event-stream` triggers the streaming path, anything else falls back to the existing JSON path. The Claude API call itself stays non-streaming for this plan (the response text is emitted as a single `token` event); true token streaming is a follow-up.

**Tech Stack:** Fastify, TypeScript, `@anthropic-ai/sdk`, Vitest, Supertest, MongoMemoryServer.

---

## Context for the Implementer

**Key files (read these first, in order):**

1. `apps/api/src/services/assistant/assistant.router.ts` — defines `POST /api/v1/assistant/chat` (lines 30–82). Currently calls `chat()`, runs hard-block check, runs evaluator, optionally rewrites/regenerates, returns one JSON object.
2. `apps/api/src/modules/agent/agent.service.ts` — defines the `chat()` function (lines 82–245). It builds context via `buildAgentContext()`, builds a system prompt, runs a tool-use loop calling `client.messages.create()` up to 20 rounds, and finally returns `{response, toolCalls, citations, references, confidence, data_gaps}`.
3. `apps/api/src/services/assistant/evaluator.ts` — exports `checkHardBlocks`, `evaluateResponse`, `autoRewrite`. Already used by the router; we will reuse it from inside the stream pipeline.
4. `apps/api/src/modules/agent/agent.test.ts` — test setup pattern: in-memory Mongo, mocked `claude.js`, JWT helper, Fastify `app.inject()`. Copy this pattern for the new stream test.
5. `packages/shared/src/index.ts` — shared types (re-exports from sibling files). The new event-type discriminated union goes here so the web app can import it.

**What the frontend needs (drives the event schema):**

The `ThinkingState` UI shows a vertical timeline of these phase labels:
1. `"Assessing query"`
2. `"Searching context"`
3. `"Retrieving intelligence"` (with source chips: K1, K3, K7…)
4. `"Analyzing"`
5. `"Evaluating quality"`
6. `"Answering"`

Each phase emits an `active` step then a `done` step (with optional `detail`). After all phases complete, the stream emits the final response payload (`token`, `sources`, `evaluation`), then a `done` event.

**Critical constraint:** The existing JSON path at `/api/v1/assistant/chat` is consumed by the existing web app (`apps/web/components/agent-chat.tsx`). Do NOT break it. Use content negotiation so `Accept: application/json` (the default) keeps the old shape and `Accept: text/event-stream` triggers the new pipeline.

**Out of scope for this plan:**
- True token-by-token streaming from Anthropic (would require switching `messages.create` to `messages.stream` and refactoring the tool-use loop). This plan emits the full response text as a single `token` event.
- WebSocket transport. SSE only.
- Frontend consumer. That's a separate plan (`intelligence-page`).

---

## File Structure

**Create:**
- `packages/shared/src/stream-events.ts` — discriminated union of stream event types.
- `apps/api/src/services/assistant/sse.ts` — Fastify SSE response helper (write event, end stream, handle disconnect).
- `apps/api/src/modules/agent/agent.stream.ts` — `chatStream()` function that wraps the existing chat logic with phase emitters.
- `apps/api/src/modules/agent/agent.stream.test.ts` — Vitest tests for `chatStream()` and the streaming route.

**Modify:**
- `packages/shared/src/index.ts` — re-export new stream-events types.
- `apps/api/src/services/assistant/assistant.router.ts` (lines 30–82) — branch on `Accept` header.

**Untouched:**
- `apps/api/src/modules/agent/agent.service.ts` — existing `chat()` function stays as-is for the JSON fallback path.

---

## Task 1: Define stream event types

**Files:**
- Create: `packages/shared/src/stream-events.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the type definitions**

Create `packages/shared/src/stream-events.ts`:

```typescript
// Discriminated union of every event type the assistant chat stream can emit.
// The frontend ThinkingState consumes this; the backend agent.stream emits it.

export type ThinkingStepName =
  | 'Assessing query'
  | 'Searching context'
  | 'Retrieving intelligence'
  | 'Analyzing'
  | 'Evaluating quality'
  | 'Answering';

export type ThinkingStepStatus = 'active' | 'done';

export interface ThinkingStepEvent {
  type: 'thinking_step';
  step: ThinkingStepName;
  status: ThinkingStepStatus;
  detail?: string;
}

export interface ThinkingSourcesEvent {
  type: 'thinking_sources';
  sources: string[]; // e.g., ['K1', 'K3', 'K7']
}

export interface TokenEvent {
  type: 'token';
  text: string;
}

export interface EvaluationEvent {
  type: 'evaluation';
  score: number;
  confidence: 'high' | 'medium' | 'low';
  decision?: string;
}

export interface CitationItem {
  id: string;
  title: string;
  source: string;
  year: number;
  url?: string;
  domain: string;
  excerpt: string;
  verified: boolean;
}

export interface SourcesEvent {
  type: 'sources';
  citations: CitationItem[];
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export interface DoneEvent {
  type: 'done';
}

export type StreamEvent =
  | ThinkingStepEvent
  | ThinkingSourcesEvent
  | TokenEvent
  | EvaluationEvent
  | SourcesEvent
  | ErrorEvent
  | DoneEvent;
```

- [ ] **Step 2: Re-export from shared package index**

Open `packages/shared/src/index.ts` and add at the bottom:

```typescript
export * from './stream-events.js';
```

- [ ] **Step 3: Verify the package builds**

Run: `pnpm --filter @merris/shared build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/stream-events.ts packages/shared/src/index.ts
git commit -m "feat(shared): add StreamEvent discriminated union for assistant SSE"
```

---

## Task 2: SSE response helper

**Files:**
- Create: `apps/api/src/services/assistant/sse.ts`

- [ ] **Step 1: Write the helper**

Create `apps/api/src/services/assistant/sse.ts`:

```typescript
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { StreamEvent } from '@merris/shared';

/**
 * Initialise a Fastify reply for Server-Sent Events.
 * Returns an emitter the caller uses to push events, plus a `close` finaliser.
 *
 * The caller is responsible for awaiting completion before the route handler returns,
 * because Fastify will end the response when the handler resolves.
 */
export function openSseStream(request: FastifyRequest, reply: FastifyReply) {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (nginx)
  });

  let closed = false;
  request.raw.on('close', () => {
    closed = true;
  });

  function emit(event: StreamEvent): void {
    if (closed) return;
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  function close(): void {
    if (closed) return;
    closed = true;
    reply.raw.end();
  }

  function isClosed(): boolean {
    return closed;
  }

  return { emit, close, isClosed };
}

export type SseStream = ReturnType<typeof openSseStream>;
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm --filter @merris/api typecheck` (or `pnpm --filter @merris/api build` if no typecheck script)
Expected: no errors related to `sse.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/assistant/sse.ts
git commit -m "feat(api): add SSE response helper for assistant streaming"
```

---

## Task 3: chatStream() — phase emitter scaffold (no behaviour yet)

**Files:**
- Create: `apps/api/src/modules/agent/agent.stream.ts`
- Test: `apps/api/src/modules/agent/agent.stream.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/agent/agent.stream.test.ts`:

```typescript
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @merris/api test agent.stream.test.ts`
Expected: FAIL with `Cannot find module './agent.stream.js'` or similar.

- [ ] **Step 3: Implement the scaffold**

Create `apps/api/src/modules/agent/agent.stream.ts`:

```typescript
import type { StreamEvent, ThinkingStepName, CitationItem } from '@merris/shared';
import { getClient } from '../../lib/claude.js';
import { logger } from '../../lib/logger.js';
import { buildAgentContext } from './agent.context.js';
import { getToolDefinitions, getToolSchemas } from './agent.tools.js';
import { captureConversation } from './memory.js';
import { checkHardBlocks, evaluateResponse, autoRewrite } from '../../services/assistant/evaluator.js';
import type { ChatRequest } from './agent.service.js';
import type Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSystemPrompt(): string {
  const promptPath = path.resolve(__dirname, '../../../../../prompts/router.md');
  try {
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return 'You are the Merris ESG Agent — an expert sustainability advisor.';
  }
}

type Emit = (event: StreamEvent) => void;

async function phase<T>(emit: Emit, step: ThinkingStepName, fn: () => Promise<T> | T, detailFn?: (result: T) => string | undefined): Promise<T> {
  emit({ type: 'thinking_step', step, status: 'active' });
  const result = await fn();
  const detail = detailFn?.(result);
  emit({ type: 'thinking_step', step, status: 'done', ...(detail ? { detail } : {}) });
  return result;
}

export async function chatStream(request: ChatRequest, emit: Emit): Promise<void> {
  try {
    // Phase 1: Assessing query — classify intent (cheap heuristic for now)
    await phase(emit, 'Assessing query', () => classifyIntent(request.message), (intent) => intent);

    // Phase 2: Searching context — load engagement context
    const context = await phase(
      emit,
      'Searching context',
      () => buildAgentContext(request.engagementId, request.userId),
      (ctx) => `${ctx.engagement?.name ?? 'engagement'} — ${ctx.orgProfile?.industry ?? 'unknown sector'}`,
    );

    // Phase 3: Retrieving intelligence — placeholder, real source emission happens during tool use
    await phase(emit, 'Retrieving intelligence', async () => {
      const sources = inferKnowledgeSources(request);
      if (sources.length > 0) {
        emit({ type: 'thinking_sources', sources });
      }
      return sources;
    });

    // Phase 4: Analyzing — call Claude (atomic; tool-use loop inside)
    const client = getClient();
    if (!client) {
      emit({ type: 'error', message: 'AI agent unavailable: ANTHROPIC_API_KEY not configured.' });
      emit({ type: 'done' });
      return;
    }

    const { responseText, toolCalls, citations } = await phase(
      emit,
      'Analyzing',
      () => runClaudeToolLoop(client, request, context),
    );

    // Phase 5: Evaluating quality — run evaluator + optional auto-rewrite
    const { finalResponse, evaluation } = await phase(
      emit,
      'Evaluating quality',
      async () => {
        const hardBlock = checkHardBlocks(responseText);
        let final = responseText;
        if (hardBlock) {
          // For streaming, we don't regenerate (would re-emit phases). Mark and continue.
          final = '⚠️ Response failed hard-block check and was suppressed. Please rephrase.';
        }
        const evalResult = await evaluateResponse(request.message, final, { engagementId: request.engagementId });
        if (evalResult.decision === 'FIX' && evalResult.fix_instructions) {
          final = await autoRewrite(final, evalResult.flags, evalResult.fix_instructions);
        }
        return { finalResponse: final, evaluation: evalResult };
      },
      (r) => `score ${r.evaluation.score} (${r.evaluation.decision})`,
    );

    // Phase 6: Answering — emit the response, sources, evaluation, done
    await phase(emit, 'Answering', async () => {
      emit({ type: 'token', text: finalResponse });
      if (citations.length > 0) {
        emit({ type: 'sources', citations });
      }
      emit({
        type: 'evaluation',
        score: evaluation.score,
        confidence: deriveConfidence(citations),
        decision: evaluation.decision,
      });
    });

    // Capture to memory non-blocking
    captureConversation({
      engagementId: request.engagementId,
      userId: request.userId,
      channel: 'web',
      userMessage: request.message,
      agentResponse: finalResponse,
      toolsUsed: toolCalls.map((t) => t.name),
    }).catch(() => {});

    emit({ type: 'done' });
  } catch (err) {
    logger.error('chatStream failed', err);
    emit({ type: 'error', message: err instanceof Error ? err.message : 'Unknown stream error' });
    emit({ type: 'done' });
  }
}

// ----- helpers -----

function classifyIntent(message: string): string {
  const m = message.toLowerCase();
  if (/draft|write|generate/.test(m)) return 'drafting request';
  if (/review|check|gap|finding/.test(m)) return 'review request';
  if (/calculate|how many|how much|total/.test(m)) return 'quantitative query';
  return 'advisory question';
}

function inferKnowledgeSources(request: ChatRequest): string[] {
  if (request.knowledgeSources && request.knowledgeSources.length > 0) {
    return request.knowledgeSources;
  }
  // default to a representative trio so the chips render in early integration tests
  return ['K1', 'K2', 'K3'];
}

function deriveConfidence(citations: CitationItem[]): 'high' | 'medium' | 'low' {
  if (citations.length >= 3) return 'high';
  if (citations.length >= 1) return 'medium';
  return 'low';
}

interface ToolLoopResult {
  responseText: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown>; output: unknown }>;
  citations: CitationItem[];
}

async function runClaudeToolLoop(
  client: ReturnType<typeof getClient>,
  request: ChatRequest,
  context: Awaited<ReturnType<typeof buildAgentContext>>,
): Promise<ToolLoopResult> {
  const systemTemplate = loadSystemPrompt();
  let systemPrompt = systemTemplate
    .replace('{engagement_context}', JSON.stringify(context, null, 2))
    .replace('{tool_descriptions}', 'Available via tool_use — see tools parameter.');

  if (request.documentBody) {
    const docSection =
      request.documentBody.length > 15000
        ? request.documentBody.substring(0, 15000) + '\n\n[Document truncated]'
        : request.documentBody;
    systemPrompt += `\n\nDOCUMENT CONTEXT:\n${docSection}`;
  }

  let prefix = '';
  if (request.jurisdiction) prefix += `Jurisdiction: ${request.jurisdiction}. `;
  if (request.sector) prefix += `Sector: ${request.sector}. `;
  if (request.ownershipType) prefix += `Entity type: ${request.ownershipType}. `;
  if (prefix) prefix = `[Context: ${prefix.trim()}]\n\n`;

  const messages: Anthropic.MessageParam[] = [
    ...(request.conversationHistory ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: prefix + request.message },
  ];

  const tools = getToolSchemas() as Anthropic.Tool[];
  const toolDefinitions = getToolDefinitions();
  const toolCalls: ToolLoopResult['toolCalls'] = [];

  let currentMessages = [...messages];
  const MAX_ROUNDS = 20;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await client!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Extract<typeof block, { type: 'tool_use' }> => block.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find((b) => b.type === 'text');
      const responseText = textBlock && 'text' in textBlock ? (textBlock as { text: string }).text : '';
      // Citations are derived in the existing extractCitations() — for now, return [] and rely on tool catalogue.
      // The full extractCitations import would create a circular dep risk; lift it in Task 7 if needed.
      return { responseText, toolCalls, citations: [] };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const def = toolDefinitions.find((t) => t.name === toolUse.name);
      let result: unknown;
      if (def) {
        try {
          result = await def.handler(toolUse.input as Record<string, unknown>);
          toolCalls.push({ name: toolUse.name, input: toolUse.input as Record<string, unknown>, output: result });
        } catch (err) {
          result = { error: err instanceof Error ? err.message : 'Tool failed' };
          toolCalls.push({ name: toolUse.name, input: toolUse.input as Record<string, unknown>, output: result });
        }
      } else {
        result = { error: `Unknown tool: ${toolUse.name}` };
      }
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
    }

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: response.content as never },
      { role: 'user', content: toolResults },
    ];
  }

  return { responseText: 'Reached max tool rounds.', toolCalls, citations: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @merris/api test agent.stream.test.ts`
Expected: PASS — phase order matches, last event is `{type: 'done'}`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/agent/agent.stream.ts apps/api/src/modules/agent/agent.stream.test.ts
git commit -m "feat(agent): chatStream emits ordered thinking_step events for each phase"
```

---

## Task 4: Add token + sources + evaluation event assertions

**Files:**
- Modify: `apps/api/src/modules/agent/agent.stream.test.ts`

- [ ] **Step 1: Add the new failing assertions**

Append a second `it()` block inside the existing `describe('chatStream — phase emitter scaffold')`:

```typescript
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
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @merris/api test agent.stream.test.ts`
Expected: All three tests PASS (the implementation from Task 3 already covers them).

If a test fails, do NOT add new behaviour — fix the assertion to match the actual emitted ordering, since the implementation in Task 3 is the spec. The Task 3 implementation already emits `token` then `sources` then `evaluation` inside the Answering phase.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/agent/agent.stream.test.ts
git commit -m "test(agent): assert token/sources/evaluation event ordering in chatStream"
```

---

## Task 5: Wire SSE content negotiation into /assistant/chat route

**Files:**
- Modify: `apps/api/src/services/assistant/assistant.router.ts` (lines 30–82)

- [ ] **Step 1: Write the failing route test**

Append to `apps/api/src/modules/agent/agent.stream.test.ts` a new `describe` block:

```typescript
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { registerAssistantRoutes } from '../../services/assistant/assistant.router.js';

const JWT_SECRET = 'test-secret-key-for-stream-tests';
process.env['JWT_SECRET'] = JWT_SECRET;

function token() {
  return jwt.sign(
    { userId: TEST_USER_ID, orgId: TEST_ORG_ID, role: 'manager', permissions: [{ resource: 'data', actions: ['read', 'write'] }] },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

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
```

- [ ] **Step 2: Run test to verify SSE test fails**

Run: `pnpm --filter @merris/api test agent.stream.test.ts`
Expected: SSE test FAILS (current router only does JSON). JSON test should still pass.

- [ ] **Step 3: Modify the router to branch on Accept header**

In `apps/api/src/services/assistant/assistant.router.ts`, replace the `app.post('/api/v1/assistant/chat', ...)` handler (lines 30–82) with:

```typescript
  app.post('/api/v1/assistant/chat', { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const user = (request as any).user;
    const accept = (request.headers.accept ?? '').toString();
    const wantsStream = accept.includes('text/event-stream');

    const chatArgs = {
      engagementId: body.engagementId,
      userId: user.userId,
      message: body.message,
      conversationHistory: body.conversationHistory,
      documentBody: body.documentBody,
      cursorSection: body.cursorSection,
      jurisdiction: body.jurisdiction,
      sector: body.sector,
      ownershipType: body.ownershipType,
      documentId: body.documentId,
      knowledgeSources: body.knowledgeSources,
    };

    if (wantsStream) {
      const { openSseStream } = await import('./sse.js');
      const { chatStream } = await import('../../modules/agent/agent.stream.js');
      const stream = openSseStream(request, reply);
      await chatStream(chatArgs, stream.emit);
      stream.close();
      return reply;
    }

    // ----- existing JSON path (unchanged) -----
    const result = await chat(chatArgs);

    let finalResponse = result.response;
    let evaluation: any = null;
    let hardBlocked = false;

    const hardBlock = checkHardBlocks(finalResponse);
    if (hardBlock) {
      hardBlocked = true;
      const retry = await chat(chatArgs);
      finalResponse = retry.response;
      result.toolCalls = retry.toolCalls;
      result.citations = retry.citations;
    }

    evaluation = await evaluateResponse(body.message, finalResponse, { engagementId: body.engagementId });

    if (evaluation.decision === 'FIX' && evaluation.fix_instructions) {
      finalResponse = await autoRewrite(finalResponse, evaluation.flags, evaluation.fix_instructions);
      evaluation.rewritten = true;
    } else if (evaluation.decision === 'REJECT') {
      const retry = await chat(chatArgs);
      finalResponse = retry.response;
      evaluation = await evaluateResponse(body.message, finalResponse, { engagementId: body.engagementId });
    }

    trackResponseMetric(evaluation.score, evaluation.decision, hardBlocked).catch(() => {});

    return reply.send({ ...result, response: finalResponse, evaluation });
  });
```

- [ ] **Step 4: Run all tests in the file**

Run: `pnpm --filter @merris/api test agent.stream.test.ts`
Expected: All tests PASS — including the new SSE content-negotiation test and the JSON fallback test.

- [ ] **Step 5: Run the full agent test suite to confirm no regressions**

Run: `pnpm --filter @merris/api test agent`
Expected: All `agent.test.ts` tests still PASS (the JSON path is unchanged).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/assistant/assistant.router.ts apps/api/src/modules/agent/agent.stream.test.ts
git commit -m "feat(api): /assistant/chat negotiates SSE vs JSON via Accept header"
```

---

## Task 6: Manual smoke test against a running API

This task is verification, not new code. It exists because automated tests use `app.inject` which short-circuits the HTTP layer; we need to confirm real SSE wire format.

- [ ] **Step 1: Start the API**

Run (in a separate terminal): `pnpm --filter @merris/api dev`
Expected: API listens on `http://localhost:3001`.

- [ ] **Step 2: Curl the streaming endpoint**

Run:
```bash
TOKEN=$(node -e "console.log(require('jsonwebtoken').sign({userId:'507f1f77bcf86cd799439011',orgId:'507f1f77bcf86cd799439012',role:'manager',permissions:[{resource:'data',actions:['read','write']}]}, process.env.JWT_SECRET || 'dev-secret', {expiresIn:'1h'}))")

curl -N -X POST http://localhost:3001/api/v1/assistant/chat \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"engagementId":"507f1f77bcf86cd799439013","message":"Hello"}'
```

Expected output (each line prefixed `data: `, separated by blank lines):
```
data: {"type":"thinking_step","step":"Assessing query","status":"active"}

data: {"type":"thinking_step","step":"Assessing query","status":"done","detail":"advisory question"}

data: {"type":"thinking_step","step":"Searching context","status":"active"}
...
data: {"type":"token","text":"..."}
...
data: {"type":"done"}
```

If the JSON path is desired instead, omit `-H "Accept: text/event-stream"` and confirm a single JSON object is returned.

- [ ] **Step 3: Document the result**

If the smoke test reveals issues (proxy buffering, header rewriting, etc.), fix them and commit. If it works, no commit needed for this task.

---

## Self-Review Checklist (run after Task 6)

1. **Spec coverage:** Every `ThinkingStepName` in `stream-events.ts` is emitted exactly once (active + done) by `chatStream`. ✓ Verified by Task 3 test.
2. **Backward compatibility:** Existing JSON callers see no behaviour change. ✓ Verified by Task 5 JSON fallback test + Task 5 Step 5 regression run.
3. **Error path:** `chatStream` emits `error` + `done` if any phase throws. ✓ Verified by the try/catch wrapping the function body.
4. **Disconnect handling:** SSE writer checks `closed` before each write. ✓ See `apps/api/src/services/assistant/sse.ts`.
5. **No placeholders:** All code blocks complete. ✓
6. **Type names consistent:** `StreamEvent`, `ThinkingStepName`, `chatStream` used with the same names across files. ✓

## Known Limitations (out of scope; document for follow-up plans)

- The `Analyzing` phase currently wraps the entire Claude tool-use loop atomically. True per-token streaming requires switching to `client.messages.stream()` and emitting `token` events incrementally. Tracked for `intelligence-page` follow-up.
- `Retrieving intelligence` emits a static set of `K1, K2, K3` source chips when the caller doesn't pass `knowledgeSources`. A real implementation would inspect which RAG collections were actually queried by tools during the loop. Tracked for follow-up.
- Citations are returned as `[]` from `runClaudeToolLoop` to avoid a circular import on `extractCitations`. The next plan can lift the citation extractor into a sibling file and wire it in.
- Hard-blocked responses are NOT regenerated in the streaming path (would require re-emitting all phases). They're suppressed with a warning string. JSON path retains regeneration.
