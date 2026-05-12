// src/services/vault/vault.router.ts

import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { authenticate } from "../../modules/auth/auth.middleware.js";
import { getEngagementVault, listVaultFiles, queryVault, deepQueryVault } from "./vault.service.js";
import { generateReviewTable } from "./review-table.service.js";
import { VaultModel } from "./vault.model.js";
import { VaultDocumentModel } from "../../modules/vault/vault-document.model.js";
import { VaultChunkModel } from "../../modules/vault/vault-chunk.model.js";
import { hybridSearch } from "../../modules/vault/search/hybrid-search.js";
import { queryTables } from "../../modules/vault/table-store.js";
import { compareDocuments } from "../../modules/vault/reasoning/compare-documents.js";
import { sendMessage } from "../../lib/claude.js";
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
  // Vault Stats — document counts by status per workspace
  // ================================================================

  app.get(
    "/api/v1/vault/:workspaceId/stats",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      let wsOid: mongoose.Types.ObjectId;
      try {
        wsOid = new mongoose.Types.ObjectId(workspaceId);
      } catch {
        return reply.code(400).send({ error: "Invalid workspaceId" });
      }

      const [total, indexed, failed, processing] = await Promise.all([
        VaultDocumentModel.countDocuments({ workspaceId: wsOid }),
        VaultDocumentModel.countDocuments({ workspaceId: wsOid, status: "indexed" }),
        VaultDocumentModel.countDocuments({ workspaceId: wsOid, status: "failed" }),
        VaultDocumentModel.countDocuments({ workspaceId: wsOid, status: { $in: ["queued", "parsing", "chunking", "embedding"] } }),
      ]);

      return reply.send({ total, indexed, failed, processing });
    }
  );

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
        uploadedBy: user?.userId || user?.id || workspaceId,
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

  // ================================================================
  // Document pages — page-level chunk breakdown for document viewer
  // ================================================================

  app.get(
    "/api/v1/vault/:workspaceId/documents/:docId/pages",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId, docId } = request.params as {
        workspaceId: string;
        docId: string;
      };

      let wsOid: mongoose.Types.ObjectId;
      let docOid: mongoose.Types.ObjectId;
      try {
        wsOid = new mongoose.Types.ObjectId(workspaceId);
        docOid = new mongoose.Types.ObjectId(docId);
      } catch {
        return reply.code(400).send({ error: "Invalid workspaceId or docId" });
      }

      const chunks = await VaultChunkModel.find({
        workspaceId: wsOid,
        documentId: docOid,
      })
        .sort({ pageNumber: 1, chunkIndex: 1 })
        .select("chunkIndex chunkType content sectionPath pageNumber bbox tableData")
        .lean();

      // Group by page
      const pageMap = new Map<number, typeof chunks>();
      for (const chunk of chunks) {
        const page = chunk.pageNumber ?? 0;
        if (!pageMap.has(page)) pageMap.set(page, []);
        pageMap.get(page)!.push(chunk);
      }

      const pages = Array.from(pageMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([page, pageChunks]) => ({
          page,
          chunks: pageChunks.map((c) => ({
            id: c._id.toString(),
            index: c.chunkIndex,
            type: c.chunkType,
            content: c.content,
            section: (c.sectionPath as string[]).join(" > ") || null,
            bbox: c.bbox ?? null,
            tableData: c.tableData ?? null,
          })),
        }));

      return reply.send({ total: chunks.length, pages });
    }
  );

  // ================================================================
  // Jobs — in-flight document processing queue
  // ================================================================

  app.get(
    "/api/v1/vault/:workspaceId/jobs",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };

      let wsOid: mongoose.Types.ObjectId;
      try {
        wsOid = new mongoose.Types.ObjectId(workspaceId);
      } catch {
        return reply.code(400).send({ error: "Invalid workspaceId" });
      }

      const inFlight = await VaultDocumentModel.find({
        workspaceId: wsOid,
        status: { $in: ["queued", "parsing", "chunking", "embedding"] },
      })
        .sort({ updatedAt: -1 })
        .select("filename format status updatedAt createdAt errorMessage")
        .lean();

      const jobs = inFlight.map((d) => ({
        jobId: d._id.toString(),
        documentId: d._id.toString(),
        filename: d.filename,
        format: d.format,
        status: d.status,
        startedAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));

      return reply.send({ total: jobs.length, jobs });
    }
  );

  app.get(
    "/api/v1/vault/:workspaceId/jobs/:docId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId, docId } = request.params as {
        workspaceId: string;
        docId: string;
      };

      let wsOid: mongoose.Types.ObjectId;
      let docOid: mongoose.Types.ObjectId;
      try {
        wsOid = new mongoose.Types.ObjectId(workspaceId);
        docOid = new mongoose.Types.ObjectId(docId);
      } catch {
        return reply.code(400).send({ error: "Invalid workspaceId or docId" });
      }

      const doc = await VaultDocumentModel.findOne({ _id: docOid, workspaceId: wsOid })
        .select("filename format status chunkCount pageCount errorMessage createdAt updatedAt")
        .lean();

      if (!doc) {
        return reply.code(404).send({ error: "Job not found" });
      }

      return reply.send({
        jobId: doc._id.toString(),
        documentId: doc._id.toString(),
        filename: doc.filename,
        format: doc.format,
        status: doc.status,
        chunkCount: doc.chunkCount,
        pageCount: doc.pageCount ?? null,
        errorMessage: doc.errorMessage ?? null,
        startedAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
    }
  );

  // ================================================================
  // Ask — vault-scoped AI Q&A
  // ================================================================

  app.post(
    "/api/v1/vault/:workspaceId/ask",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const { question, documentIds, limit } = request.body as {
        question?: string;
        documentIds?: string[];
        limit?: number;
      };

      if (!question || typeof question !== "string" || question.trim().length === 0) {
        return reply.code(400).send({ error: "question is required" });
      }

      const results = await hybridSearch({
        query: question.trim(),
        workspaceId,
        documentIds,
        limit: limit || 15,
      });

      if (results.length === 0) {
        return reply.send({
          answer: "I could not find any relevant content in your vault documents for this question.",
          sources: [],
        });
      }

      const context = results
        .map((r, i) =>
          `[${i + 1}] ${r.content}\n(page ${r.pageNumber ?? "?"}, section: ${r.sectionPath.join(" > ") || "root"})`
        )
        .join("\n\n");

      const answer = await sendMessage({
        maxTokens: 2048,
        system:
          "You are an expert ESG analyst. Answer the user's question using only the provided vault document excerpts. Be precise and cite sources by their [N] reference number. If the documents do not contain enough information, say so clearly.",
        messages: [
          {
            role: "user",
            content: `Question: ${question.trim()}\n\nVault Document Excerpts:\n${context}`,
          },
        ],
      });

      return reply.send({
        answer: answer ?? "No answer could be generated.",
        sources: results.map((r) => ({
          chunkId: r.chunkId,
          documentId: r.documentId,
          content: r.content.slice(0, 300),
          page: r.pageNumber ?? null,
          section: r.sectionPath.join(" > ") || "root",
          score: Math.round(r.score * 100) / 100,
        })),
      });
    }
  );

  // ================================================================
  // Query Table — structured table extraction
  // ================================================================

  app.post(
    "/api/v1/vault/:workspaceId/query-table",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const { query, columns, documentId, limit } = request.body as {
        query?: string;
        columns?: string[];
        documentId?: string;
        limit?: number;
      };

      if (!query || typeof query !== "string" || query.trim().length === 0) {
        return reply.code(400).send({ error: "query is required" });
      }

      const tables = await queryTables({
        workspaceId,
        query: query.trim(),
        columns,
        documentId,
        limit: limit || 10,
      });

      return reply.send({
        found: tables.length > 0,
        tableCount: tables.length,
        tables: tables.map((t) => ({
          chunkId: t.chunkId,
          documentId: t.documentId,
          caption: t.caption,
          headers: t.headers,
          matchedRows: t.matchedRows,
          page: t.page,
          section: t.sectionPath.join(" > "),
        })),
      });
    }
  );

  // ================================================================
  // Compare — multi-document Claude-powered comparison
  // ================================================================

  app.post(
    "/api/v1/vault/:workspaceId/compare",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const { documentIds, dimensions, query } = request.body as {
        documentIds?: string[];
        dimensions?: string[];
        query?: string;
      };

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
        return reply.code(400).send({ error: "documentIds must be an array of at least 2 document IDs" });
      }

      const result = await compareDocuments({
        workspaceId,
        documentIds,
        dimensions,
        query,
      });

      return reply.send(result);
    }
  );

  // ================================================================
  // Citations — resolve chunk IDs to render-ready citations
  // ================================================================

  app.post(
    "/api/v1/vault/:workspaceId/citations",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const { chunkIds } = request.body as { chunkIds?: string[] };

      if (!chunkIds || !Array.isArray(chunkIds) || chunkIds.length === 0) {
        return reply.code(400).send({ error: "chunkIds must be a non-empty array" });
      }

      let wsOid: mongoose.Types.ObjectId;
      try {
        wsOid = new mongoose.Types.ObjectId(workspaceId);
      } catch {
        return reply.code(400).send({ error: "Invalid workspaceId" });
      }

      const chunks = await VaultChunkModel.find({
        _id: { $in: chunkIds.map((id) => new mongoose.Types.ObjectId(id)) },
        workspaceId: wsOid,
      }).lean();

      const docIds = [...new Set(chunks.map((c) => c.documentId.toString()))];
      const docs = await VaultDocumentModel.find({
        _id: { $in: docIds.map((id) => new mongoose.Types.ObjectId(id)) },
      }).lean();
      const docMap = new Map(docs.map((d) => [d._id.toString(), d]));

      const citations = chunks.map((chunk) => {
        const doc = docMap.get(chunk.documentId.toString());
        return {
          chunkId: chunk._id.toString(),
          documentTitle: doc?.filename || "Unknown document",
          documentId: chunk.documentId.toString(),
          page: chunk.pageNumber ?? null,
          section: (chunk.sectionPath as string[]).join(" > ") || null,
          snippet: chunk.content.slice(0, 300),
          classification: doc?.classification || "unknown",
        };
      });

      return reply.send({ citations });
    }
  );
}
