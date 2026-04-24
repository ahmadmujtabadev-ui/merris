import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OrgProfileSchema } from '@merris/shared';
import { authenticate, requireRole } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import {
  createOrUpdateProfile,
  getProfile,
  getFrameworkRecommendations,
  saveFrameworkSelections,
} from './organization.service.js';

// ============================================================
// Input Validation Schemas
// ============================================================

const ProfileBodySchema = OrgProfileSchema.omit({ orgId: true }).extend({
  hasEuOperations: z.boolean().optional(),
});

const FrameworkSelectionsBodySchema = z.object({
  selected: z.array(z.string()),
  deselected: z.array(z.string()),
});

// ============================================================
// Route Registration
// ============================================================

export async function registerOrganizationRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // POST /api/v1/organizations/:id/profile
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>('/api/v1/organizations/:id/profile', {
    preHandler: [authenticate, requireRole(['owner', 'admin'])],
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      // Verify user belongs to this org
      if (request.user.orgId !== request.params.id) {
        return reply.code(403).send({ error: 'Not authorized for this organization' });
      }

      const body = ProfileBodySchema.parse(request.body);
      const result = await createOrUpdateProfile(request.params.id, body as any);

      return reply.code(200).send({
        profile: result.profile,
        recommendations: result.recommendations,
      });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ----------------------------------------------------------
  // GET /api/v1/organizations/:id/profile
  // ----------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/v1/organizations/:id/profile', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      // Verify user belongs to this org
      if (request.user.orgId !== request.params.id) {
        return reply.code(403).send({ error: 'Not authorized for this organization' });
      }

      const result = await getProfile(request.params.id);
      return reply.code(200).send(result);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ----------------------------------------------------------
  // GET /api/v1/organizations/:id/framework-recommendations
  // ----------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/v1/organizations/:id/framework-recommendations', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      if (request.user.orgId !== request.params.id) {
        return reply.code(403).send({ error: 'Not authorized for this organization' });
      }

      const result = await getFrameworkRecommendations(request.params.id);
      return reply.code(200).send(result);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ----------------------------------------------------------
  // POST /api/v1/organizations/:id/framework-selections
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>('/api/v1/organizations/:id/framework-selections', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      if (request.user.orgId !== request.params.id) {
        return reply.code(403).send({ error: 'Not authorized for this organization' });
      }

      const body = FrameworkSelectionsBodySchema.parse(request.body);
      const result = await saveFrameworkSelections(request.params.id, body as any);

      return reply.code(200).send(result);
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

// ============================================================
// Error Handler
// ============================================================

function handleError(err: unknown, reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }) {
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
