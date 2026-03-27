import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import { calculate } from './calculation.service.js';
import { CalculationRequestSchema } from '@merris/shared';

// ============================================================
// Route Registration
// ============================================================

export async function registerCalculationRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // POST /api/v1/calculate — Single calculation
  // ----------------------------------------------------------
  app.post(
    '/api/v1/calculate',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = CalculationRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const result = await calculate(parsed.data);
        return reply.code(200).send({ result });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    },
  );

  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/auto-calculate
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/auto-calculate',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const engagementId = request.params.id;

        // In a full implementation, this would:
        // 1. Load all data points for the engagement
        // 2. Determine which calculations can be run
        // 3. Execute them all and return results
        // For now, return a structured response indicating the endpoint is active
        return reply.code(200).send({
          engagementId,
          message: 'Auto-calculate endpoint active. Submit individual calculations via POST /api/v1/calculate.',
          availableMethods: CalculationRequestSchema.shape.method._def.values,
        });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    },
  );
}
