// src/services/workflows/workflows.router.ts

import { FastifyInstance } from "fastify";
import { authenticate } from "../../modules/auth/auth.middleware.js";
import {
  listTemplates,
  getTemplate,
  runWorkflow,
  getExecution,
  listExecutions,
} from "./workflows.service.js";

export async function registerWorkflowServiceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/workflows/templates", { preHandler: [authenticate] }, async (_request, reply) => {
    const templates = listTemplates();
    return reply.send({ templates });
  });

  app.get("/api/v1/workflows/templates/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const template = getTemplate(id);
    if (!template) return reply.code(404).send({ error: "Template not found" });
    return reply.send(template);
  });

  app.post("/api/v1/workflows/:templateId/run", { preHandler: [authenticate] }, async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const { engagementId, inputs } = request.body as { engagementId: string; inputs?: Record<string, unknown> };
    const execution = await runWorkflow(templateId, engagementId, inputs || {});
    return reply.send(execution);
  });

  app.get("/api/v1/workflows/:id/status", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const execution = getExecution(id);
    if (!execution) return reply.code(404).send({ error: "Execution not found" });
    return reply.send(execution);
  });

  app.get("/api/v1/workflows/history", { preHandler: [authenticate] }, async (_request, reply) => {
    const executions = listExecutions();
    return reply.send({ executions });
  });
}
