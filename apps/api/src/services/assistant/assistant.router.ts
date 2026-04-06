// src/services/assistant/assistant.router.ts
//
// New canonical routes for the Merris Assistant product.
// These proxy to existing agent module functions.

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../modules/auth/auth.middleware.js';
import {
  chat,
  perceiveDocument,
  fullPerception,
  judgeSection,
  judgeDocument,
  catchMeUp,
  buildMemoryContext,
  getTeamContext,
  generateFullReport,
  generateAssurancePack,
  generateExecutiveSummary,
  processEditSignal,
  processAcceptSignal,
  processRejectSignal,
  executeAction,
} from './assistant.service.js';
import { checkHardBlocks, evaluateResponse, autoRewrite } from './evaluator.js';
import { trackResponseMetric, getDailyMetrics } from './metrics.js';

export async function registerAssistantRoutes(app: FastifyInstance): Promise<void> {
  // ---- Chat ----
  app.post('/api/v1/assistant/chat', { preHandler: [authenticate] }, async (request, reply) => {
    const {
      engagementId, message, conversationHistory, documentBody, cursorSection,
      jurisdiction, sector, ownershipType, documentId, knowledgeSources,
    } = request.body as any;
    const user = (request as any).user;
    const result = await chat({
      engagementId,
      userId: user.userId,
      message,
      conversationHistory,
      documentBody,
      cursorSection,
      jurisdiction,
      sector,
      ownershipType,
      documentId,
      knowledgeSources,
    });

    let finalResponse = result.response;
    let evaluation: any = null;
    let hardBlocked = false;

    // Hard block check (fast, deterministic)
    const hardBlock = checkHardBlocks(finalResponse);
    if (hardBlock) {
      hardBlocked = true;
      // Regenerate once
      const retry = await chat({ engagementId, userId: user.userId, message, conversationHistory, documentBody, cursorSection, jurisdiction, sector, ownershipType, documentId, knowledgeSources });
      finalResponse = retry.response;
      result.toolCalls = retry.toolCalls;
      result.citations = retry.citations;
    }

    // AI evaluator
    evaluation = await evaluateResponse(message, finalResponse, { engagementId });

    if (evaluation.decision === 'FIX' && evaluation.fix_instructions) {
      finalResponse = await autoRewrite(finalResponse, evaluation.flags, evaluation.fix_instructions);
      evaluation.rewritten = true;
    } else if (evaluation.decision === 'REJECT') {
      // Regenerate once
      const retry = await chat({ engagementId, userId: user.userId, message, conversationHistory, documentBody, cursorSection, jurisdiction, sector, ownershipType, documentId, knowledgeSources });
      finalResponse = retry.response;
      evaluation = await evaluateResponse(message, finalResponse, { engagementId });
    }

    // Track metrics (non-blocking)
    trackResponseMetric(evaluation.score, evaluation.decision, hardBlocked).catch(() => {});

    return reply.send({ ...result, response: finalResponse, evaluation });
  });

  // ---- Deep Analysis (same as full perception + judgment) ----
  app.post('/api/v1/assistant/deep-analysis', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, documentType } = request.body as any;
    const user = (request as any).user;
    const perception = await fullPerception(engagementId, user.userId, documentBody, documentType || 'word');
    const judgment = await judgeDocument({
      engagementId,
      fullDocumentBody: documentBody,
      judgmentLevel: 'thorough',
    });
    return reply.send({ perception, judgment });
  });

  // ---- Draft ----
  app.post('/api/v1/assistant/draft', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, message, documentBody, cursorSection } = request.body as any;
    const user = (request as any).user;
    const result = await chat({
      engagementId,
      userId: user.userId,
      message: `DRAFT REQUEST: ${message}`,
      documentBody,
      cursorSection,
    });
    return reply.send(result);
  });

  // ---- Review ----
  app.post('/api/v1/assistant/review', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, cursorSection, sectionTitle, frameworkRef, judgmentLevel } = request.body as any;
    if (sectionTitle) {
      const result = await judgeSection({
        engagementId,
        sectionContent: documentBody,
        sectionTitle,
        frameworkRef,
        judgmentLevel: judgmentLevel || 'thorough',
      });
      return reply.send(result);
    }
    const result = await judgeDocument({
      engagementId,
      fullDocumentBody: documentBody,
      judgmentLevel: judgmentLevel || 'thorough',
    });
    return reply.send(result);
  });

  // ---- Suggestions ----
  app.get('/api/v1/assistant/suggestions', { preHandler: [authenticate] }, async (request, reply) => {
    // Return context-aware prompt suggestions
    const suggestions = [
      'Review this section for regulatory compliance',
      'Draft an executive summary',
      'Check data consistency across the document',
      'Benchmark our emissions against peers',
      'What are the mandatory disclosures we\'re missing?',
    ];
    return reply.send({ suggestions });
  });

  // ---- Perception ----
  app.post('/api/v1/assistant/perceive', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, documentType } = request.body as any;
    const result = await perceiveDocument(engagementId, documentBody, documentType || 'word');
    return reply.send(result);
  });

  app.post('/api/v1/assistant/full-perception', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, documentType } = request.body as any;
    const user = (request as any).user;
    const result = await fullPerception(engagementId, user.userId, documentBody, documentType || 'word');
    return reply.send(result);
  });

  // ---- Judgment ----
  app.post('/api/v1/assistant/judge', { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const result = await judgeSection(body);
    return reply.send(result);
  });

  app.post('/api/v1/assistant/judge-document', { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const result = await judgeDocument(body);
    return reply.send(result);
  });

  // ---- Memory ----
  app.post('/api/v1/assistant/catch-me-up', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.body as any;
    const user = (request as any).user;
    const result = await catchMeUp(engagementId, user.userId);
    return reply.send(result);
  });

  app.get('/api/v1/assistant/memory/:engagementId', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const user = (request as any).user;
    const memory = await buildMemoryContext(engagementId, user.userId);
    return reply.send({ memory });
  });

  // ---- Team ----
  app.get('/api/v1/assistant/team/:engagementId', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const result = await getTeamContext(engagementId);
    return reply.send(result);
  });

  // ---- Work Products ----
  app.post('/api/v1/assistant/generate-report', { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const result = await generateFullReport(body);
    return reply.send(result);
  });

  app.post('/api/v1/assistant/generate-assurance-pack', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.body as any;
    const result = await generateAssurancePack(engagementId);
    return reply.send(result);
  });

  app.post('/api/v1/assistant/generate-executive-summary', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.body as any;
    const result = await generateExecutiveSummary(engagementId);
    return reply.send(result);
  });

  // ---- Learning ----
  app.post('/api/v1/assistant/learn/edit', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, originalDraft, editedVersion } = request.body as any;
    const user = (request as any).user;
    const result = await processEditSignal(engagementId, user.userId, originalDraft, editedVersion);
    return reply.send(result);
  });

  app.post('/api/v1/assistant/learn/accept', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.body as any;
    const user = (request as any).user;
    const result = await processAcceptSignal(engagementId, user.userId);
    return reply.send(result);
  });

  app.post('/api/v1/assistant/learn/reject', { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, reason } = request.body as any;
    const user = (request as any).user;
    const result = await processRejectSignal(engagementId, user.userId, reason);
    return reply.send(result);
  });

  // ---- Actions ----
  app.post('/api/v1/assistant/action', { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const user = (request as any).user;
    const result = await executeAction({
      engagementId: body.engagementId,
      userId: user.userId,
      action: body.action,
      params: body.params,
    });
    return reply.send(result);
  });

  // ---- Metrics ----
  app.get('/api/v1/assistant/metrics', { preHandler: [authenticate] }, async (_request, reply) => {
    const metrics = await getDailyMetrics();
    return reply.send({ metrics });
  });
}
