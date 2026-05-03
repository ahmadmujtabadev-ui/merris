import { embedQuery } from "../../../services/voyage.service.js";
import { getQdrantClient } from "../../../lib/qdrant.js";
import { VAULT_QDRANT_COLLECTION } from "../../../lib/qdrant-vault.js";
import { logger } from "../../../lib/logger.js";
import { VaultChunkModel } from "../vault-chunk.model.js";
import mongoose from "mongoose";

export interface VaultSearchResult {
  chunkId: string;
  documentId: string;
  workspaceId: string;
  vaultId: string;
  content: string;
  contextualHeader: string;
  chunkType: string;
  chunkIndex: number;
  pageNumber: number;
  sectionPath: string[];
  tableData?: {
    headers: string[];
    rows: string[][];
    caption?: string;
  };
  score: number;
}

export interface VaultSearchOptions {
  query: string;
  workspaceId: string;
  documentIds?: string[];
  fileTypes?: string[];
  limit?: number;
}

export async function vectorSearch(
  opts: VaultSearchOptions
): Promise<VaultSearchResult[]> {
  const { query, workspaceId, limit = 15 } = opts;
  const apiKey = process.env["VOYAGE_API_KEY"];

  if (!apiKey) {
    logger.warn("VOYAGE_API_KEY not set — falling back to MongoDB text search");
    return mongoFallbackSearch(opts);
  }

  try {
    const queryVector = await embedQuery(query, apiKey);
    const client = getQdrantClient();

    const filter: Record<string, unknown> = {
      must: [
        {
          key: "workspace_id",
          match: { value: workspaceId },
        },
      ],
    };

    if (opts.documentIds && opts.documentIds.length > 0) {
      (filter.must as unknown[]).push({
        key: "document_id",
        match: { any: opts.documentIds },
      });
    }

    const searchResult = await client.search(VAULT_QDRANT_COLLECTION, {
      vector: queryVector,
      filter,
      limit: limit * 2,
      with_payload: true,
    });

    const chunkIds = searchResult.map((r) => {
      const payload = r.payload as Record<string, unknown>;
      return {
        documentId: payload.document_id as string,
        chunkIndex: payload.chunk_index as number,
        score: r.score,
      };
    });

    const results: VaultSearchResult[] = [];
    for (const hit of chunkIds.slice(0, limit)) {
      const chunk = await VaultChunkModel.findOne({
        documentId: new mongoose.Types.ObjectId(hit.documentId),
        chunkIndex: hit.chunkIndex,
      }).lean();

      if (chunk) {
        results.push({
          chunkId: chunk._id.toString(),
          documentId: chunk.documentId.toString(),
          workspaceId: chunk.workspaceId.toString(),
          vaultId: chunk.vaultId.toString(),
          content: chunk.content,
          contextualHeader: chunk.contextualHeader,
          chunkType: chunk.chunkType,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber || 0,
          sectionPath: chunk.sectionPath,
          tableData: chunk.tableData || undefined,
          score: hit.score,
        });
      }
    }

    return results;
  } catch (error) {
    logger.warn("Qdrant vault search failed — falling back to MongoDB", error);
    return mongoFallbackSearch(opts);
  }
}

async function mongoFallbackSearch(
  opts: VaultSearchOptions
): Promise<VaultSearchResult[]> {
  const { query, workspaceId, limit = 15 } = opts;

  const filter: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    content: { $regex: query.split(/\s+/).join("|"), $options: "i" },
  };

  if (opts.documentIds && opts.documentIds.length > 0) {
    filter.documentId = {
      $in: opts.documentIds.map((id) => new mongoose.Types.ObjectId(id)),
    };
  }

  const chunks = await VaultChunkModel.find(filter)
    .limit(limit)
    .lean();

  return chunks.map((chunk) => ({
    chunkId: chunk._id.toString(),
    documentId: chunk.documentId.toString(),
    workspaceId: chunk.workspaceId.toString(),
    vaultId: chunk.vaultId.toString(),
    content: chunk.content,
    contextualHeader: chunk.contextualHeader,
    chunkType: chunk.chunkType,
    chunkIndex: chunk.chunkIndex,
    pageNumber: chunk.pageNumber || 0,
    sectionPath: chunk.sectionPath,
    tableData: chunk.tableData || undefined,
    score: 0.5,
  }));
}
