import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import {
  ingestReport,
  ingestReportByPath,
  listReports,
  getReportById,
  getBenchmarkData,
} from './knowledge-base.service.js';

// ============================================================
// Route Registration
// ============================================================

export async function registerKnowledgeBaseRoutes(app: FastifyInstance): Promise<void> {
  // Register multipart plugin for PDF upload
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max for large sustainability PDFs
      files: 1,
    },
  });

  // ----------------------------------------------------------
  // POST /api/v1/knowledge-base/ingest-report
  // Upload and ingest a sustainability PDF
  // ----------------------------------------------------------
  app.post(
    '/api/v1/knowledge-base/ingest-report',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const file = await request.file();
        if (!file) {
          return reply.code(400).send({ error: 'No file provided' });
        }

        // Validate PDF mime type
        if (file.mimetype !== 'application/pdf') {
          return reply.code(400).send({ error: 'Only PDF files are supported' });
        }

        // Read file buffer
        const chunks: Buffer[] = [];
        for await (const chunk of file.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        if (buffer.length === 0) {
          return reply.code(400).send({ error: 'Empty file' });
        }

        // Extract metadata from multipart fields
        const fields = file.fields as Record<string, { value?: string } | undefined>;

        const company = fields['company']?.value;
        const reportYearStr = fields['reportYear']?.value;
        const sector = fields['sector']?.value;
        const country = fields['country']?.value;
        const disclosureId = fields['disclosureId']?.value;

        if (!company || !reportYearStr || !sector || !country) {
          return reply.code(400).send({
            error: 'Missing required fields: company, reportYear, sector, country',
          });
        }

        const reportYear = parseInt(reportYearStr, 10);
        if (isNaN(reportYear)) {
          return reply.code(400).send({ error: 'reportYear must be a valid number' });
        }

        const result = await ingestReport(buffer, {
          company,
          reportYear,
          sector,
          country,
          disclosureId: disclosureId || undefined,
        });

        return reply.code(201).send({ result });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/knowledge-base/ingest-report-by-id
  // Ingest from already-downloaded PDF by file path
  // ----------------------------------------------------------
  app.post(
    '/api/v1/knowledge-base/ingest-report-by-id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const bodySchema = z.object({
          disclosureId: z.string().min(1),
          filePath: z.string().min(1),
          company: z.string().min(1),
          reportYear: z.number().int().min(1900).max(2100),
          sector: z.string().min(1),
          country: z.string().min(1),
        });

        const body = bodySchema.parse(request.body);

        const result = await ingestReportByPath(body.filePath, {
          company: body.company,
          reportYear: body.reportYear,
          sector: body.sector,
          country: body.country,
          disclosureId: body.disclosureId,
        });

        return reply.code(201).send({ result });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/knowledge-base/reports
  // List ingested reports with optional filters
  // ----------------------------------------------------------
  app.get(
    '/api/v1/knowledge-base/reports',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const query = request.query as Record<string, string | undefined>;
        const sector = query['sector'];
        const country = query['country'];
        const minQuality = query['minQuality'] ? parseInt(query['minQuality'], 10) : undefined;

        const reports = await listReports({ sector, country, minQuality });

        return reply.code(200).send({ reports });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/knowledge-base/reports/:id
  // Get full report detail with extracted data
  // ----------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/api/v1/knowledge-base/reports/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const report = await getReportById(request.params.id);
        if (!report) {
          return reply.code(404).send({ error: 'Report not found' });
        }

        return reply.code(200).send({ report });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/knowledge-base/benchmarks/:metric
  // Get benchmark data for a specific metric across reports
  // ----------------------------------------------------------
  app.get<{ Params: { metric: string } }>(
    '/api/v1/knowledge-base/benchmarks/:metric',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const query = request.query as Record<string, string | undefined>;
        const sector = query['sector'];
        const country = query['country'];

        const benchmark = await getBenchmarkData(request.params.metric, {
          sector,
          country,
        });

        return reply.code(200).send({ benchmark });
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
