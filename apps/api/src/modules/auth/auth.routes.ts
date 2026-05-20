import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { UserRoleSchema } from '@merris/shared';
import {
  register,
  login,
  refreshToken,
  getMe,
  inviteUser,
  listUsers,
  changeUserRole,
  generateToken,
  getPermissionsForRole,
  AppError,
} from './auth.service.js';
import { UserModel, OrganizationModel } from './auth.model.js';
import { authenticate, authorize, requireRole } from './auth.middleware.js';

const AZURE_JWKS = createRemoteJWKSet(
  new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys')
);

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
  // POST /api/v1/auth/microsoft  — Office Add-in SSO
  // ----------------------------------------------------------
  app.post('/api/v1/auth/microsoft', async (request, reply) => {
    try {
      const { token } = request.body as { token: string };
      if (!token) return reply.code(400).send({ error: 'token required' });

      const audience = process.env['AZURE_AUDIENCE'];
      const { payload } = await jwtVerify(token, AZURE_JWKS, { audience });

      const email = (payload['preferred_username'] as string || payload['email'] as string || '').toLowerCase();
      const name = (payload['name'] as string) || email;

      if (!email) return reply.code(400).send({ error: 'No email in token' });

      let user = await UserModel.findOne({ email });
      if (!user) {
        let org = await OrganizationModel.findOne({});
        if (!org) {
          org = await OrganizationModel.create({
            name: 'Merris',
            type: 'consulting',
            plan: 'starter',
            settings: { language: 'en', timezone: 'UTC', currency: 'USD' },
            branding: {},
          });
        }
        const role = 'analyst' as const;
        user = await UserModel.create({
          email,
          name,
          password: Math.random().toString(36),
          orgId: org._id,
          role,
          permissions: getPermissionsForRole(role),
          provider: 'microsoft',
          preferences: { language: 'en', timezone: 'UTC', notifications: { email: true, inApp: true, teams: false } },
        });
      }

      const merrisToken = generateToken({
        userId: user._id.toString(),
        orgId: user.orgId.toString(),
        role: user.role as any,
        permissions: user.permissions,
      });

      return reply.code(200).send({ token: merrisToken, user: { email: user.email, name: user.name } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Token verification failed';
      return reply.code(401).send({ error: msg });
    }
  });

  // ----------------------------------------------------------
  // POST /api/v1/auth/microsoft/callback  — Web App OAuth code exchange
  // ----------------------------------------------------------
  app.post('/api/v1/auth/microsoft/callback', async (request, reply) => {
    try {
      const { code, redirectUri } = request.body as { code: string; redirectUri: string };
      if (!code) return reply.code(400).send({ error: 'code required' });

      // Exchange code for tokens at Azure AD
      const params = new URLSearchParams({
        client_id: process.env['AZURE_CLIENT_ID'] || '',
        client_secret: process.env['AZURE_CLIENT_SECRET'] || '',
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid profile email',
      });

      const tokenRes = await fetch(
        `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() }
      );

      const tokenData = await tokenRes.json() as any;
      if (!tokenRes.ok) return reply.code(401).send({ error: tokenData.error_description || 'Token exchange failed' });

      // Verify the id_token
      const { payload } = await jwtVerify(tokenData.id_token, AZURE_JWKS, {
        audience: process.env['AZURE_CLIENT_ID'],
      });

      const email = ((payload['preferred_username'] as string) || (payload['email'] as string) || '').toLowerCase();
      const name = (payload['name'] as string) || email;
      if (!email) return reply.code(400).send({ error: 'No email in token' });

      let user = await UserModel.findOne({ email });
      if (!user) {
        let org = await OrganizationModel.findOne({});
        if (!org) {
          org = await OrganizationModel.create({
            name: 'Merris', type: 'consulting', plan: 'starter',
            settings: { language: 'en', timezone: 'UTC', currency: 'USD' }, branding: {},
          });
        }
        const role = 'analyst' as const;
        user = await UserModel.create({
          email, name, password: Math.random().toString(36),
          orgId: org._id, role, permissions: getPermissionsForRole(role),
          provider: 'microsoft',
          preferences: { language: 'en', timezone: 'UTC', notifications: { email: true, inApp: true, teams: false } },
        });
      }

      const org = await OrganizationModel.findById(user.orgId);
      const merrisToken = generateToken({
        userId: user._id.toString(), orgId: user.orgId.toString(),
        role: user.role as any, permissions: user.permissions,
      });

      return reply.code(200).send({
        token: merrisToken,
        user: { id: user._id.toString(), email: user.email, name: user.name, orgId: user.orgId.toString(), role: user.role, preferences: user.preferences },
        organization: org ? { id: org._id.toString(), name: org.name, type: org.type, plan: org.plan } : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      return reply.code(401).send({ error: msg });
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
