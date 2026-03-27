import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { registerAuthRoutes } from './auth.routes.js';
import { UserModel, OrganizationModel, TeamModel } from './auth.model.js';
import { getPermissionsForRole, hasPermission, verifyToken } from './auth.service.js';
import type { TokenPayload } from './auth.service.js';

const JWT_SECRET = 'test-secret-key-for-auth-tests';
process.env['JWT_SECRET'] = JWT_SECRET;

let mongoServer: MongoMemoryServer;
let app: FastifyInstance;

// ============================================================
// Setup / Teardown
// ============================================================

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = Fastify();
  await registerAuthRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await UserModel.deleteMany({});
  await OrganizationModel.deleteMany({});
  await TeamModel.deleteMany({});
});

// ============================================================
// Helper
// ============================================================

async function registerUser(overrides: Record<string, string> = {}) {
  const payload = {
    email: 'test@example.com',
    password: 'Password123!',
    name: 'Test User',
    orgName: 'Test Org',
    orgType: 'consulting',
    ...overrides,
  };

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload,
  });
  return { res, payload };
}

// ============================================================
// Tests: POST /api/v1/auth/register
// ============================================================

describe('POST /api/v1/auth/register', () => {
  it('creates organization + user and returns valid token', async () => {
    const { res } = await registerUser();
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(201);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe('test@example.com');
    expect(body.user.name).toBe('Test User');
    expect(body.user.role).toBe('owner');
    expect(body.token).toBeDefined();
    expect(body.organization).toBeDefined();
    expect(body.organization.name).toBe('Test Org');
    expect(body.organization.type).toBe('consulting');

    // Verify token is valid
    const decoded = verifyToken(body.token);
    expect(decoded.userId).toBe(body.user.id);
    expect(decoded.orgId).toBe(body.organization.id);
    expect(decoded.role).toBe('owner');
  });

  it('returns 409 for duplicate email', async () => {
    await registerUser();
    const { res } = await registerUser();
    expect(res.statusCode).toBe(409);
  });

  it('returns 400 for invalid email', async () => {
    const { res } = await registerUser({ email: 'not-an-email' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const { res } = await registerUser({ password: 'short' });
    expect(res.statusCode).toBe(400);
  });
});

// ============================================================
// Tests: POST /api/v1/auth/login
// ============================================================

describe('POST /api/v1/auth/login', () => {
  it('returns token with correct credentials', async () => {
    await registerUser();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'test@example.com', password: 'Password123!' },
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('test@example.com');
  });

  it('returns 401 with wrong password', async () => {
    await registerUser();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'test@example.com', password: 'WrongPassword!' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with non-existent email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nobody@example.com', password: 'Password123!' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// Tests: POST /api/v1/auth/refresh
// ============================================================

describe('POST /api/v1/auth/refresh', () => {
  it('returns a new token when authenticated', async () => {
    const { res: regRes } = await registerUser();
    const { token } = JSON.parse(regRes.body);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    // Verify the new token is valid and carries the same payload
    const decoded = verifyToken(body.token);
    expect(decoded.userId).toBeDefined();
    expect(decoded.role).toBe('owner');
  });
});

// ============================================================
// Tests: GET /api/v1/auth/me
// ============================================================

describe('GET /api/v1/auth/me', () => {
  it('returns current user with org details', async () => {
    const { res: regRes } = await registerUser();
    const { token } = JSON.parse(regRes.body);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.user.email).toBe('test@example.com');
    expect(body.organization).toBeDefined();
    expect(body.organization.name).toBe('Test Org');
    expect(body.teams).toBeDefined();
    expect(Array.isArray(body.teams)).toBe(true);
  });
});

// ============================================================
// Tests: Protected routes without token
// ============================================================

describe('Protected route without token', () => {
  it('returns 401 when no token provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with expired token', async () => {
    // Create a token that is already expired
    const expiredToken = jwt.sign(
      { userId: 'fake', orgId: 'fake', role: 'owner', permissions: [] },
      JWT_SECRET,
      { expiresIn: '0s' }
    );

    // Small delay to ensure expiry
    await new Promise((resolve) => setTimeout(resolve, 50));

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: 'Bearer invalid-token-string' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ============================================================
// Tests: RBAC / authorize middleware
// ============================================================

describe('authorize middleware blocks insufficient permissions', () => {
  it('analyst cannot access users/invite endpoint', async () => {
    // Register owner and get token
    const { res: regRes } = await registerUser();
    const { token: ownerToken, user: ownerUser } = JSON.parse(regRes.body);

    // Invite an analyst
    const inviteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/invite',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: 'analyst@example.com', role: 'analyst' },
    });
    expect(inviteRes.statusCode).toBe(201);

    // Login as analyst
    const { temporaryPassword } = JSON.parse(inviteRes.body);
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'analyst@example.com', password: temporaryPassword },
    });
    const { token: analystToken } = JSON.parse(loginRes.body);

    // Analyst tries to invite - should fail
    const failRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/invite',
      headers: { authorization: `Bearer ${analystToken}` },
      payload: { email: 'another@example.com', role: 'analyst' },
    });
    expect(failRes.statusCode).toBe(403);
  });

  it('hasPermission correctly evaluates permissions', () => {
    const analystPerms = getPermissionsForRole('analyst');

    // Analyst can read data
    expect(hasPermission(analystPerms, 'data', 'read')).toBe(true);
    // Analyst can write data
    expect(hasPermission(analystPerms, 'data', 'write')).toBe(true);
    // Analyst cannot delete data
    expect(hasPermission(analystPerms, 'data', 'delete')).toBe(false);
    // Analyst cannot write to users
    expect(hasPermission(analystPerms, 'users', 'write')).toBe(false);
    // Analyst cannot access billing
    expect(hasPermission(analystPerms, 'billing', 'read')).toBe(false);
  });

  it('owner has full permissions including billing', () => {
    const ownerPerms = getPermissionsForRole('owner');
    expect(hasPermission(ownerPerms, 'billing', 'read')).toBe(true);
    expect(hasPermission(ownerPerms, 'billing', 'write')).toBe(true);
    expect(hasPermission(ownerPerms, 'organization', 'delete')).toBe(true);
  });

  it('admin does not have billing access', () => {
    const adminPerms = getPermissionsForRole('admin');
    expect(hasPermission(adminPerms, 'billing', 'read')).toBe(false);
    expect(hasPermission(adminPerms, 'organization', 'delete')).toBe(false);
  });

  it('auditor_readonly has only read access', () => {
    const auditorPerms = getPermissionsForRole('auditor_readonly');
    expect(hasPermission(auditorPerms, 'data', 'read')).toBe(true);
    expect(hasPermission(auditorPerms, 'reports', 'read')).toBe(true);
    expect(hasPermission(auditorPerms, 'evidence', 'read')).toBe(true);
    expect(hasPermission(auditorPerms, 'data', 'write')).toBe(false);
    expect(hasPermission(auditorPerms, 'reports', 'write')).toBe(false);
  });
});

// ============================================================
// Tests: POST /api/v1/users/invite
// ============================================================

describe('POST /api/v1/users/invite', () => {
  it('owner can invite users', async () => {
    const { res: regRes } = await registerUser();
    const { token } = JSON.parse(regRes.body);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/invite',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'new@example.com', role: 'analyst' },
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(201);
    expect(body.user.email).toBe('new@example.com');
    expect(body.user.role).toBe('analyst');
    expect(body.temporaryPassword).toBeDefined();
  });

  it('admin can invite users', async () => {
    const { res: regRes } = await registerUser();
    const { token: ownerToken } = JSON.parse(regRes.body);

    // Invite admin
    const inviteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/invite',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: 'admin@example.com', role: 'admin' },
    });
    const { temporaryPassword } = JSON.parse(inviteRes.body);

    // Login as admin
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@example.com', password: temporaryPassword },
    });
    const { token: adminToken } = JSON.parse(loginRes.body);

    // Admin invites another user
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/invite',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: 'manager@example.com', role: 'manager' },
    });
    expect(res.statusCode).toBe(201);
  });
});

