// src/services/workflows/workflows.router.ts

import { FastifyInstance } from "fastify";
import { authenticate } from "../../modules/auth/auth.middleware.js";
import {
  listTemplates,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  runWorkflow,
  getExecution,
  listExecutions,
  type WorkflowTemplate,
} from "./workflows.service.js";
import {
  runReActAgent,
  getReActExecution,
  listReActExecutions,
} from "./react-engine.js";
import { sendMessage } from "../../lib/claude.js";
import { logger } from "../../lib/logger.js";

const VALID_TOOLS = [
  "perceive_document", "detect_frameworks", "search_knowledge",
  "verify_compliance", "generate_text", "judge_document",
  "benchmark", "calculate",
];

export async function registerWorkflowServiceRoutes(app: FastifyInstance): Promise<void> {

  // ── List templates ──────────────────────────────────────────
  app.get("/api/v1/workflows/templates", { preHandler: [authenticate] }, async (_request, reply) => {
    const templates = listTemplates();
    return reply.send({ templates });
  });

  // ── Get one template ────────────────────────────────────────
  app.get("/api/v1/workflows/templates/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const template = getTemplate(id);
    if (!template) return reply.code(404).send({ error: "Template not found" });
    return reply.send(template);
  });

  // ── Save / publish custom template ─────────────────────────
  app.post("/api/v1/workflows/templates", { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as Partial<WorkflowTemplate> & { name?: string };
    if (!body.name || !body.steps || !Array.isArray(body.steps)) {
      return reply.code(400).send({ error: "name and steps are required" });
    }
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const template: WorkflowTemplate = {
      id: body.id ?? `custom-${slug}-${Date.now()}`,
      name: body.name,
      description: body.description ?? "",
      category: body.category ?? "Custom",
      steps: body.steps,
      ...(body.graph ? { graph: body.graph } : {}),
    };
    saveTemplate(template);
    logger.info(`Saved workflow template: ${template.id}`);
    return reply.code(201).send(template);
  });

  // ── Delete a template ────────────────────────────────────────
  app.delete("/api/v1/workflows/templates/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ok = deleteTemplate(id);
    if (!ok) return reply.code(404).send({ error: "Template not found" });
    return reply.send({ deleted: true });
  });

  // ── Run a template ───────────────────────────────────────────
  app.post("/api/v1/workflows/:templateId/run", { preHandler: [authenticate] }, async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const { engagementId, inputs } = request.body as { engagementId: string; inputs?: Record<string, unknown> };
    const execution = await runWorkflow(templateId, engagementId, inputs || {});
    return reply.send(execution);
  });

  // ── Execution status + results ───────────────────────────────
  app.get("/api/v1/workflows/:id/status", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const execution = getExecution(id);
    if (!execution) return reply.code(404).send({ error: "Execution not found" });
    return reply.send(execution);
  });

  // ── History ──────────────────────────────────────────────────
  app.get("/api/v1/workflows/history", { preHandler: [authenticate] }, async (_request, reply) => {
    const executions = listExecutions();
    return reply.send({ executions });
  });

  // ── ReAct agent run ──────────────────────────────────────────
  app.post("/api/v1/workflows/react/run", { preHandler: [authenticate] }, async (request, reply) => {
    const { templateId, engagementId, inputs } = request.body as {
      templateId: string;
      engagementId: string;
      inputs?: Record<string, unknown>;
    };
    if (!templateId || !engagementId) {
      return reply.code(400).send({ error: "templateId and engagementId are required" });
    }
    try {
      const execution = await runReActAgent(templateId, engagementId, inputs ?? {});
      return reply.send(execution);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return reply.code(500).send({ error: msg });
    }
  });

  // ── ReAct execution status ────────────────────────────────────
  app.get("/api/v1/workflows/react/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const execution = getReActExecution(id);
    if (!execution) return reply.code(404).send({ error: "ReAct execution not found" });
    return reply.send(execution);
  });

  // ── ReAct history ─────────────────────────────────────────────
  app.get("/api/v1/workflows/react/history", { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.send({ executions: listReActExecutions() });
  });

  // ── Generate steps with Claude ───────────────────────────────
  app.post<{ Body: { description: string; jurisdiction?: string; frameworks?: string } }>(
    "/api/v1/workflows/builder/generate-steps",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { description, jurisdiction, frameworks } = request.body;
      if (!description || description.trim().length < 10) {
        return reply.code(400).send({ error: "description must be at least 10 characters" });
      }

      const context = [
        jurisdiction && `Jurisdiction: ${jurisdiction}`,
        frameworks && `Frameworks: ${frameworks}`,
      ].filter(Boolean).join(". ");

      const systemPrompt = `You are a workflow designer for ESG compliance and sustainability reporting.
Generate a precise, ordered list of 4-6 workflow steps for an AI agent.
Available tools: perceive_document, detect_frameworks, search_knowledge, verify_compliance, generate_text, judge_document, benchmark, calculate.
Respond ONLY with a valid JSON array. No markdown, no explanation.
Each step: { "id": "snake_case_id", "name": "Short Name", "description": "One sentence.", "tool": "tool_name" }`;

      const userPrompt = `Design an AI workflow for this task:
"${description.trim()}"
${context ? `Context: ${context}` : ""}

Return only the JSON array of steps.`;

      try {
        const raw = await sendMessage({
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          maxTokens: 1024,
        });

        if (!raw) throw new Error("Claude returned empty response");

        // Extract JSON array from response
        const match = raw.match(/\[[\s\S]*\]/);
        if (!match) throw new Error("No JSON array in Claude response");

        const parsed = JSON.parse(match[0]) as Array<{ id: string; name: string; description: string; tool: string }>;
        const steps = parsed
          .filter((s) => s.id && s.name && s.tool)
          .map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description ?? "",
            tool: VALID_TOOLS.includes(s.tool) ? s.tool : "generate_text",
          }));

        return reply.send({ steps });
      } catch (err) {
        logger.error("generate-steps Claude call failed, falling back to heuristic", err);
        // Fallback heuristic steps
        const lower = description.toLowerCase();
        return reply.send({
          steps: [
            { id: "ingest",      name: "Document Analysis",   description: "Ingest and extract key ESG data from source documents.", tool: "perceive_document" },
            { id: "frameworks",  name: "Framework Mapping",   description: lower.includes("csrd") || lower.includes("esrs") ? "Align against ESRS & GRI standards." : "Map to applicable ESG framework standards.", tool: "detect_frameworks" },
            { id: "kb_search",   name: "Knowledge Retrieval", description: "Search regulatory knowledge base for relevant guidance.", tool: "search_knowledge" },
            { id: "compliance",  name: "Gap Identification",  description: lower.includes("scope 3") ? "Flag missing Scope 3 metrics." : "Flag missing disclosures and compliance gaps.", tool: "verify_compliance" },
            { id: "report",      name: "Report Generation",   description: "Synthesize findings into a structured compliance report.", tool: "generate_text" },
          ],
        });
      }
    },
  );
}
