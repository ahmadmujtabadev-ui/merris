// src/services/scaffolding/scaffolding.routes.ts

import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { authenticate } from '../../modules/auth/auth.middleware.js';
import { ConversationMemoryModel } from '../../models/memory.model.js';
import {
  CorporateDisclosureModel,
  ClimateScienceModel,
  RegulatoryModel,
  SustainableFinanceModel,
  EnvironmentalScienceModel,
  SupplyChainModel,
  ResearchModel,
} from '../../models/knowledge-base.model.js';
import { KnowledgeReportModel } from '../../models/knowledge-report.model.js';
import { DataPointModel } from '../../modules/ingestion/ingestion.model.js';
import { getDenseEmbeddingStats } from '../../modules/knowledge-base/dense-search.service.js';

export async function registerScaffoldingRoutes(app: FastifyInstance): Promise<void> {
  // Module → K-domain mapping for dense embeddings (M01-M14 → K1-K7).
  // Sequential grouping: two modules per domain.
  const MODULE_K_MAP: Record<string, string> = {
    M01: 'K1', M02: 'K1',
    M03: 'K2', M04: 'K2',
    M05: 'K3', M06: 'K3',
    M07: 'K4', M08: 'K4',
    M09: 'K5', M10: 'K5',
    M11: 'K6', M12: 'K6',
    M13: 'K7', M14: 'K7',
  };

  function moduleToK(moduleName: string): string {
    // moduleName may be "M01", "M01-regulatory", etc.
    const prefix = moduleName.match(/^(M\d{2})/)?.[1] ?? '';
    return MODULE_K_MAP[prefix] ?? 'K7';
  }

  // ----- Knowledge collections (model counts + dense embedding counts) -----
  app.get(
    '/api/v1/knowledge-base/collections',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      const [c1, c2, c3, c4, c5, c6, c7, cReports, denseStats] = await Promise.all([
        CorporateDisclosureModel.countDocuments(),
        ClimateScienceModel.countDocuments(),
        RegulatoryModel.countDocuments(),
        SustainableFinanceModel.countDocuments(),
        EnvironmentalScienceModel.countDocuments(),
        SupplyChainModel.countDocuments(),
        ResearchModel.countDocuments(),
        KnowledgeReportModel.countDocuments(),
        getDenseEmbeddingStats(),
      ]);

      // Sum dense embedding chunks per K-domain
      const denseCounts: Record<string, number> = { K1: 0, K2: 0, K3: 0, K4: 0, K5: 0, K6: 0, K7: 0 };
      for (const [mod, cnt] of Object.entries(denseStats)) {
        const k = moduleToK(mod);
        denseCounts[k] = (denseCounts[k] ?? 0) + cnt;
      }

      const totalDense = Object.values(denseCounts).reduce((a, b) => a + b, 0);
      const seeded = c1 + c2 + c3 + c4 + c5 + c6 + c7 + cReports + totalDense > 0;

      return reply.send({
        seeded,
        collections: [
          { id: 'K1', name: 'Corporate Disclosures', count: c1 + cReports + (denseCounts['K1'] ?? 0) },
          { id: 'K2', name: 'Market Analysis',       count: c2 + (denseCounts['K2'] ?? 0) },
          { id: 'K3', name: 'Regulatory',            count: c3 + (denseCounts['K3'] ?? 0) },
          { id: 'K4', name: 'Sustainable Finance',   count: c4 + (denseCounts['K4'] ?? 0) },
          { id: 'K5', name: 'Peer Benchmarks',       count: c5 + (denseCounts['K5'] ?? 0) },
          { id: 'K6', name: 'Climate Science',       count: c6 + (denseCounts['K6'] ?? 0) },
          { id: 'K7', name: 'Research',              count: c7 + (denseCounts['K7'] ?? 0) },
        ],
      });
    },
  );

  // ----- Framework compliance for an engagement (real data from DataPoints) -----
  app.get<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/framework-compliance',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const engId = request.params.id;
      let engObjId: mongoose.Types.ObjectId;
      try {
        engObjId = new (mongoose.Types.ObjectId as any)(engId);
      } catch {
        return reply.send({ seeded: false, compliance: [], disclosureMatrix: [] });
      }

      const dataPoints = await DataPointModel.find({ engagementId: engObjId })
        .select('frameworkRef metricName status confidence')
        .lean();

      if (dataPoints.length === 0) {
        return reply.send({ seeded: false, compliance: [], disclosureMatrix: [] });
      }

      // Map frameworkRef prefix → display label
      const FW_LABELS: Record<string, string> = {
        GRI: 'GRI', TCFD: 'TCFD', ISSB: 'ISSB', CSRD: 'CSRD',
        SASB: 'SASB', IFRS: 'IFRS', EU: 'EU Taxonomy',
        PARIS: 'Paris Agreement', REGULATION: 'EU Regulation',
        UNCLASSIFIED: 'Unclassified', CDP: 'CDP', TNFD: 'TNFD',
        SDG: 'SDGs', SDGS: 'SDGs', SFDR: 'SFDR', ESRS: 'ESRS',
        UN: 'UN Framework', ISO: 'ISO Standard', SEC: 'SEC',
      };
      const CONFIRMED = new Set(['user_confirmed', 'user_edited', 'estimated']);

      function fwLabel(ref: string): string {
        const upper = ref.toUpperCase();
        // Try direct lookup first (e.g. "UNCLASSIFIED")
        if (FW_LABELS[upper]) return FW_LABELS[upper];
        // Try first word (e.g. "PARIS AGREEMENT" → "PARIS")
        const firstWord = upper.split(/[\s-]/)[0] ?? upper;
        return FW_LABELS[firstWord] ?? (ref.length > 30 ? ref.slice(0, 28) + '…' : ref);
      }

      // Group by framework
      const fwMap = new Map<string, { total: number; confirmed: number }>();
      for (const dp of dataPoints) {
        const label = fwLabel(dp.frameworkRef);
        if (!fwMap.has(label)) fwMap.set(label, { total: 0, confirmed: 0 });
        const entry = fwMap.get(label)!;
        entry.total++;
        if (CONFIRMED.has(dp.status)) entry.confirmed++;
      }

      const compliance = Array.from(fwMap.entries()).map(([code, { total, confirmed }]) => ({
        code,
        percent: total > 0 ? Math.round((confirmed / total) * 100) : 0,
      }));

      // Disclosure matrix — one row per unique metric
      const STATUS_MAP: Record<string, string> = {
        user_confirmed: 'Complete',
        user_edited:    'Complete',
        estimated:      'Partial',
        auto_extracted: 'In Progress',
        missing:        'Gap',
      };
      const seen = new Map<string, typeof dataPoints[number]>();
      for (const dp of dataPoints) {
        const key = `${dp.frameworkRef}::${dp.metricName}`;
        if (!seen.has(key)) seen.set(key, dp);
      }

      const disclosureMatrix = Array.from(seen.values()).slice(0, 20).map((dp) => {
        const confirmed = CONFIRMED.has(dp.status);
        return {
          requirement: dp.metricName,
          framework:   dp.frameworkRef.split('-').slice(0, 2).join('-'),
          status:      STATUS_MAP[dp.status] ?? 'Not Started',
          coverage:    confirmed ? '100%' : dp.status === 'auto_extracted' ? '50%' : '0%',
        };
      });

      return reply.send({ seeded: true, compliance, disclosureMatrix });
    },
  );

  // ----- Aggregate findings for an engagement (real data from DataPoints) -----
  app.get<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/findings',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const engId = request.params.id;
      let engObjId: mongoose.Types.ObjectId;
      try {
        engObjId = new (mongoose.Types.ObjectId as any)(engId);
      } catch {
        return reply.send({ seeded: false, findings: [] });
      }

      const dataPoints = await DataPointModel.find({ engagementId: engObjId })
        .select('frameworkRef metricName status confidence')
        .lean();

      if (dataPoints.length === 0) {
        return reply.send({ seeded: false, findings: [] });
      }

      const findings: Array<{
        id: string; severity: string; ref: string; title: string; description: string;
      }> = [];

      // CRITICAL: missing data points
      const missing = dataPoints.filter((dp) => dp.status === 'missing');
      for (const dp of missing.slice(0, 5)) {
        findings.push({
          id:          `f-miss-${dp._id}`,
          severity:    'CRITICAL',
          ref:         dp.frameworkRef,
          title:       `Missing: ${dp.metricName}`,
          description: `No value recorded for ${dp.metricName} (${dp.frameworkRef}). This metric is required for disclosure.`,
        });
      }

      // IMPORTANT: low-confidence auto-extracted (not yet reviewed)
      const lowConf = dataPoints.filter((dp) => dp.confidence === 'low' && dp.status === 'auto_extracted');
      for (const dp of lowConf.slice(0, 5)) {
        findings.push({
          id:          `f-conf-${dp._id}`,
          severity:    'IMPORTANT',
          ref:         dp.frameworkRef,
          title:       `Low Confidence: ${dp.metricName}`,
          description: `AI-extracted value for ${dp.metricName} has low confidence and needs manual review.`,
        });
      }

      // MINOR: auto-extracted but not user-confirmed
      const unreviewed = dataPoints.filter(
        (dp) => dp.status === 'auto_extracted' && dp.confidence !== 'low'
      );
      if (unreviewed.length > 0) {
        findings.push({
          id:          'f-review-bulk',
          severity:    'MINOR',
          ref:         'General',
          title:       `${unreviewed.length} metrics pending review`,
          description: `${unreviewed.length} auto-extracted data points have not been confirmed. Review and confirm to improve reporting confidence.`,
        });
      }

      return reply.send({ seeded: true, findings });
    },
  );

  // ----- Assistant history (real conversation_memories) -----
  app.get(
    '/api/v1/assistant/history',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = (request as any).user;
      const engagementId = (request.query as any)['engagementId'];

      const filter: Record<string, any> = { userId: new (mongoose.Types.ObjectId as any)(user.userId) };
      if (engagementId) filter['engagementId'] = new (mongoose.Types.ObjectId as any)(engagementId);

      const memories = await ConversationMemoryModel
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      // Enrich with engagement name if available
      const db = mongoose.connection.db;
      const engagementIds = [...new Set(
        memories.map((m: any) => m.engagementId?.toString()).filter((id): id is string => Boolean(id))
      )];
      const engNameMap: Record<string, string> = {};
      if (db && engagementIds.length > 0) {
        const engs = await db.collection('engagements')
          .find({ _id: { $in: engagementIds.map((id: string) => new (mongoose.Types.ObjectId as any)(id)) } })
          .project({ name: 1 })
          .toArray();
        for (const e of engs) engNameMap[e._id.toString()] = e.name;
      }

      const history = memories.map((m: any) => ({
        id: (m._id as any).toString(),
        text: m.userMessage,
        answer: m.agentResponse,
        engagementId: m.engagementId?.toString(),
        engagement: engNameMap[m.engagementId?.toString() ?? ''] ?? null,
        toolsUsed: m.toolsUsed ?? [],
        timestamp: m.timestamp ?? (m as any).createdAt,
      }));

      return reply.send({ seeded: true, history });
    },
  );

  // ----- Team members for the user's org -----
  app.get(
    '/api/v1/team',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      return reply.send({
        seeded: false,
        members: [
          { id: 't1', name: 'Alex Thorne',  role: 'Admin',         status: 'Active' },
          { id: 't2', name: 'Elena Vance',  role: 'Lead Analyst',  status: 'Active' },
          { id: 't3', name: 'David Chen',   role: 'Data Analyst',  status: 'Active' },
          { id: 't4', name: 'Sana Khan',    role: 'Field Auditor', status: 'Pending' },
        ],
      });
    },
  );

  // ----- User preferences -----
  app.get(
    '/api/v1/preferences',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      return reply.send({
        seeded: false,
        preferences: {
          primarySector: 'Renewable Energy',
          language: 'EN / AR',
          notifications: 'Email + Dashboard',
        },
      });
    },
  );

  // ----- Billing summary -----
  app.get(
    '/api/v1/billing',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      return reply.send({
        seeded: false,
        billing: {
          plan: 'Merris Enterprise',
          computeCredits: '12,450 / 50k',
          nextRenewal: 'Oct 12, 2026',
          paymentLast4: '4242',
        },
      });
    },
  );
}
