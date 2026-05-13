// src/services/vault/vault.router.ts

import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { authenticate } from "../../modules/auth/auth.middleware.js";
import { getEngagementVault, listVaultFiles, queryVault, deepQueryVault } from "./vault.service.js";
import { generateReviewTable } from "./review-table.service.js";
import { VaultModel } from "./vault.model.js";
import { VaultDocumentModel } from "../../modules/vault/vault-document.model.js";
import { VaultChunkModel } from "../../modules/vault/vault-chunk.model.js";
import { getDenseEmbeddingCount, getDenseEmbeddingStats } from "../../modules/knowledge-base/dense-search.service.js";
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

      const [total, indexed, failed, processing, chunkAgg, denseTotal, denseByModule] = await Promise.all([
        VaultDocumentModel.countDocuments({ workspaceId: wsOid }),
        VaultDocumentModel.countDocuments({ workspaceId: wsOid, status: "indexed" }),
        VaultDocumentModel.countDocuments({ workspaceId: wsOid, status: "failed" }),
        VaultDocumentModel.countDocuments({ workspaceId: wsOid, status: { $in: ["queued", "parsing", "chunking", "embedding"] } }),
        VaultDocumentModel.aggregate([
          { $match: { workspaceId: wsOid } },
          { $group: { _id: null, total: { $sum: "$chunkCount" } } },
        ]),
        getDenseEmbeddingCount(),
        getDenseEmbeddingStats(),
      ]);

      const vaultChunks: number = (chunkAgg[0] as { total?: number } | undefined)?.total ?? 0;
      // totalChunks = vault uploads + M01-M14 dense KB chunks
      const totalChunks: number = vaultChunks + denseTotal;

      return reply.send({ total, indexed, failed, processing, totalChunks, denseChunks: denseTotal, denseByModule });
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
      const { question, documentIds, limit, previousMessages } = request.body as {
        question?: string;
        documentIds?: string[];
        limit?: number;
        previousMessages?: Array<{ role: "user" | "assistant"; content: string }>;
      };

      if (!question || typeof question !== "string" || question.trim().length === 0) {
        return reply.code(400).send({ error: "question is required" });
      }

      const startTime = Date.now();

      const results = await hybridSearch({
        query: question.trim(),
        workspaceId,
        documentIds,
        limit: limit || 15,
      });

      if (results.length === 0) {
        return reply.send({
          answer: "I could not find any relevant content in your vault documents for this question.",
          lowConfidence: false,
          answeredInMs: Date.now() - startTime,
          passageCount: 0,
          followUpSuggestions: [],
          sources: [],
        });
      }

      const context = results
        .map((r, i) =>
          `[${i + 1}] ${r.content}\n(page ${r.pageNumber ?? "?"}, section: ${r.sectionPath.join(" > ") || "root"})`
        )
        .join("\n\n");

      // Build multi-turn message history
      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
      if (previousMessages && previousMessages.length > 0) {
        messages.push(...previousMessages.slice(-6));
      }
      messages.push({
        role: "user",
        content: `Question: ${question.trim()}\n\nVault Document Excerpts:\n${context}\n\nAfter your answer add exactly:\nFOLLOW_UPS:\n["question 1?","question 2?","question 3?"]`,
      });

      const rawAnswer = await sendMessage({
        maxTokens: 2048,
        system: `You are an expert ESG analyst. Answer the user's question using only the provided vault document excerpts.

FORMATTING RULES — follow exactly:
- Use ## for major section headings, ### for sub-headings. Never output raw ### as plain text.
- Use **bold** for key terms, numbers, and findings.
- Use bullet points (- ) for lists.
- Use numbered lists (1. 2. 3.) for sequential steps or ranked items.
- For comparison data (e.g. two documents side-by-side), output a markdown table:
  | Column A | Column B | Column C |
  |----------|----------|----------|
  | value    | value    | value    |
  | detail   | detail   | detail   |
- For statistics, percentages, and key metrics, render them in a table so they display as visual stat cards.
- Cite sources inline using [N] reference numbers (e.g. "85% of CxOs increased investment [1]").
- If asked about charts, images, or visual content and the document text is sparse, explain what you found and note that the document may need OCR re-processing to extract image content.
- If the documents do not contain enough information, say so clearly.`,
        messages,
      });

      // Parse out follow-up suggestions appended after FOLLOW_UPS:
      let answer = rawAnswer ?? "No answer could be generated.";
      let followUpSuggestions: string[] = [];
      const followUpMatch = answer.match(/\nFOLLOW_UPS:\s*(\[[\s\S]*?\])/);
      if (followUpMatch?.[1]) {
        try { followUpSuggestions = JSON.parse(followUpMatch[1]); } catch { /* ignore */ }
        answer = answer.replace(/\nFOLLOW_UPS:[\s\S]*$/, "").trim();
      }

      // Enrich sources with document filenames
      const uniqueDocIds = [...new Set(results.map((r) => r.documentId))];
      const sourceDocs = await VaultDocumentModel.find({
        _id: { $in: uniqueDocIds.map((id) => new mongoose.Types.ObjectId(id)) },
      }).select("filename").lean();
      const docNameMap = new Map(sourceDocs.map((d) => [d._id.toString(), d.filename]));

      const maxScore = results.reduce((m, r) => Math.max(m, r.score), 0);

      return reply.send({
        answer,
        lowConfidence: maxScore < 0.1,
        answeredInMs: Date.now() - startTime,
        passageCount: results.length,
        followUpSuggestions: followUpSuggestions.slice(0, 3),
        sources: results.map((r) => ({
          chunkId: r.chunkId,
          documentId: r.documentId,
          documentName: docNameMap.get(r.documentId) ?? "Unknown document",
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
  // Generate Flow — Claude-powered process flow from document content
  // ================================================================

  app.post(
    "/api/v1/vault/:workspaceId/generate-flow",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const { documentIds, topic } = request.body as {
        documentIds?: string[];
        topic?: string;
      };

      if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
        return reply.code(400).send({ error: "topic is required" });
      }

      const results = await hybridSearch({
        query: topic.trim(),
        workspaceId,
        documentIds,
        limit: 20,
      });

      if (results.length === 0) {
        return reply.send({
          title: topic,
          steps: [],
          summary: "No relevant content found in the selected documents.",
        });
      }

      const context = results
        .map((r, i) => `[${i + 1}] (page ${r.pageNumber ?? "?"}): ${r.content}`)
        .join("\n\n");

      const flowText = await sendMessage({
        maxTokens: 2048,
        system: `You are an expert process designer specialising in ESG and sustainability. Generate a clear structured process flow from the document content provided.

Respond with ONLY valid JSON — no markdown fences, no extra text — matching this exact schema:
{
  "title": "string",
  "steps": [
    { "step": 1, "title": "string", "description": "string", "substeps": ["string"] }
  ],
  "summary": "string"
}
Include 4-8 steps. Keep each description to 1-2 sentences. substeps is optional.`,
        messages: [
          {
            role: "user",
            content: `Topic: ${topic.trim()}\n\nDocument excerpts:\n${context}\n\nGenerate a step-by-step process flow based on this content.`,
          },
        ],
      });

      try {
        const clean = (flowText ?? "").replace(/```json|```/g, "").trim();
        const flow = JSON.parse(clean);
        return reply.send(flow);
      } catch {
        return reply.send({
          title: topic,
          steps: [],
          summary: flowText ?? "Could not generate flow.",
        });
      }
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
