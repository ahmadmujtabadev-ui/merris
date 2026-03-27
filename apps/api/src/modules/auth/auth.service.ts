import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel, OrganizationModel, TeamModel } from './auth.model.js';
import type { IUser } from './auth.model.js';
import type { UserRole, Permission } from '@merris/shared';

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY = '24h';

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

// ============================================================
// RBAC Permission Matrix
// ============================================================

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: [
    { resource: 'organization', actions: ['read', 'write', 'delete', 'approve'] },
    { resource: 'users', actions: ['read', 'write', 'delete', 'approve'] },
    { resource: 'billing', actions: ['read', 'write', 'delete', 'approve'] },
    { resource: 'engagements', actions: ['read', 'write', 'delete', 'approve'] },
    { resource: 'data', actions: ['read', 'write', 'delete', 'approve'] },
    { resource: 'reports', actions: ['read', 'write', 'delete', 'approve'] },
    { resource: 'evidence', actions: ['read', 'write', 'delete', 'approve'] },
  ],
  admin: [
    { resource: 'organization', actions: ['read', 'write', 'approve'] },
    { resource: 'users', actions: ['read', 'write', 'delete', 'approve'] },
    { resource: 'engagements', actions: ['read', 'write', 'delete', 'approve'] },
    { resource: 'data', actions: ['read', 'write', 'delete', 'approve'] },
    { resource: 'reports', actions: ['read', 'write', 'delete', 'approve'] },
    { resource: 'evidence', actions: ['read', 'write', 'delete', 'approve'] },
  ],
  manager: [
    { resource: 'engagements', actions: ['read', 'write'] },
    { resource: 'data', actions: ['read', 'write'] },
    { resource: 'reports', actions: ['read', 'write'] },
    { resource: 'evidence', actions: ['read', 'write'] },
    { resource: 'users', actions: ['read'] },
  ],
  analyst: [
    { resource: 'data', actions: ['read', 'write'] },
    { resource: 'reports', actions: ['read'] },
    { resource: 'evidence', actions: ['read', 'write'] },
  ],
  reviewer: [
    { resource: 'engagements', actions: ['read'] },
    { resource: 'data', actions: ['read'] },
    { resource: 'reports', actions: ['read', 'approve'] },
    { resource: 'evidence', actions: ['read'] },
  ],
  auditor_readonly: [
    { resource: 'data', actions: ['read'] },
    { resource: 'reports', actions: ['read'] },
    { resource: 'evidence', actions: ['read'] },
  ],
};

export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(
  userPermissions: Permission[],
  resource: string,
  action: 'read' | 'write' | 'delete' | 'approve'
): boolean {
  return userPermissions.some(
    (p) => p.resource === resource && p.actions.includes(action)
  );
}

// ============================================================
// Token Management
// ============================================================

export interface TokenPayload {
  userId: string;
  orgId: string;
  role: UserRole;
  permissions: Permission[];
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
}

// ============================================================
// Auth Service Functions
// ============================================================

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  orgName: string;
  orgType: 'consulting' | 'corporate';
}

