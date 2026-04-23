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

export async function registerScaffoldingRoutes(app: FastifyInstance): Promise<void> {
  // ----- Knowledge collections (real counts) -----
  app.get(
    '/api/v1/knowledge-base/collections',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      const [c1, c2, c3, c4, c5, c6, c7, cReports] = await Promise.all([
        CorporateDisclosureModel.countDocuments(),
        ClimateScienceModel.countDocuments(),
        RegulatoryModel.countDocuments(),
        SustainableFinanceModel.countDocuments(),
        EnvironmentalScienceModel.countDocuments(),
        SupplyChainModel.countDocuments(),
        ResearchModel.countDocuments(),
        KnowledgeReportModel.countDocuments(),
      ]);
      return reply.send({
        seeded: true,
        collections: [
          // K1 includes both the catalog entries + fully ingested reports
          { id: 'K1', name: 'Corporate Disclosures', count: c1 + cReports },
          { id: 'K2', name: 'Market Analysis',       count: c2 },
          { id: 'K3', name: 'Regulatory',            count: c3 },
          { id: 'K4', name: 'Sustainable Finance',   count: c4 },
          { id: 'K5', name: 'Peer Benchmarks',       count: c5 },
          { id: 'K6', name: 'Climate Science',       count: c6 },
          { id: 'K7', name: 'Research',              count: c7 },
        ],
      });
    },
  );

  // ----- Framework compliance for an engagement -----
  app.get<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/framework-compliance',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      return reply.send({
        seeded: false,
        compliance: [
          { code: 'GRI 2024', percent: 72 },
          { code: 'TCFD',     percent: 58 },
          { code: 'ISSB',     percent: 31 },
          { code: 'EU Tax',   percent: 44 },
        ],
        disclosureMatrix: [
          { requirement: 'Scope 1 & 2 GHG', framework: 'GRI 305',   status: 'Partial',     coverage: '65%' },
          { requirement: 'Climate Risk',    framework: 'TCFD',      status: 'Complete',    coverage: '100%' },
          { requirement: 'Board Oversight', framework: 'ISSB',      status: 'Gap',         coverage: '20%' },
          { requirement: 'Taxonomy Revenue',framework: 'EU Tax',    status: 'Not Started', coverage: '0%' },
          { requirement: 'Water',           framework: 'GRI 303',   status: 'Partial',     coverage: '45%' },
          { requirement: 'Supply Chain DD', framework: 'CSRD',      status: 'In Progress', coverage: '55%' },
        ],
      });
    },
  );

  // ----- Aggregate findings for an engagement -----
  app.get<{ Params: { id: string } }>(
    '/api/v1/engagements/:id/findings',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      return reply.send({
        seeded: false,
        findings: [
          { id: 'p1', severity: 'CRITICAL', ref: 'GRI 305-1', title: 'Mismatched Direct Emissions',  description: 'Scope 1 (14,200t) ≠ facility sum (15,840t).' },
          { id: 'p2', severity: 'IMPORTANT', ref: 'G2.1',     title: 'Vague Board Oversight',        description: 'Missing Climate Risk Subcommittee.' },
          { id: 'p3', severity: 'MINOR',    ref: 'Format',    title: 'Missing Appendix Link',        description: 'App-D reference broken.' },
        ],
      });
    },
  );

  // ----- Assistant history (real conversation_memories) -----
  app.get(
    '/api/v1/assistant/history',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = (request as any).user;
      const engagementId = (request.query as any)['engagementId'];

      const filter: Record<string, any> = { userId: new mongoose.Types.ObjectId(user.userId) };
      if (engagementId) filter['engagementId'] = new mongoose.Types.ObjectId(engagementId);

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
          .find({ _id: { $in: engagementIds.map((id: string) => new mongoose.Types.ObjectId(id)) } })
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
