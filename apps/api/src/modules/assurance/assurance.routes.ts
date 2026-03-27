import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import { generateAssurancePack, getDisclosureEvidence } from './assurance.service.js';

// ============================================================
// Route Registration
// ============================================================

export async function registerAssuranceRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/assurance/generate
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/assurance/generate',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const engagementId = request.params.id;
        const pack = await generateAssurancePack(engagementId);

        return reply.code(200).send(pack);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    },
  );

  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/assurance/evidence/:disclosureId
  // ----------------------------------------------------------
  app.get<{ Params: { id: string; disclosureId: string } }>(
    '/api/v1/engagements/:id/assurance/evidence/:disclosureId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id: engagementId, disclosureId } = request.params;
        const evidence = await getDisclosureEvidence(engagementId, disclosureId);

        if (!evidence) {
          return reply.code(404).send({
            error: `No evidence found for disclosure ${disclosureId}`,
          });
        }

        return reply.code(200).send(evidence);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    },
  );
}
