import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import {
  CreateDataPointSchema,
  UpdateDataPointSchema,
  EstimateDataPointSchema,
  AssignGapsSchema,
  listDataPoints,
  createDataPoint,
  updateDataPoint,
  confirmDataPoint,
  estimateDataPoint,
  getGapRegister,
  assignGaps,
  getCompleteness,
} from './data-collection.service.js';

// ============================================================
// Route Registration
// ============================================================

export async function registerDataCollectionRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/data-points
  // ----------------------------------------------------------
  app.get<{
    Params: { id: string };
    Querystring: { status?: string; framework?: string; confidence?: string; sortBy?: string };
  }>(
    '/api/v1/engagements/:id/data-points',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const engagementId = request.params.id;
        const { status, framework, confidence, sortBy } = request.query as Record<string, string>;

        const dataPoints = await listDataPoints(engagementId, {
          status,
          framework,
          confidence,
          sortBy,
        });

        return reply.code(200).send({ dataPoints });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/data-points
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/data-points',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const engagementId = request.params.id;
        const parsed = CreateDataPointSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const { dataPoint, warnings } = await createDataPoint(
          engagementId,
          parsed.data,
          request.user.userId
        );

        return reply.code(201).send({ dataPoint, warnings });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // ----------------------------------------------------------
  // PUT /api/v1/data-points/:id
  // ----------------------------------------------------------
  app.put<{ Params: { id: string } }>(
    '/api/v1/data-points/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const dataPointId = request.params.id;
        const parsed = UpdateDataPointSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const dataPoint = await updateDataPoint(
          dataPointId,
          parsed.data,
          request.user.userId
        );

        return reply.code(200).send({ dataPoint });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/data-points/:id/confirm
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/api/v1/data-points/:id/confirm',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const dataPoint = await confirmDataPoint(
          request.params.id,
          request.user.userId
        );

        return reply.code(200).send({ dataPoint });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/data-points/:id/estimate
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/api/v1/data-points/:id/estimate',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = EstimateDataPointSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const dataPoint = await estimateDataPoint(
          request.params.id,
          parsed.data,
          request.user.userId
        );

        return reply.code(200).send({ dataPoint });
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/gap-register
  // ----------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/gap-register',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const gapRegister = await getGapRegister(request.params.id);
        return reply.code(200).send(gapRegister);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/gap-register/assign
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/gap-register/assign',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = AssignGapsSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const result = await assignGaps(
          request.params.id,
          parsed.data,
          request.user.userId
        );

        return reply.code(200).send(result);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/completeness
  // ----------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/completeness',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const completeness = await getCompleteness(request.params.id);
        return reply.code(200).send(completeness);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}
