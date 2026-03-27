import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import {
  initializeWorkflow,
  getWorkflow,
  advanceWorkflow,
  returnToStage,
  getTransitionHistory,
} from './workflow.service.js';

// ============================================================
// Input Validation Schemas
// ============================================================

const AdvanceBodySchema = z.object({
  approvalNotes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

const ReturnBodySchema = z.object({
  returnToStage: z.string().min(1),
  reason: z.string().min(1),
});

// ============================================================
// Route Registration
// ============================================================

export async function registerWorkflowRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/workflow/initialize
  // ----------------------------------------------------------
  app.post(
    '/api/v1/engagements/:id/workflow/initialize',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id: engagementId } = request.params as { id: string };
        const workflow = await initializeWorkflow(engagementId);

        return reply.code(201).send(workflow);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/workflow
  // ----------------------------------------------------------
  app.get(
    '/api/v1/engagements/:id/workflow',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id: engagementId } = request.params as { id: string };
        const workflow = await getWorkflow(engagementId);

        return reply.code(200).send(workflow);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // PUT /api/v1/engagements/:id/workflow/advance
  // ----------------------------------------------------------
  app.put(
    '/api/v1/engagements/:id/workflow/advance',
    {
      preHandler: [
        authenticate,
        requireRole(['owner', 'admin', 'manager']),
      ],
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id: engagementId } = request.params as { id: string };
        const parsed = AdvanceBodySchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const workflow = await advanceWorkflow(engagementId, {
          userId: request.user.userId,
          approvalNotes: parsed.data.approvalNotes,
          attachments: parsed.data.attachments,
        });

        return reply.code(200).send(workflow);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/workflow/return
  // ----------------------------------------------------------
  app.post(
    '/api/v1/engagements/:id/workflow/return',
    {
      preHandler: [
        authenticate,
        requireRole(['owner', 'admin', 'manager']),
      ],
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id: engagementId } = request.params as { id: string };
        const parsed = ReturnBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const workflow = await returnToStage(engagementId, {
          userId: request.user.userId,
          returnToStage: parsed.data.returnToStage,
          reason: parsed.data.reason,
        });

        return reply.code(200).send(workflow);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/workflow/history
  // ----------------------------------------------------------
  app.get(
    '/api/v1/engagements/:id/workflow/history',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id: engagementId } = request.params as { id: string };
        const history = await getTransitionHistory(engagementId);

        return reply.code(200).send(history);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );
}

// ============================================================
// Error Handler
// ============================================================

function handleError(
  err: unknown,
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
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
