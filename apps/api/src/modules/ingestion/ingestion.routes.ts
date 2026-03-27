import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import {
  uploadDocument,
  getDocumentsByEngagement,
  getDocumentById,
  UploadError,
} from './ingestion.service.js';

// ============================================================
// Route Registration
// ============================================================

export async function registerIngestionRoutes(app: FastifyInstance): Promise<void> {
  // Register multipart plugin
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
      files: 1,
    },
  });

  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/documents
  // ----------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/documents',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const engagementId = request.params.id;
        const orgId = request.user.orgId;

        const file = await request.file();
        if (!file) {
          return reply.code(400).send({ error: 'No file provided' });
        }

        const chunks: Buffer[] = [];
        for await (const chunk of file.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        if (buffer.length === 0) {
          return reply.code(400).send({ error: 'Empty file' });
        }

        const result = await uploadDocument(
          engagementId,
          orgId,
          file.filename,
          buffer,
          file.mimetype
        );

        return reply.code(201).send({
          document: {
            id: result.document._id.toString(),
            engagementId: result.document.engagementId.toString(),
            filename: result.document.filename,
            format: result.document.format,
            size: result.document.size,
            status: result.document.status,
            uploadedAt: result.document.uploadedAt,
          },
          queued: result.queued,
        });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/documents
  // ----------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/documents',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const documents = await getDocumentsByEngagement(request.params.id);
        return reply.code(200).send({ documents });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/documents/:id
  // ----------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/api/v1/documents/:id',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const document = await getDocumentById(request.params.id);
        if (!document) {
          return reply.code(404).send({ error: 'Document not found' });
        }

        return reply.code(200).send({ document });
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
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }
) {
  if (err instanceof UploadError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }

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
