import mongoose from "mongoose";
import { VaultChunkModel } from "../vault-chunk.model.js";
import { logger } from "../../../lib/logger.js";
import type { VaultSearchResult } from "./vector-search.js";

export interface BM25SearchOptions {
  query: string;
  workspaceId: string;
  documentIds?: string[];
  limit?: number;
}

export async function bm25Search(
  opts: BM25SearchOptions
): Promise<VaultSearchResult[]> {
  const { query, workspaceId, limit = 30 } = opts;

  try {
    const pipeline: any[] = [
      {
        $search: {
          index: "vault_chunks_text",
          compound: {
            must: [
              {
                text: {
                  query,
                  path: ["content", "contextualHeader"],
                },
              },
            ],
            filter: [
              {
                equals: {
                  path: "workspaceId",
                  value: new mongoose.Types.ObjectId(workspaceId),
                },
              },
            ],
          },
        },
      },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          documentId: 1,
          workspaceId: 1,
          vaultId: 1,
          content: 1,
          contextualHeader: 1,
          chunkType: 1,
          chunkIndex: 1,
          pageNumber: 1,
          sectionPath: 1,
          tableData: 1,
          score: { $meta: "searchScore" },
        },
      },
    ];

    if (opts.documentIds && opts.documentIds.length > 0) {
      pipeline[0].$search.compound.filter.push({
        in: {
          path: "documentId",
          value: opts.documentIds.map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        },
      });
    }

    const results = await VaultChunkModel.aggregate(pipeline);

    return results.map((r: any) => ({
      chunkId: r._id.toString(),
      documentId: r.documentId.toString(),
      workspaceId: r.workspaceId.toString(),
      vaultId: r.vaultId.toString(),
      content: r.content,
      contextualHeader: r.contextualHeader || "",
      chunkType: r.chunkType,
      chunkIndex: r.chunkIndex,
      pageNumber: r.pageNumber || 0,
      sectionPath: r.sectionPath || [],
      tableData: r.tableData || undefined,
      score: r.score,
    }));
  } catch (error) {
    logger.warn(
      "Atlas Search BM25 query failed — falling back to regex search",
      error
    );
    return regexFallback(opts);
  }
}

async function regexFallback(
  opts: BM25SearchOptions
): Promise<VaultSearchResult[]> {
  const terms = opts.query.split(/\s+/).filter(Boolean);
  const regexPattern = terms.join("|");

  const filter: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(opts.workspaceId),
    $or: [
      { content: { $regex: regexPattern, $options: "i" } },
      { contextualHeader: { $regex: regexPattern, $options: "i" } },
    ],
  };

  if (opts.documentIds && opts.documentIds.length > 0) {
    filter.documentId = {
      $in: opts.documentIds.map((id) => new mongoose.Types.ObjectId(id)),
    };
  }

  const chunks = await VaultChunkModel.find(filter)
    .limit(opts.limit || 30)
    .lean();

  return chunks.map((c) => {
    const contentLower = c.content.toLowerCase();
    const matchCount = terms.filter((t) =>
      contentLower.includes(t.toLowerCase())
    ).length;

    return {
      chunkId: c._id.toString(),
      documentId: c.documentId.toString(),
      workspaceId: c.workspaceId.toString(),
      vaultId: c.vaultId.toString(),
      content: c.content,
      contextualHeader: c.contextualHeader || "",
      chunkType: c.chunkType,
      chunkIndex: c.chunkIndex,
      pageNumber: c.pageNumber || 0,
      sectionPath: c.sectionPath || [],
      tableData: c.tableData || undefined,
      score: matchCount / Math.max(terms.length, 1),
    };
  });
}
