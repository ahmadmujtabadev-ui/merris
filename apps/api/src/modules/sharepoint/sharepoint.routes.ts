import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware.js';
import {
  connectFolder,
  disconnectFolder,
  getConnectionStatus,
  syncFolder,
  handleWebhookNotification,
  SharePointError,
} from './sharepoint.service.js';
import { SharePointConnectionModel } from './sharepoint.model.js';

// ============================================================
// Validation Schemas
// ============================================================

const ConnectBodySchema = z.object({
  driveId: z.string().min(1, 'driveId is required'),
  folderId: z.string().min(1, 'folderId is required'),
});

// ============================================================
// Route Registration
// ============================================================

export async function registerSharePointRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/sharepoint/connect
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/sharepoint/connect',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = ConnectBodySchema.parse(request.body);
        const engagementId = request.params.id;
        const orgId = request.user.orgId;

        const connection = await connectFolder(
          orgId,
          engagementId,
          parsed.driveId,
          parsed.folderId
        );

        return reply.code(201).send({
          connection: {
            id: connection._id.toString(),
            driveId: connection.driveId,
            folderId: connection.folderId,
            engagementId: connection.engagementId.toString(),
            status: connection.status,
          },
        });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // DELETE /api/v1/engagements/:id/sharepoint/disconnect
  // ----------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/sharepoint/disconnect',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        await disconnectFolder(request.params.id);
        return reply.code(200).send({ success: true });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/sharepoint/status
  // ----------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/sharepoint/status',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const status = await getConnectionStatus(request.params.id);
        return reply.code(200).send(status);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/sharepoint/sync
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/sharepoint/sync',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const connection = await SharePointConnectionModel.findOne({
          engagementId: request.params.id,
          status: 'active',
        });

        if (!connection) {
          return reply.code(404).send({ error: 'No active SharePoint connection' });
        }

        const result = await syncFolder(connection._id.toString());
        return reply.code(200).send(result);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/sharepoint/webhook
  // Microsoft Graph webhook callback — NO authentication
  // ----------------------------------------------------------
  app.post<{ Querystring: { validationToken?: string } }>(
    '/api/v1/sharepoint/webhook',
    async (request, reply) => {
      // Handle validation challenge from Microsoft
      const validationToken = (request.query as { validationToken?: string }).validationToken;
      if (validationToken) {
        return reply
          .code(200)
          .header('content-type', 'text/plain')
          .send(validationToken);
      }

      // Process change notifications
      try {
        const body = request.body as { value?: unknown[] };
        const notifications = body?.value;

        if (Array.isArray(notifications) && notifications.length > 0) {
          // Process asynchronously — respond to Microsoft quickly
          handleWebhookNotification(notifications as Parameters<typeof handleWebhookNotification>[0]).catch(
            (err) => {
              // Logged inside handleWebhookNotification
              void err;
            }
          );
        }

        return reply.code(202).send();
      } catch {
        // Always respond 202 to Microsoft even on error to prevent retry storm
        return reply.code(202).send();
      }
    }
  );
}

// ============================================================
// Error Handler
// ============================================================

function handleError(
  err: unknown,
  reply: FastifyReply
) {
  if (err instanceof SharePointError) {
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
