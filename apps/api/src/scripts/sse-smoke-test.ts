/**
 * Standalone smoke test for /api/v1/assistant/chat SSE wire format.
 *
 * Purpose: verify Plan 1 Task 6 — that the new content-negotiated chat
 * endpoint emits the expected SSE event sequence over a real HTTP socket
 * (not via Fastify's `app.inject`, which buffers).
 *
 * Usage:
 *   pnpm --filter @merris/api exec tsx src/scripts/sse-smoke-test.ts
 *
 * The script:
 *   1. Sets ANTHROPIC_API_KEY to a dummy so the SDK constructs a client
 *   2. Intercepts global fetch for any anthropic.com call and returns a
 *      canned text-block response (no real API hit, no key needed)
 *   3. Starts an in-memory MongoDB so buildAgentContext doesn't crash
 *   4. Spins up a Fastify instance with ONLY the assistant routes
 *   5. Listens on http://127.0.0.1:3099
 *   6. Prints curl commands + a JWT for the operator to copy/paste
 *   7. Stays alive until SIGINT (Ctrl-C)
 *
 * This script is throwaway smoke-test infrastructure, NOT production code.
 */

import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const PORT = 3099;
const JWT_SECRET = 'sse-smoke-test-secret';

// ---- Fetch interceptor: stub Anthropic API responses ----
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes('api.anthropic.com')) {
    const fakeBody = {
      id: 'msg_smoke',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-20250514',
      content: [
        {
          type: 'text',
          text: 'Smoke-test answer: Scope 1 emissions for FY24 were 12,400 tCO2e.',
        },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 20 },
    };
    return new Response(JSON.stringify(fakeBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return realFetch(input, init);
}) as typeof fetch;

async function main() {
  process.env['JWT_SECRET'] = JWT_SECRET;
  process.env['ANTHROPIC_API_KEY'] = 'sk-ant-smoke-test-dummy';

  // 1. Start in-memory Mongo so buildAgentContext doesn't crash.
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  // 2. Import the route module AFTER env is set up.
  const { registerAssistantRoutes } = await import(
    '../services/assistant/assistant.router.js'
  );

  // 3. Build a minimal Fastify with just the assistant routes.
  const app = Fastify({ logger: false });
  await registerAssistantRoutes(app);

  // 4. Listen on a real socket.
  const url = await app.listen({ port: PORT, host: '127.0.0.1' });

  // 5. Create a token for the operator.
  const orgId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const engagementId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    {
      userId,
      orgId,
      role: 'manager',
      permissions: [{ resource: 'data', actions: ['read', 'write'] }],
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  /* eslint-disable no-console */
  console.log('');
  console.log('==============================================================');
  console.log('SSE smoke test running at:', url);
  console.log('==============================================================');
  console.log('');
  console.log('Streaming request (SSE):');
  console.log('');
  console.log(
    `  curl -N -X POST http://127.0.0.1:${PORT}/api/v1/assistant/chat \\\n` +
      `    -H "Content-Type: application/json" \\\n` +
      `    -H "Accept: text/event-stream" \\\n` +
      `    -H "Authorization: Bearer ${token}" \\\n` +
      `    -d '{"engagementId":"${engagementId}","message":"What are our Scope 1 emissions?"}'`,
  );
  console.log('');
  console.log('JSON fallback request (existing path):');
  console.log('');
  console.log(
    `  curl -X POST http://127.0.0.1:${PORT}/api/v1/assistant/chat \\\n` +
      `    -H "Content-Type: application/json" \\\n` +
      `    -H "Accept: application/json" \\\n` +
      `    -H "Authorization: Bearer ${token}" \\\n` +
      `    -d '{"engagementId":"${engagementId}","message":"hi"}'`,
  );
  console.log('');
  console.log('TOKEN:', token);
  console.log('');
  console.log('Press Ctrl-C to stop.');
  /* eslint-enable no-console */

  const shutdown = async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('SSE smoke test failed to start:', err);
  process.exit(1);
});
