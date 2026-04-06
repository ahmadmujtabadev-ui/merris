// src/services/knowledge/knowledge.router.ts

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../modules/auth/auth.middleware.js';
import {
  searchWithEvidence,
  searchRegulatory,
  searchScientific,
  searchPeer,
  searchSupplyChain,
} from './knowledge.service.js';
import {
  getGCCRegulations,
  getEURegulations,
  getUSRegulations,
  getAPACRegulations,
} from './regional.service.js';
import { benchmarkMetric } from './benchmark.service.js';

export async function registerKnowledgeServiceRoutes(app: FastifyInstance): Promise<void> {
  // Unified search
  app.post('/api/v1/knowledge/search', { preHandler: [authenticate] }, async (request, reply) => {
    const { query, domains, limit } = request.body as any;
    const result = await searchWithEvidence(query, { domains, limit });
    return reply.send(result);
  });

  // Regulatory search
  app.post('/api/v1/knowledge/regulatory', { preHandler: [authenticate] }, async (request, reply) => {
    const { jurisdiction, topic, limit } = request.body as any;
    const result = await searchRegulatory(jurisdiction, topic, { limit });
    return reply.send(result);
  });

  // Scientific search
  app.post('/api/v1/knowledge/scientific', { preHandler: [authenticate] }, async (request, reply) => {
    const { query, limit } = request.body as any;
    const result = await searchScientific(query, { limit });
    return reply.send(result);
  });

  // Peer search
  app.post('/api/v1/knowledge/peer', { preHandler: [authenticate] }, async (request, reply) => {
    const { sector, metric, limit } = request.body as any;
    const result = await searchPeer(sector, metric, { limit });
    return reply.send(result);
  });

  // Supply chain search
  app.post('/api/v1/knowledge/supply-chain', { preHandler: [authenticate] }, async (request, reply) => {
    const { query, limit } = request.body as any;
    const result = await searchSupplyChain(query, { limit });
    return reply.send(result);
  });

  // ── Regional regulation routes ──────────────────────────────

  app.post('/api/v1/knowledge/regional/gcc', { preHandler: [authenticate] }, async (request, reply) => {
    const { topic } = request.body as any;
    const result = await getGCCRegulations(topic);
    return reply.send(result);
  });

  app.post('/api/v1/knowledge/regional/eu', { preHandler: [authenticate] }, async (request, reply) => {
    const { topic } = request.body as any;
    const result = await getEURegulations(topic);
    return reply.send(result);
  });

  app.post('/api/v1/knowledge/regional/us', { preHandler: [authenticate] }, async (request, reply) => {
    const { topic } = request.body as any;
    const result = await getUSRegulations(topic);
    return reply.send(result);
  });

  app.post('/api/v1/knowledge/regional/apac', { preHandler: [authenticate] }, async (request, reply) => {
    const { topic } = request.body as any;
    const result = await getAPACRegulations(topic);
    return reply.send(result);
  });

  // ── Benchmark routes ───────────────────────────────────────

  app.post('/api/v1/knowledge/benchmark/metric', { preHandler: [authenticate] }, async (request, reply) => {
    const { metric, sector, yourValue } = request.body as any;
    const result = await benchmarkMetric(metric, sector, yourValue);
    return reply.send(result);
  });

  // Sources metadata
  app.get('/api/v1/knowledge/sources', { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.send({
      domains: [
        { code: 'K1', name: 'Corporate Disclosures', collection: 'kb_corporate_disclosures' },
        { code: 'K2', name: 'Climate Science', collection: 'kb_climate_science' },
        { code: 'K3', name: 'Regulatory', collection: 'kb_regulatory' },
        { code: 'K4', name: 'Sustainable Finance', collection: 'kb_sustainable_finance' },
        { code: 'K5', name: 'Environmental Science', collection: 'kb_environmental_science' },
        { code: 'K6', name: 'Supply Chain', collection: 'kb_supply_chain' },
        { code: 'K7', name: 'Research', collection: 'kb_research' },
      ],
    });
  });
}
