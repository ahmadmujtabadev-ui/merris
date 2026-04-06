// src/services/scaffolding/scaffolding.routes.ts
//
// Phase G placeholder routes. These exist so the web client has a real
// HTTP endpoint to call, but the data they return is hardcoded
// scaffolding. The `seeded: false` flag in every response signals to
// callers that this is not real data — replace the data source in a
// future plan.

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../modules/auth/auth.middleware.js';

export async function registerScaffoldingRoutes(app: FastifyInstance): Promise<void> {
  // ----- Knowledge collections -----
  app.get(
    '/api/v1/knowledge-base/collections',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      return reply.send({
        seeded: false,
        collections: [
          { id: 'K1', name: 'Corporate Disclosures', count: 613 },
          { id: 'K2', name: 'Market Analysis',       count: 84 },
          { id: 'K3', name: 'Regulatory',            count: 42 },
          { id: 'K4', name: 'Sustainable Finance',   count: 27 },
          { id: 'K5', name: 'Peer Benchmarks',       count: 156 },
          { id: 'K6', name: 'Climate Science',       count: 39 },
          { id: 'K7', name: 'Research',              count: 312 },
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

  // ----- Assistant history -----
  app.get(
    '/api/v1/assistant/history',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      return reply.send({
        seeded: false,
        history: [
          { id: 'h1', text: 'Frameworks for listed steel in Oman?',  engagement: 'AJSS',  confidence: 'High',   time: '2h' },
          { id: 'h2', text: 'Review sustainability report',          engagement: 'QAPCO', findings: 15,         time: 'Yesterday' },
          { id: 'h3', text: 'Verify Scope 2 of 148k tCO2e',          engagement: 'AJSS',  confidence: 'Medium', time: 'Yesterday' },
          { id: 'h4', text: 'Assess CBAM exposure',                  engagement: 'QAPCO', confidence: 'Medium', time: '3d ago' },
        ],
      });
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