// ============================================================
// Tests: GET /api/v1/users
// ============================================================

describe('GET /api/v1/users', () => {
  it('returns all users in organization', async () => {
    const { res: regRes } = await registerUser();
    const { token } = JSON.parse(regRes.body);

    // Invite a second user
    await app.inject({
      method: 'POST',
      url: '/api/v1/users/invite',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'user2@example.com', role: 'analyst' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.users).toBeDefined();
    expect(body.users.length).toBe(2);
  });
});

// ============================================================
// Tests: PUT /api/v1/users/:id/role
// ============================================================

describe('PUT /api/v1/users/:id/role', () => {
  it('owner can change user role', async () => {
    const { res: regRes } = await registerUser();
    const { token } = JSON.parse(regRes.body);

    // Invite user
    const inviteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/invite',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'change-me@example.com', role: 'analyst' },
    });
    const invitedUser = JSON.parse(inviteRes.body).user;

    // Change role
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${invitedUser.id}/role`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'manager' },
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.user.role).toBe('manager');
  });

  it('non-owner cannot change roles', async () => {
    const { res: regRes } = await registerUser();
    const { token: ownerToken } = JSON.parse(regRes.body);

    // Invite admin
    const inviteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/invite',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: 'admin@example.com', role: 'admin' },
    });
    const { temporaryPassword, user: adminUser } = JSON.parse(inviteRes.body);

    // Login as admin
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@example.com', password: temporaryPassword },
    });
    const { token: adminToken } = JSON.parse(loginRes.body);

    // Invite another user via owner
    const invite2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/invite',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { email: 'target@example.com', role: 'analyst' },
    });
    const targetUser = JSON.parse(invite2Res.body).user;

    // Admin tries to change role - should fail
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${targetUser.id}/role`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { role: 'manager' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('role change updates permissions correctly', async () => {
    const { res: regRes } = await registerUser();
    const { token } = JSON.parse(regRes.body);

    // Invite as analyst
    const inviteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/invite',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'promoted@example.com', role: 'analyst' },
    });
    const invitedUser = JSON.parse(inviteRes.body).user;

    // Promote to admin
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${invitedUser.id}/role`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'admin' },
    });
    const body = JSON.parse(res.body);

    expect(body.user.role).toBe('admin');
    // Admin should have user write permission
    const usersPerm = body.user.permissions.find((p: { resource: string }) => p.resource === 'users');
    expect(usersPerm).toBeDefined();
    expect(usersPerm.actions).toContain('write');
  });
});

// ============================================================
// Tests: All 7 endpoints respond correctly
// ============================================================

describe('All endpoints respond correctly', () => {
  it('all 7 endpoints are registered and respond', async () => {
    // 1. Register
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'all7@example.com',
        password: 'Password123!',
        name: 'All Seven',
        orgName: 'Seven Org',
        orgType: 'corporate',
      },
    });
    expect(regRes.statusCode).toBe(201);
    const { token, user } = JSON.parse(regRes.body);

    // 2. Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'all7@example.com', password: 'Password123!' },
    });
    expect(loginRes.statusCode).toBe(200);

    // 3. Refresh
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(refreshRes.statusCode).toBe(200);

    // 4. Me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meRes.statusCode).toBe(200);

    // 5. Invite
    const inviteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/invite',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'invited@example.com', role: 'analyst' },
    });
    expect(inviteRes.statusCode).toBe(201);
    const invitedUser = JSON.parse(inviteRes.body).user;

    // 6. List users
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);

    // 7. Change role
    const roleRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${invitedUser.id}/role`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'manager' },
    });
    expect(roleRes.statusCode).toBe(200);
  });
});
