import mongoose from "mongoose";
import type { ToolDefinition } from "../agent/agent.tools.js";
import { vectorSearch } from "./search/vector-search.js";
import { queryTables } from "./table-store.js";
import { VaultDocumentModel } from "./vault-document.model.js";
import { VaultChunkModel } from "./vault-chunk.model.js";

export const vaultSearchTool: ToolDefinition = {
  name: "vault_search",
  description:
    "Search documents uploaded by the firm to their workspace vault. Use this for questions about the firm's own methodologies, SOPs, working documents, client policies, and reference materials. Returns ranked chunks with provenance (document name, page, section).",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query describing what information to find in the firm's vault",
      },
      workspace_id: {
        type: "string",
        description: "The workspace ID to scope the search",
      },
      document_ids: {
        type: "array",
        items: { type: "string" },
        description: "Optional: limit search to specific document IDs",
      },
      limit: {
        type: "number",
        description: "Maximum results to return (default 10)",
      },
    },
    required: ["query", "workspace_id"],
  },
  handler: async (input) => {
    const { query, workspace_id, document_ids, limit } = input as {
      query: string;
      workspace_id: string;
      document_ids?: string[];
      limit?: number;
    };

    const results = await vectorSearch({
      query,
      workspaceId: workspace_id,
      documentIds: document_ids,
      limit: limit || 10,
    });

    if (results.length === 0) {
      return { found: false, message: "No matching content found in the firm's vault." };
    }

    return {
      found: true,
      resultCount: results.length,
      results: results.map((r) => ({
        chunk_id: r.chunkId,
        document_id: r.documentId,
        content: r.content,
        page: r.pageNumber,
        section: r.sectionPath.join(" > ") || "Document root",
        type: r.chunkType,
        score: Math.round(r.score * 100) / 100,
      })),
    };
  },
};

export const vaultFetchDocumentTool: ToolDefinition = {
  name: "vault_fetch_document",
  description:
    "Retrieve metadata and summary for a specific document in the firm's vault. Use when you need context about a particular uploaded document — its classification, page count, status, and chunk count.",
  input_schema: {
    type: "object",
    properties: {
      document_id: {
        type: "string",
        description: "The vault document ID to fetch",
      },
      workspace_id: {
        type: "string",
        description: "The workspace ID for tenant verification",
      },
    },
    required: ["document_id", "workspace_id"],
  },
  handler: async (input) => {
    const { document_id, workspace_id } = input as {
      document_id: string;
      workspace_id: string;
    };

    const doc = await VaultDocumentModel.findOne({
      _id: new mongoose.Types.ObjectId(document_id),
      workspaceId: new mongoose.Types.ObjectId(workspace_id),
    }).lean();

    if (!doc) {
      return { found: false, message: "Document not found in this workspace vault." };
    }

    return {
      found: true,
      document: {
        id: doc._id.toString(),
        filename: doc.filename,
        format: doc.format,
        classification: doc.classification,
        status: doc.status,
        pageCount: doc.pageCount,
        chunkCount: doc.chunkCount,
        version: doc.version,
        uploadedAt: doc.provenance.uploadedAt,
        isScanned: doc.isScanned,
        languageDetected: doc.languageDetected,
      },
    };
  },
};

