import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { logger } from './lib/logger.js';
import { connectDB } from './lib/db.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { registerOrganizationRoutes } from './modules/organization/organization.routes.js';
import { registerIngestionRoutes } from './modules/ingestion/ingestion.routes.js';
import { registerFrameworkRoutes } from './modules/framework/framework.routes.js';
import { registerDataCollectionRoutes } from './modules/data-collection/data-collection.routes.js';
import { registerCalculationRoutes } from './modules/calculation/calculation.routes.js';
import { registerAgentRoutes } from './modules/agent/agent.routes.js';
import { registerSharePointRoutes } from './modules/sharepoint/sharepoint.routes.js';
import { registerReportRoutes } from './modules/report/report.routes.js';
import { registerPresentationRoutes } from './modules/presentation/presentation.routes.js';
import { registerQARoutes } from './modules/qa/qa.routes.js';
import { registerAssuranceRoutes } from './modules/assurance/assurance.routes.js';
import { registerWorkflowRoutes } from './modules/workflow/workflow.routes.js';
import { registerKnowledgeBaseRoutes } from './modules/knowledge-base/knowledge-base.routes.js';

// 6-Product Service Layer
import { registerAssistantRoutes } from './services/assistant/assistant.router.js';
import { registerKnowledgeServiceRoutes } from './services/knowledge/knowledge.router.js';
import { registerVerificationRoutes } from './services/verification/verification.router.js';
import { registerVaultRoutes } from './services/vault/vault.router.js';
import { registerWorkflowServiceRoutes } from './services/workflows/workflows.router.js';
import { registerKBElevationRoutes } from './services/knowledge/elevation.router.js';
import { registerScaffoldingRoutes } from './services/scaffolding/scaffolding.routes.js';

const FEATURES = {
  sharepoint: true,
  teamsBot: false,
};

const app = Fastify({
  logger: false,
});

async function start() {
  await connectDB();

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(websocket);

  // Serve Office add-in static files
  const addinsRoot = path.resolve(__dirname, '../../office-addins');

  await app.register(fastifyStatic, {
    root: path.join(addinsRoot, 'excel/dist'),
    prefix: '/addins/excel/',
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: path.join(addinsRoot, 'word/dist'),
    prefix: '/addins/word/',
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: path.join(addinsRoot, 'powerpoint/dist'),
    prefix: '/addins/powerpoint/',
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: path.join(addinsRoot, 'outlook/dist'),
    prefix: '/addins/outlook/',
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: path.resolve(__dirname, '../public/addins/assets'),
    prefix: '/addins/assets/',
    decorateReply: false,
  });

  // Health check — public, no auth required
  app.get('/api/v1/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString(), version: '0.1.0' });
  });

  // Register auth routes
  await registerAuthRoutes(app);

  // Register organization routes
  await registerOrganizationRoutes(app);

  // Register ingestion routes
  await registerIngestionRoutes(app);

  // Register framework engine routes
  await registerFrameworkRoutes(app);

  // Register data collection routes
  await registerDataCollectionRoutes(app);

  // Register calculation engine routes
  await registerCalculationRoutes(app);

  // Register AI agent routes
  await registerAgentRoutes(app);

  // Register SharePoint connector routes
  await registerSharePointRoutes(app);

  // Register report builder routes
  await registerReportRoutes(app);

  // Register presentation generator routes
  await registerPresentationRoutes(app);

  // Register QA consistency engine routes
  await registerQARoutes(app);

  // Register assurance evidence pack routes
  await registerAssuranceRoutes(app);

  // Register workflow engine routes
  await registerWorkflowRoutes(app);

  // Register knowledge base ingestion routes
  await registerKnowledgeBaseRoutes(app);

  // ---- 6-Product Service Layer ----
  await registerAssistantRoutes(app);
  await registerKnowledgeServiceRoutes(app);
  await registerVerificationRoutes(app);
  await registerVaultRoutes(app);
  await registerWorkflowServiceRoutes(app);

  // KB Elevation Engine — gap tracking, coverage, enrichment queue
  await registerKBElevationRoutes(app);

  // Phase G placeholder routes for hardcoded Plan 5 pages
  await registerScaffoldingRoutes(app);

  const port = parseInt(process.env['PORT'] || '3001', 10);

  try {
    await app.listen({ port, host: '0.0.0.0' });
    logger.info(`Merris API running on port ${port}`);
    logger.info(`Feature flags: ${JSON.stringify(FEATURES)}`);
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

start();

export { app };
