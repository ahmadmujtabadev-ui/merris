import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, hasPermission } from './auth.service.js';
import type { TokenPayload } from './auth.service.js';
import type { UserRole } from '@merris/shared';

// Extend Fastify request to include user payload
declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

/**
 * Verifies JWT token from Authorization header and attaches user to request.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    request.user = payload;
  } catch (err) {
    reply.code(401).send({ error: 'Invalid or expired token' });
    return;
  }
}

/**
 * Checks if the authenticated user has the required permissions.
 * Must be used after authenticate middleware.
 */
export function authorize(resource: string, action: 'read' | 'write' | 'delete' | 'approve') {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    if (!hasPermission(request.user.permissions, resource, action)) {
      reply.code(403).send({ error: 'Insufficient permissions' });
      return;
    }
  };
}

/**
 * Shortcut for role-based checks. Allows only the specified roles.
 * Must be used after authenticate middleware.
 */
export function requireRole(roles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(request.user.role)) {
      reply.code(403).send({ error: 'Insufficient role' });
      return;
    }
  };
}
