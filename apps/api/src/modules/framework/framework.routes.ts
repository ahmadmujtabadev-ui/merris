import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import {
  listFrameworks,
  getFrameworkByCode,
  getDisclosuresForFramework,
  getDisclosureById,
  getCrossReferences,
  buildDataAgenda,
  queryEmissionFactors,
  getGridEmissionFactor,
} from './framework.service.js';

// ============================================================
// Route Registration
// ============================================================

export async function registerFrameworkRoutes(
  app: FastifyInstance
): Promise<void> {
  // ----------------------------------------------------------
  // GET /api/v1/frameworks
  // ----------------------------------------------------------
  app.get<{
    Querystring: { type?: string; region?: string };
  }>(
    '/api/v1/frameworks',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { type, region } = request.query;
        const frameworks = await listFrameworks({ type, region });
        return reply.code(200).send({ frameworks });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/frameworks/:code
  // ----------------------------------------------------------
  app.get<{
    Params: { code: string };
  }>(
    '/api/v1/frameworks/:code',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const framework = await getFrameworkByCode(request.params.code);
        return reply.code(200).send({ framework });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/frameworks/:code/disclosures
  // ----------------------------------------------------------
  app.get<{
    Params: { code: string };
    Querystring: { topic?: string; dataType?: string };
  }>(
    '/api/v1/frameworks/:code/disclosures',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { topic, dataType } = request.query;
        const disclosures = await getDisclosuresForFramework(
          request.params.code,
          { topic, dataType }
        );
        return reply.code(200).send({ disclosures });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/disclosures/:id
  // ----------------------------------------------------------
  app.get<{
    Params: { id: string };
  }>(
    '/api/v1/disclosures/:id',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const disclosure = await getDisclosureById(request.params.id);
        return reply.code(200).send({ disclosure });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/disclosures/:id/cross-references
  // ----------------------------------------------------------
  app.get<{
    Params: { id: string };
  }>(
    '/api/v1/disclosures/:id/cross-references',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const result = await getCrossReferences(request.params.id);
        return reply.code(200).send(result);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/data-agenda
  // ----------------------------------------------------------
  app.get<{
    Params: { id: string };
    Querystring: { frameworks?: string; satisfied?: string };
  }>(
    '/api/v1/engagements/:id/data-agenda',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        // frameworks passed as comma-separated codes in query
        const { frameworks, satisfied } = request.query;

        if (!frameworks) {
          return reply.code(400).send({
            error:
              'frameworks query parameter is required (comma-separated codes)',
          });
        }

        const frameworkCodes = frameworks.split(',').map((c) => c.trim());
        const satisfiedMetrics = satisfied
          ? satisfied.split(',').map((m) => m.trim())
          : [];

        const agenda = await buildDataAgenda(frameworkCodes, satisfiedMetrics);
        return reply.code(200).send({ engagementId: request.params.id, agenda });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/emission-factors
  // ----------------------------------------------------------
  app.get<{
    Querystring: {
      country?: string;
      source?: string;
      year?: string;
      scope?: string;
      category?: string;
      fuelType?: string;
    };
  }>(
    '/api/v1/emission-factors',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { country, source, year, scope, category, fuelType } =
          request.query;
        const factors = await queryEmissionFactors({
          country,
          source,
          year: year ? parseInt(year, 10) : undefined,
          scope: scope ? parseInt(scope, 10) : undefined,
          category,
          fuelType,
        });
        return reply.code(200).send({ factors });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/emission-factors/:country/grid
  // ----------------------------------------------------------
  app.get<{
    Params: { country: string };
  }>(
    '/api/v1/emission-factors/:country/grid',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const factor = await getGridEmissionFactor(request.params.country);
        return reply.code(200).send({ factor });
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
  reply: {
    code: (statusCode: number) => { send: (payload: unknown) => unknown };
  }
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

  const message =
    err instanceof Error ? err.message : 'Internal server error';
  return reply.code(500).send({ error: message });
}
