// src/services/vault/vault.router.ts

import { FastifyInstance } from "fastify";
import { authenticate } from "../../modules/auth/auth.middleware.js";
import { getEngagementVault, listVaultFiles, queryVault, deepQueryVault } from "./vault.service.js";
import { generateReviewTable } from "./review-table.service.js";
import { VaultModel } from "./vault.model.js";
import {
  uploadVaultDocument,
  listVaultDocuments,
  getVaultDocument,
  searchVaultDocuments,
  deleteVaultDocument,
  reprocessVaultDocument,
} from "../../modules/vault/vault-service.js";

const uploadRateMap = new Map<string, { count: number; resetAt: number }>();
const UPLOAD_RATE_LIMIT = 20;
const UPLOAD_RATE_WINDOW_MS = 60_000;

function checkUploadRate(workspaceId: string): boolean {
  const now = Date.now();
  const entry = uploadRateMap.get(workspaceId);
  if (!entry || now > entry.resetAt) {
    uploadRateMap.set(workspaceId, { count: 1, resetAt: now + UPLOAD_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= UPLOAD_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

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

  // ================================================================
  // Vault Document Management (new — modules/vault/)
  // ================================================================

  app.post(
    "/api/v1/vault/:workspaceId/documents",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };

      if (!checkUploadRate(workspaceId)) {
        return reply.code(429).send({
          error: `Upload rate limit exceeded — max ${UPLOAD_RATE_LIMIT} uploads per minute per workspace`,
        });
      }

      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: "No file uploaded" });
      }

      const buffer = await data.toBuffer();
      const user = (request as any).user;
      const { vaultId } = (request.query as any) || {};

      const doc = await uploadVaultDocument({
        workspaceId,
        vaultId: vaultId || workspaceId,
        filename: data.filename,
        mimeType: data.mimetype,
        buffer,
        uploadedBy: user?.id || "anonymous",
      });

      return reply.code(201).send(doc);
    }
  );

  app.get(
    "/api/v1/vault/:workspaceId/documents",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const { classification, status, limit } = request.query as {
        classification?: string;
        status?: string;
        limit?: string;
      };

      const docs = await listVaultDocuments({
        workspaceId,
        classification,
        status,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      return reply.send(docs);
    }
  );

  app.get(
    "/api/v1/vault/:workspaceId/documents/:docId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId, docId } = request.params as {
        workspaceId: string;
        docId: string;
      };

      const doc = await getVaultDocument(workspaceId, docId);
      if (!doc) {
        return reply.code(404).send({ error: "Document not found" });
      }
      return reply.send(doc);
    }
  );

  app.post(
    "/api/v1/vault/:workspaceId/documents/search",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const { query, documentIds, limit } = request.body as {
        query: string;
        documentIds?: string[];
        limit?: number;
      };

      if (!query) {
        return reply.code(400).send({ error: "query is required" });
      }

      const results = await searchVaultDocuments({
        query,
        workspaceId,
        documentIds,
        limit,
      });
      return reply.send(results);
    }
  );

  app.delete(
    "/api/v1/vault/:workspaceId/documents/:docId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId, docId } = request.params as {
        workspaceId: string;
        docId: string;
      };

      await deleteVaultDocument(workspaceId, docId);
      return reply.code(204).send();
    }
  );

  app.patch(
    "/api/v1/vault/:workspaceId/documents/:docId/reprocess",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId, docId } = request.params as {
        workspaceId: string;
        docId: string;
      };

      const result = await reprocessVaultDocument(workspaceId, docId);
      if (!result.queued) {
        return reply.code(409).send(result);
      }
      return reply.send(result);
    }
  );
}
