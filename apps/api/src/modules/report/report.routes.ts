import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import {
  createReport,
  listReports,
  getReport,
  updateReport,
  updateSection,
  addReviewComment,
  exportReport,
} from './report.service.js';

// ============================================================
// Input Validation Schemas
// ============================================================

const CreateReportBodySchema = z.object({
  title: z.string().min(1),
  type: z.enum([
    'sustainability_report',
    'esg_report',
    'tcfd_report',
    'integrated_report',
    'cdp_response',
    'custom',
  ]),
  language: z.enum(['en', 'ar', 'bilingual']).optional(),
  sections: z
    .array(
      z.object({
        title: z.string().min(1),
        frameworkRef: z.string().optional(),
        disclosures: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

const UpdateReportBodySchema = z.object({
  title: z.string().min(1).optional(),
  language: z.enum(['en', 'ar', 'bilingual']).optional(),
  status: z
    .enum(['draft', 'in_review', 'partner_approved', 'client_approved', 'final'])
    .optional(),
});

const UpdateSectionBodySchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  status: z.enum(['pending', 'drafted', 'reviewed', 'approved']).optional(),
});

const ReviewCommentBodySchema = z.object({
  content: z.string().min(1),
});

const ExportBodySchema = z.object({
  format: z.enum(['docx', 'pdf', 'html']),
});

// ============================================================
// Route Registration
// ============================================================

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // POST /api/v1/engagements/:id/reports — Create report
  // ----------------------------------------------------------
  app.post(
    '/api/v1/engagements/:id/reports',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id: engagementId } = request.params as { id: string };
        const parsed = CreateReportBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const report = await createReport({
          engagementId,
          ...parsed.data,
        } as any);

        return reply.code(201).send(report);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // GET /api/v1/engagements/:id/reports — List reports
  // ----------------------------------------------------------
  app.get(
    '/api/v1/engagements/:id/reports',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id: engagementId } = request.params as { id: string };
        const reports = await listReports(engagementId);

        return reply.code(200).send(reports);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // GET /api/v1/reports/:id — Get report with sections
  // ----------------------------------------------------------
  app.get(
    '/api/v1/reports/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id } = request.params as { id: string };
        const report = await getReport(id);

        return reply.code(200).send(report);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // PUT /api/v1/reports/:id — Update report metadata
  // ----------------------------------------------------------
  app.put(
    '/api/v1/reports/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id } = request.params as { id: string };
        const parsed = UpdateReportBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const report = await updateReport(id, parsed.data);
        return reply.code(200).send(report);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // PUT /api/v1/reports/:id/sections/:sectionId — Update section
  // ----------------------------------------------------------
  app.put(
    '/api/v1/reports/:id/sections/:sectionId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id, sectionId } = request.params as { id: string; sectionId: string };
        const parsed = UpdateSectionBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const report = await updateSection(id, sectionId, parsed.data);
        return reply.code(200).send(report);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // POST /api/v1/reports/:id/sections/:sectionId/review — Add review comment
  // ----------------------------------------------------------
  app.post(
    '/api/v1/reports/:id/sections/:sectionId/review',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id, sectionId } = request.params as { id: string; sectionId: string };
        const parsed = ReviewCommentBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const report = await addReviewComment(id, sectionId, {
          userId: request.user.userId,
          content: parsed.data.content,
        });

        return reply.code(201).send(report);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ----------------------------------------------------------
  // POST /api/v1/reports/:id/export — Export report
  // ----------------------------------------------------------
  app.post(
    '/api/v1/reports/:id/export',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { id } = request.params as { id: string };
        const parsed = ExportBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const result = await exportReport(id, parsed.data.format);
        return reply.code(200).send(result);
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );
}

// ============================================================
// Error Handler
// ============================================================

function handleError(
  err: unknown,
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
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
