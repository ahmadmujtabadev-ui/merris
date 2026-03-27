import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import {
  generatePresentation,
  listPresentations,
  getPresentation,
  downloadPresentation,
} from './presentation.service.js';

// ============================================================
// Input Validation Schemas
// ============================================================

const GeneratePresentationBodySchema = z.object({
  type: z.enum([
    'board_pack',
    'investor_presentation',
    'client_deliverable',
    'strategy_deck',
    'training_deck',
    'due_diligence_summary',
    'regulatory_submission',
  ]),
  branding: z
    .object({
      logo: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      fontFamily: z.string().optional(),
    })
    .optional(),
  language: z.enum(['en', 'ar']).optional(),
});

// ============================================================
// Route Registration
// ============================================================

export async function registerPresentationRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/presentations/generate
  // ----------------------------------------------------------
  app.post(
    '/api/v1/engagements/:id/presentations/generate',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id: engagementId } = request.params as { id: string };
        const parsed = GeneratePresentationBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const presentation = await generatePresentation(engagementId, parsed.data);

        return reply.code(201).send(presentation);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/presentations — List
  // ----------------------------------------------------------
  app.get(
    '/api/v1/engagements/:id/presentations',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id: engagementId } = request.params as { id: string };
        const presentations = await listPresentations(engagementId);

        return reply.code(200).send(presentations);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // GET /api/v1/presentations/:id — Detail
  // ----------------------------------------------------------
  app.get(
    '/api/v1/presentations/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id } = request.params as { id: string };
        const presentation = await getPresentation(id);

        return reply.code(200).send(presentation);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // GET /api/v1/presentations/:id/download — Download PPTX
  // ----------------------------------------------------------
  app.get(
    '/api/v1/presentations/:id/download',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id } = request.params as { id: string };
        const { buffer, filename } = await downloadPresentation(id);

        return reply
          .code(200)
          .header('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(buffer);
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
