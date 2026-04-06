import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import { chat, executeAction } from './agent.service.js';
import { perceiveDocument, fullPerception } from './perception.js';
import { judgeSection, judgeDocument, type JudgmentLevel } from './judgment.js';
import { catchMeUp, getRecentConversations, getDecisions } from './memory.js';
import { getTeamContext } from './team-awareness.js';
import { generateFullReport, generateAssurancePack, generateExecutiveSummary } from './workproduct.js';
import { processEditSignal, processAcceptSignal, processRejectSignal } from './learning.js';

// ============================================================
// Input Validation Schemas
// ============================================================

const ChatBodySchema = z.object({
  engagementId: z.string().min(1),
  message: z.string().min(1),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
  documentBody: z.string().optional(),
  cursorSection: z.string().optional(),
});

const PerceiveBodySchema = z.object({
  engagementId: z.string().min(1),
  documentBody: z.string().min(1),
  documentType: z.enum(['word', 'excel', 'powerpoint', 'outlook']),
});

const JudgeSectionSchema = z.object({
  engagementId: z.string().min(1),
  sectionContent: z.string().min(1),
  sectionTitle: z.string().min(1),
  frameworkRef: z.string().optional(),
  judgmentLevel: z.enum(['quick', 'thorough', 'partner_review']).default('thorough'),
});

const JudgeDocumentSchema = z.object({
  engagementId: z.string().min(1),
  fullDocumentBody: z.string().min(1),
  judgmentLevel: z.enum(['quick', 'thorough', 'partner_review']).default('thorough'),
});

const ActionBodySchema = z.object({
  engagementId: z.string().min(1),
  action: z.string().min(1),
  params: z.record(z.any()).default({}),
});

const GenerateReportSchema = z.object({
  engagementId: z.string().min(1),
  language: z.enum(['en', 'ar', 'bilingual']).default('en'),
  qualityLevel: z.enum(['quick', 'thorough', 'partner_review']).default('thorough'),
});

const GenerateAssurancePackSchema = z.object({
  engagementId: z.string().min(1),
});

const GenerateExecutiveSummarySchema = z.object({
  engagementId: z.string().min(1),
});

const LearnEditSchema = z.object({
  engagementId: z.string().min(1),
  originalDraft: z.string().min(1),
  editedVersion: z.string().min(1),
});

const LearnAcceptSchema = z.object({
  engagementId: z.string().min(1),
});

const LearnRejectSchema = z.object({
  engagementId: z.string().min(1),
  reason: z.string().optional(),
});

const FullPerceptionSchema = z.object({
  engagementId: z.string().min(1),
  documentBody: z.string().min(1),
  documentType: z.enum(['word', 'excel', 'powerpoint', 'outlook']),
});

// ============================================================
// Route Registration
// ============================================================

export async function registerAgentRoutes(app: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------
  // POST /api/v1/agent/chat — Chat with the ESG agent
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/chat',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = ChatBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const result = await chat({
          engagementId: parsed.data.engagementId,
          userId: request.user.userId,
          message: parsed.data.message,
          conversationHistory: parsed.data.conversationHistory,
          documentBody: parsed.data.documentBody,
          cursorSection: parsed.data.cursorSection,
        });

        return reply.code(200).send(result);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/perceive — Document perception on open
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/perceive',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = PerceiveBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const perception = await perceiveDocument(
          parsed.data.engagementId,
          parsed.data.documentBody,
          parsed.data.documentType
        );

        return reply.code(200).send(perception);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/judge — Judge a single section
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/judge',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = JudgeSectionSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const result = await judgeSection({
          engagementId: parsed.data.engagementId,
          sectionContent: parsed.data.sectionContent,
          sectionTitle: parsed.data.sectionTitle,
          frameworkRef: parsed.data.frameworkRef,
          judgmentLevel: parsed.data.judgmentLevel as JudgmentLevel,
        });

        return reply.code(200).send(result);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/judge-document — Judge entire document
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/judge-document',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = JudgeDocumentSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const result = await judgeDocument({
          engagementId: parsed.data.engagementId,
          fullDocumentBody: parsed.data.fullDocumentBody,
          judgmentLevel: parsed.data.judgmentLevel as JudgmentLevel,
        });

        return reply.code(200).send(result);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/catch-me-up — Summary since last session
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/catch-me-up',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = z.object({ engagementId: z.string().min(1) }).safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const summary = await catchMeUp(parsed.data.engagementId, request.user.userId);
        return reply.code(200).send(summary);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/agent/memory/:engagementId — Get engagement memory
  // ----------------------------------------------------------
  app.get<{ Params: { engagementId: string } }>(
    '/api/v1/agent/memory/:engagementId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { engagementId } = request.params;
        const [conversations, decisions] = await Promise.all([
          getRecentConversations(engagementId, 20),
          getDecisions(engagementId),
        ]);

        return reply.code(200).send({ conversations, decisions });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/action — Direct tool invocation
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/action',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = ActionBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const result = await executeAction({
          engagementId: parsed.data.engagementId,
          userId: request.user.userId,
          action: parsed.data.action,
          params: parsed.data.params,
        });

        return reply.code(200).send({ result });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/agent/team/:engagementId — Team context & bottlenecks
  // ----------------------------------------------------------
  app.get<{ Params: { engagementId: string } }>(
    '/api/v1/agent/team/:engagementId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const { engagementId } = request.params;
        const teamContext = await getTeamContext(engagementId);
        return reply.code(200).send(teamContext);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/generate-report — Full report generation
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/generate-report',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = GenerateReportSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const report = await generateFullReport({
          engagementId: parsed.data.engagementId,
          language: parsed.data.language,
          qualityLevel: parsed.data.qualityLevel as JudgmentLevel,
        });

        return reply.code(200).send(report);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/generate-assurance-pack — Evidence pack
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/generate-assurance-pack',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = GenerateAssurancePackSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const pack = await generateAssurancePack(parsed.data.engagementId);
        return reply.code(200).send(pack);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/generate-executive-summary — Executive summary
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/generate-executive-summary',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = GenerateExecutiveSummarySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const summary = await generateExecutiveSummary(parsed.data.engagementId);
        return reply.code(200).send({ summary });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/learn/edit — Learning from user edits
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/learn/edit',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = LearnEditSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const result = await processEditSignal(
          parsed.data.engagementId,
          request.user.userId,
          parsed.data.originalDraft,
          parsed.data.editedVersion
        );

        return reply.code(200).send(result);
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/learn/accept — Reinforce preferences
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/learn/accept',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = LearnAcceptSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        await processAcceptSignal(parsed.data.engagementId, request.user.userId);
        return reply.code(200).send({ success: true });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/learn/reject — Flag preferences for review
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/learn/reject',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = LearnRejectSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        await processRejectSignal(
          parsed.data.engagementId,
          request.user.userId,
          parsed.data.reason
        );
        return reply.code(200).send({ success: true });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/agent/full-perception — Unified document open endpoint
  // ----------------------------------------------------------
  app.post(
    '/api/v1/agent/full-perception',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const parsed = FullPerceptionSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const result = await fullPerception(
          parsed.data.engagementId,
          request.user.userId,
          parsed.data.documentBody,
          parsed.data.documentType
        );

        return reply.code(200).send(result);
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
