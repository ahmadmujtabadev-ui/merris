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
