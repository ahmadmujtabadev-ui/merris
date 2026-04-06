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

  // ----- Builder: generate steps from a natural-language description -----
  app.post<{ Body: { description: string } }>(
    '/api/v1/workflows/builder/generate-steps',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { description } = request.body;
      if (!description || description.trim().length < 10) {
        return reply.code(400).send({ error: 'description must be at least 10 characters' });
      }
      // Phase J stub: returns a deterministic 5-step plan based on heuristics.
      // Real generation would call the agent module to plan steps from the
      // description. Filed as a follow-up.
      const lower = description.toLowerCase();
      const includes = (kw: string) => lower.includes(kw);
      const steps = [
        { id: 'ingest',     name: 'Document analysis',    description: 'Ingest reports, extract ESG KPIs.', tool: 'perceive_document' },
        { id: 'frameworks', name: 'Framework mapping',    description: includes('csrd') || includes('esrs') ? 'Align against ESRS & GRI.' : 'Map to applicable framework standards.', tool: 'detect_frameworks' },
        { id: 'gaps',       name: 'Gap identification',   description: includes('scope 3') ? 'Flag missing Scope 3 metrics.' : 'Flag missing disclosures and metrics.', tool: 'verify_compliance' },
        { id: 'risk',       name: 'Risk categorization',  description: 'Prioritize by legal exposure.', tool: 'judge_document' },
        { id: 'remediation',name: 'Remediation pathing',  description: 'Generate response steps.', tool: 'generate_text' },
      ];
      return reply.send({ steps });
    },
  );
}
