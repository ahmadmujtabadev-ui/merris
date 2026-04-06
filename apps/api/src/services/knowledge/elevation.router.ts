import { FastifyInstance } from 'fastify';
import { authenticate } from '../../modules/auth/auth.middleware.js';
import { getTopGaps, getGapStats } from './gap-tracker.js';
import { ensureCountryCoverage, getAllCountryCoverage } from './country-coverage.js';
import { getPendingTasks, getQueueStats } from './enrichment-queue.js';

export async function registerKBElevationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/knowledge/gaps', { preHandler: [authenticate] }, async (request, reply) => {
    const { domain, country, limit } = request.query as { domain?: string; country?: string; limit?: string };
    const gaps = await getTopGaps({ domain, country, limit: limit ? parseInt(limit) : undefined });
    return reply.send({ gaps });
  });

  app.get('/api/v1/knowledge/gaps/stats', { preHandler: [authenticate] }, async (_request, reply) => {
    const stats = await getGapStats();
    return reply.send(stats);
  });

  app.get('/api/v1/knowledge/coverage/:countryCode', { preHandler: [authenticate] }, async (request, reply) => {
    const { countryCode } = request.params as { countryCode: string };
    const coverage = await ensureCountryCoverage(countryCode);
    return reply.send(coverage);
  });

  app.get('/api/v1/knowledge/coverage', { preHandler: [authenticate] }, async (_request, reply) => {
    const coverage = await getAllCountryCoverage();
    return reply.send({ countries: coverage, total: coverage.length });
  });

  app.get('/api/v1/knowledge/queue', { preHandler: [authenticate] }, async (_request, reply) => {
    const tasks = await getPendingTasks();
    const stats = await getQueueStats();
    return reply.send({ tasks, stats });
  });
}
