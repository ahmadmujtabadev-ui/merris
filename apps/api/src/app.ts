import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
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
import { registerAssistantRoutes } from './services/assistant/assistant.router.js';
import { registerKnowledgeServiceRoutes } from './services/knowledge/knowledge.router.js';
import { registerVerificationRoutes } from './services/verification/verification.router.js';
import { registerVaultRoutes } from './services/vault/vault.router.js';
import { registerWorkflowServiceRoutes } from './services/workflows/workflows.router.js';
import { registerKBElevationRoutes } from './services/knowledge/elevation.router.js';
import { registerScaffoldingRoutes } from './services/scaffolding/scaffolding.routes.js';
import { registerAnnotationRoutes } from './services/annotations/annotations.routes.js';
import { connectDB } from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env['VERCEL']) {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

const FEATURES = {
  sharepoint: true,
  teamsBot: false,
};

let appPromise: Promise<FastifyInstance> | null = null;

async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Vercel serverless functions do not support websocket upgrades.
  if (!process.env['VERCEL']) {
    await app.register(websocket);
  }

  // Serve Office add-in static files when they exist in the deployment bundle.
  const addinsRoot = path.resolve(__dirname, '../../office-addins');
  const staticRoots = [
    { root: path.join(addinsRoot, 'excel/dist'), prefix: '/addins/excel/' },
    { root: path.join(addinsRoot, 'word/dist'), prefix: '/addins/word/' },
    { root: path.join(addinsRoot, 'powerpoint/dist'), prefix: '/addins/powerpoint/' },
    { root: path.join(addinsRoot, 'outlook/dist'), prefix: '/addins/outlook/' },
    { root: path.resolve(__dirname, '../public/addins/assets'), prefix: '/addins/assets/' },
  ];

  for (const entry of staticRoots) {
    if (!fs.existsSync(entry.root)) continue;

    await app.register(fastifyStatic, {
      root: entry.root,
      prefix: entry.prefix,
      decorateReply: false,
    });
  }

  app.get('/api/v1/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      deployment: process.env['VERCEL'] ? 'vercel' : 'server',
    });
  });

  await registerAuthRoutes(app);
  await registerOrganizationRoutes(app);
  await registerIngestionRoutes(app);
  await registerFrameworkRoutes(app);
  await registerDataCollectionRoutes(app);
  await registerCalculationRoutes(app);
  await registerAgentRoutes(app);
  await registerSharePointRoutes(app);
  await registerReportRoutes(app);
  await registerPresentationRoutes(app);
  await registerQARoutes(app);
  await registerAssuranceRoutes(app);
  await registerWorkflowRoutes(app);
  await registerKnowledgeBaseRoutes(app);
  await registerAssistantRoutes(app);
  await registerKnowledgeServiceRoutes(app);
  await registerVerificationRoutes(app);
  await registerVaultRoutes(app);
  await registerWorkflowServiceRoutes(app);
  await registerKBElevationRoutes(app);
  await registerScaffoldingRoutes(app);
  await registerAnnotationRoutes(app);
}

export async function buildApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = (async () => {
      await connectDB();

      const app = Fastify({
        logger: false,
      });

      await registerRoutes(app);
      await app.ready();
      return app;
    })();
  }

  return appPromise;
}

export { FEATURES };
