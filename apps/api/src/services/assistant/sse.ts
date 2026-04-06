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

  // Prime the connection so proxies (Cloudflare, AWS ALB) see traffic before the
  // first real event. SSE comment lines start with `:` and are ignored by clients.
  reply.raw.write(':\n\n');

  let closed = false;
  request.raw.on('close', () => {
    closed = true;
  });

  // Backpressure intentionally ignored: chat streams emit O(10s) of small frames.
  // If event volume grows, switch to drain-aware writes.
  function emit(event: StreamEvent): void {
    if (closed) return;
    try {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // Socket destroyed mid-stream (client disconnect race). Stop writing.
      closed = true;
    }
  }

  function close(): void {
    if (closed) return;
    closed = true;
    try {
      reply.raw.end();
    } catch {
      // Already destroyed; nothing to clean up.
    }
  }

  function isClosed(): boolean {
    return closed;
  }

  return { emit, close, isClosed };
}

export type SseStream = ReturnType<typeof openSseStream>;