export async function register(input: RegisterInput) {
  const { email, password, name, orgName, orgType } = input;

  // Check if user already exists
  const existing = await UserModel.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError('User with this email already exists', 409);
  }

  // Create organization
  const org = await OrganizationModel.create({
    name: orgName,
    type: orgType,
    plan: 'starter',
    settings: { language: 'en', timezone: 'UTC', currency: 'USD' },
    branding: {},
  });

  // Hash password and create user
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const role: UserRole = 'owner';
  const permissions = getPermissionsForRole(role);

  const user = await UserModel.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    name,
    orgId: org._id,
    role,
    permissions,
    preferences: {
      language: 'en',
      timezone: 'UTC',
      notifications: { email: true, inApp: true, teams: false },
    },
  });

  const token = generateToken({
    userId: user._id.toString(),
    orgId: org._id.toString(),
    role: user.role as UserRole,
    permissions: user.permissions,
  });

  return {
    user: sanitizeUser(user),
    token,
    organization: {
      id: org._id.toString(),
      name: org.name,
      type: org.type,
      plan: org.plan,
    },
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function login(input: LoginInput) {
  const { email, password } = input;

  const user = await UserModel.findOne({ email: email.toLowerCase(), isActive: true });
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = generateToken({
    userId: user._id.toString(),
    orgId: user.orgId.toString(),
    role: user.role as UserRole,
    permissions: user.permissions,
  });

  return {
    user: sanitizeUser(user),
    token,
  };
}

export function refreshToken(payload: TokenPayload) {
  return generateToken({
    userId: payload.userId,
    orgId: payload.orgId,
    role: payload.role,
    permissions: payload.permissions,
  });
}

export async function getMe(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const org = await OrganizationModel.findById(user.orgId);
  const teams = await TeamModel.find({ memberIds: user._id });

  return {
    user: sanitizeUser(user),
    organization: org
      ? {
          id: org._id.toString(),
          name: org.name,
          type: org.type,
          plan: org.plan,
        }
      : null,
    teams: teams.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      description: t.description,
    })),
  };
}

export interface InviteInput {
  email: string;
  role: UserRole;
  teamId?: string;
  invitedByUserId: string;
  orgId: string;
}

export async function inviteUser(input: InviteInput) {
  const { email, role, teamId, invitedByUserId, orgId } = input;

  // Check if user already exists in this org
  const existing = await UserModel.findOne({ email: email.toLowerCase(), orgId });
  if (existing) {
    throw new AppError('User already exists in this organization', 409);
  }

  // Cannot invite owners
  if (role === 'owner') {
    throw new AppError('Cannot invite users with owner role', 403);
  }

  // Generate temporary password
  const tempPassword = Math.random().toString(36).slice(-12);
  const hashedPassword = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  const permissions = getPermissionsForRole(role);

  const teamIds = teamId ? [teamId] : [];

  const user = await UserModel.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    name: email.split('@')[0] || 'New User',
    orgId,
    role,
    permissions,
    teamIds,
    preferences: {
      language: 'en',
      timezone: 'UTC',
      notifications: { email: true, inApp: true, teams: false },
    },
  });

  // Add to team if specified
  if (teamId) {
    await TeamModel.findByIdAndUpdate(teamId, {
      $addToSet: { memberIds: user._id },
    });
  }

  return {
    user: sanitizeUser(user),
    temporaryPassword: tempPassword,
  };
}

export async function listUsers(orgId: string, requestingUser: TokenPayload) {
  const query: Record<string, unknown> = { orgId, isActive: true };

  // Managers and below only see users in their teams
  if (['manager', 'analyst', 'reviewer', 'auditor_readonly'].includes(requestingUser.role)) {
    const user = await UserModel.findById(requestingUser.userId);
    if (user && user.teamIds.length > 0) {
      query['teamIds'] = { $in: user.teamIds };
    }
  }

  const users = await UserModel.find(query).select('-password');
  return users.map(sanitizeUser);
}

export async function changeUserRole(
  targetUserId: string,
  newRole: UserRole,
  requestingUser: TokenPayload
) {
  if (requestingUser.role !== 'owner') {
    throw new AppError('Only owners can change user roles', 403);
  }

  // Cannot change own role
  if (requestingUser.userId === targetUserId) {
    throw new AppError('Cannot change your own role', 400);
  }

  const permissions = getPermissionsForRole(newRole);

  const user = await UserModel.findOneAndUpdate(
    { _id: targetUserId, orgId: requestingUser.orgId },
    { role: newRole, permissions },
    { new: true }
  );

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return sanitizeUser(user);
}

// ============================================================
// Helpers
// ============================================================

function sanitizeUser(user: IUser) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    orgId: user.orgId.toString(),
    role: user.role,
    permissions: user.permissions,
    mfaEnabled: user.mfaEnabled,
    preferences: user.preferences,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}