export const vaultCiteTool: ToolDefinition = {
  name: "vault_cite",
  description:
    "Resolve chunk IDs from vault search results into render-ready citations with document title, page number, and text snippet. Use this to provide precise citations for claims derived from the firm's vault documents.",
  input_schema: {
    type: "object",
    properties: {
      chunk_ids: {
        type: "array",
        items: { type: "string" },
        description: "Array of chunk IDs to resolve into citations",
      },
      workspace_id: {
        type: "string",
        description: "The workspace ID for tenant verification",
      },
    },
    required: ["chunk_ids", "workspace_id"],
  },
  handler: async (input) => {
    const { chunk_ids, workspace_id } = input as {
      chunk_ids: string[];
      workspace_id: string;
    };

    const chunks = await VaultChunkModel.find({
      _id: { $in: chunk_ids.map((id) => new mongoose.Types.ObjectId(id)) },
      workspaceId: new mongoose.Types.ObjectId(workspace_id),
    }).lean();

    const docIds = [...new Set(chunks.map((c) => c.documentId.toString()))];
    const docs = await VaultDocumentModel.find({
      _id: { $in: docIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).lean();
    const docMap = new Map(docs.map((d) => [d._id.toString(), d]));

    const citations = chunks.map((chunk) => {
      const doc = docMap.get(chunk.documentId.toString());
      return {
        chunk_id: chunk._id.toString(),
        document_title: doc?.filename || "Unknown document",
        document_id: chunk.documentId.toString(),
        page: chunk.pageNumber || null,
        section: chunk.sectionPath.join(" > ") || null,
        snippet: chunk.content.slice(0, 300),
        classification: doc?.classification || "unknown",
      };
    });

    return { citations };
  },
};

export const vaultListDocumentsTool: ToolDefinition = {
  name: "vault_list_documents",
  description:
    "List documents in the firm's workspace vault. Use when you need to understand what documents are available — for example, to identify coverage gaps or suggest which documents to reference.",
  input_schema: {
    type: "object",
    properties: {
      workspace_id: {
        type: "string",
        description: "The workspace ID to list documents for",
      },
      classification: {
        type: "string",
        enum: [
          "methodology",
          "sop",
          "report",
          "working_paper",
          "reference",
          "email",
          "unknown",
        ],
        description: "Optional: filter by document classification",
      },
      status: {
        type: "string",
        enum: ["queued", "parsing", "chunking", "embedding", "indexed", "failed"],
        description: "Optional: filter by processing status",
      },
      limit: {
        type: "number",
        description: "Maximum documents to return (default 20)",
      },
    },
    required: ["workspace_id"],
  },
  handler: async (input) => {
    const { workspace_id, classification, status, limit } = input as {
      workspace_id: string;
      classification?: string;
      status?: string;
      limit?: number;
    };

    const filter: Record<string, unknown> = {
      workspaceId: new mongoose.Types.ObjectId(workspace_id),
    };
    if (classification) filter.classification = classification;
    if (status) filter.status = status;

    const docs = await VaultDocumentModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit || 20)
      .lean();

    const total = await VaultDocumentModel.countDocuments({
      workspaceId: new mongoose.Types.ObjectId(workspace_id),
    });

    return {
      total,
      documents: docs.map((d) => ({
        id: d._id.toString(),
        filename: d.filename,
        format: d.format,
        classification: d.classification,
        status: d.status,
        chunkCount: d.chunkCount,
        pageCount: d.pageCount,
        version: d.version,
        uploadedAt: d.provenance.uploadedAt,
      })),
    };
  },
};

export const vaultQueryTableTool: ToolDefinition = {
  name: "vault_query_table",
  description:
    "Query structured tables extracted from spreadsheets and documents in the firm's vault. Use for quantitative questions like 'what was Scope 2 emissions in 2023' or 'compare carbon intensity across holdings'. Matches column headers and row content against the query.",
  input_schema: {
    type: "object",
    properties: {
      workspace_id: {
        type: "string",
        description: "The workspace ID to scope the query",
      },
      query: {
        type: "string",
        description: "The question or search terms to match against table data",
      },
      columns: {
        type: "array",
        items: { type: "string" },
        description: "Optional: specific column names to filter on",
      },
      document_id: {
        type: "string",
        description: "Optional: limit query to a specific document",
      },
    },
    required: ["workspace_id", "query"],
  },
  handler: async (input) => {
    const { workspace_id, query, columns, document_id } = input as {
      workspace_id: string;
      query: string;
      columns?: string[];
      document_id?: string;
    };

    const results = await queryTables({
      workspaceId: workspace_id,
      query,
      columns,
      documentId: document_id,
      limit: 10,
    });

    if (results.length === 0) {
      return {
        found: false,
        message: "No matching table data found in the vault.",
      };
    }

    return {
      found: true,
      tableCount: results.length,
      tables: results.map((r) => ({
        chunk_id: r.chunkId,
        document_id: r.documentId,
        caption: r.caption,
        headers: r.headers,
        matched_rows: r.matchedRows,
        page: r.page,
        section: r.sectionPath.join(" > "),
      })),
    };
  },
};

export function getVaultTools(): ToolDefinition[] {
  return [
    vaultSearchTool,
    vaultFetchDocumentTool,
    vaultCiteTool,
    vaultListDocumentsTool,
    vaultQueryTableTool,
  ];
}
