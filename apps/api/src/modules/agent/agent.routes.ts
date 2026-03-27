import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import { chat, executeAction } from './agent.service.js';

// ============================================================
// Input Validation Schemas
// ============================================================

const ChatBodySchema = z.object({
  engagementId: z.string().min(1),
  message: z.string().min(1),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
});

const ActionBodySchema = z.object({
  engagementId: z.string().min(1),
  action: z.string().min(1),
  params: z.record(z.any()).default({}),
});

// ============================================================
// Route Registration
// ============================================================

export async function registerAgentRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // POST /api/v1/agent/chat — Chat with the ESG agent
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/chat',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = ChatBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const result = await chat({
          engagementId: parsed.data.engagementId,
          userId: request.user.userId,
          message: parsed.data.message,
          conversationHistory: parsed.data.conversationHistory,
        });

        return reply.code(200).send(result);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/action — Direct tool invocation
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/action',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = ActionBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const result = await executeAction({
          engagementId: parsed.data.engagementId,
          userId: request.user.userId,
          action: parsed.data.action,
          params: parsed.data.params,
        });

        return reply.code(200).send({ result });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );
}

// ============================================================
// Error Handler
// ============================================================

function handleError(
  err: unknown,
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }
) {
  if (err instanceof AppError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }

  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Validation failed',
      details: err.errors,
    });
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  return reply.code(500).send({ error: message });
}
