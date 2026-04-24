import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserRoleSchema } from '@merris/shared';
import {
  register,
  login,
  refreshToken,
  getMe,
  inviteUser,
  listUsers,
  changeUserRole,
  AppError,
} from './auth.service.js';
import { authenticate, authorize, requireRole } from './auth.middleware.js';

// ============================================================
// Input Validation Schemas
// ============================================================

const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  orgName: z.string().min(1),
  orgType: z.enum(['consulting', 'corporate']),
});

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const InviteBodySchema = z.object({
  email: z.string().email(),
  role: UserRoleSchema,
  teamId: z.string().optional(),
});

const ChangeRoleBodySchema = z.object({
  role: UserRoleSchema,
});

// ============================================================
// Route Registration
// ============================================================

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // POST /api/v1/auth/register
  // ----------------------------------------------------------
  app.post('/api/v1/auth/register', async (request, reply) => {
    try {
      const body = RegisterBodySchema.parse(request.body);
      const result = await register(body as any);
      return reply.code(201).send(result);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ----------------------------------------------------------
  // POST /api/v1/auth/login
  // ----------------------------------------------------------
  app.post('/api/v1/auth/login', async (request, reply) => {
    try {
      const body = LoginBodySchema.parse(request.body);
      const result = await login(body as any);
      return reply.code(200).send(result);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ----------------------------------------------------------
  // POST /api/v1/auth/refresh
  // ----------------------------------------------------------
  app.post('/api/v1/auth/refresh', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }
      const token = refreshToken(request.user);
      return reply.code(200).send({ token });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ----------------------------------------------------------
  // GET /api/v1/auth/me
  // ----------------------------------------------------------
  app.get('/api/v1/auth/me', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }
      const result = await getMe(request.user.userId);
      return reply.code(200).send(result);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ----------------------------------------------------------
  // POST /api/v1/users/invite
  // ----------------------------------------------------------
  app.post('/api/v1/users/invite', {
    preHandler: [authenticate, requireRole(['owner', 'admin'])],
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }
      const body = InviteBodySchema.parse(request.body);
      const result = await inviteUser({
        email: body.email,
        role: body.role,
        teamId: body.teamId,
        invitedByUserId: request.user.userId,
        orgId: request.user.orgId,
      });
      return reply.code(201).send(result);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ----------------------------------------------------------
  // GET /api/v1/users
  // ----------------------------------------------------------
  app.get('/api/v1/users', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }
      const users = await listUsers(request.user.orgId, request.user);
      return reply.code(200).send({ users });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ----------------------------------------------------------
  // PUT /api/v1/users/:id/role
  // ----------------------------------------------------------
  app.put<{ Params: { id: string } }>('/api/v1/users/:id/role', {
    preHandler: [authenticate, requireRole(['owner'])],
  }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }
      const body = ChangeRoleBodySchema.parse(request.body);
      const user = await changeUserRole(request.params.id, body.role, request.user);
      return reply.code(200).send({ user });
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

  // Unknown error
  const message = err instanceof Error ? err.message : 'Internal server error';
  return reply.code(500).send({ error: message });
}
