// src/services/vault/vault.router.ts

import { FastifyInstance } from "fastify";
import { authenticate } from "../../modules/auth/auth.middleware.js";
import { getEngagementVault, listVaultFiles, queryVault, deepQueryVault } from "./vault.service.js";
import { generateReviewTable } from "./review-table.service.js";
import { VaultModel } from "./vault.model.js";

export async function registerVaultRoutes(app: FastifyInstance): Promise<void> {
  // ---- Existing routes ----

  app.get("/api/v1/vault/:engagementId", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const vault = await getEngagementVault(engagementId);
    return reply.send(vault);
  });

  app.get("/api/v1/vault/:engagementId/files", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const files = await listVaultFiles(engagementId);
    return reply.send({ files });
  });

  app.post("/api/v1/vault/:engagementId/query", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const { query } = request.body as any;
    const result = await queryVault(engagementId, query);
    return reply.send(result);
  });

  // ---- Phase 5: Review Table ----

  app.post("/api/v1/vault/:engagementId/review-table", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const { columns } = request.body as { columns?: string[] };

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return reply.code(400).send({ error: "columns must be a non-empty array of strings" });
    }

    const result = await generateReviewTable({ engagementId, columns });
    return reply.send(result);
  });

  // ---- Phase 5: Deep Query (Claude-powered) ----

  app.post("/api/v1/vault/:engagementId/deep-query", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const { query } = request.body as { query?: string };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return reply.code(400).send({ error: "query must be a non-empty string" });
    }

    const result = await deepQueryVault(engagementId, query.trim());
    return reply.send(result);
  });

  // ---- Phase 5: Vault CRUD ----

  app.post("/api/v1/vault/create", { preHandler: [authenticate] }, async (request, reply) => {
    const { orgId, name, type, engagementId, description, tags } = request.body as {
      orgId?: string;
      name?: string;
      type?: string;
      engagementId?: string;
      description?: string;
      tags?: string[];
    };

    if (!orgId || !name || !type) {
      return reply.code(400).send({ error: "orgId, name, and type are required" });
    }

    if (!["engagement", "knowledge", "firm"].includes(type)) {
      return reply.code(400).send({ error: "type must be engagement, knowledge, or firm" });
    }

    const vault = await VaultModel.create({
      orgId,
      name,
      type,
      engagementId: engagementId || undefined,
      description: description || "",
      tags: tags || [],
    });

    return reply.code(201).send(vault);
  });

  app.get("/api/v1/vault/list", { preHandler: [authenticate] }, async (request, reply) => {
    const { orgId, type } = request.query as { orgId?: string; type?: string };

    if (!orgId) {
      return reply.code(400).send({ error: "orgId query parameter is required" });
    }

    const filter: Record<string, unknown> = { orgId };
    if (type) {
      filter["type"] = type;
    }

    const vaults = await VaultModel.find(filter).sort({ updatedAt: -1 }).lean();
    return reply.send({ vaults });
  });
}
