import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import { runQA, storeQAResult, getQAHistory } from './qa.service.js';

// ============================================================
// Route Registration
// ============================================================

export async function registerQARoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/qa/run
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/qa/run',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const engagementId = request.params.id;
        const report = await runQA(engagementId);

        // Store in history
        storeQAResult(report);

        return reply.code(200).send(report);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    },
  );

  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/qa/history
  // ----------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/qa/history',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const engagementId = request.params.id;
        const history = getQAHistory(engagementId);

        return reply.code(200).send({ history });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    },
  );
}
