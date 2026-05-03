import mongoose from "mongoose";
import { VaultChunkModel } from "./vault-chunk.model.js";
import { logger } from "../../lib/logger.js";

export interface TableQueryOptions {
  workspaceId: string;
  query: string;
  columns?: string[];
  documentId?: string;
  limit?: number;
}

export interface TableQueryResult {
  chunkId: string;
  documentId: string;
  caption: string;
  headers: string[];
  matchedRows: string[][];
  page: number;
  sectionPath: string[];
}

export async function queryTables(
  opts: TableQueryOptions
): Promise<TableQueryResult[]> {
  const { workspaceId, query, columns, documentId, limit = 10 } = opts;

  const filter: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    chunkType: "table",
    "tableData.headers": { $exists: true },
  };

  if (documentId) {
    filter.documentId = new mongoose.Types.ObjectId(documentId);
  }

  const tableChunks = await VaultChunkModel.find(filter)
    .limit(50)
    .lean();

  const results: TableQueryResult[] = [];
  const queryTerms = query.toLowerCase().split(/\s+/);

  for (const chunk of tableChunks) {
    if (!chunk.tableData?.headers || !chunk.tableData?.rows) continue;

    const headers = chunk.tableData.headers;

    if (columns && columns.length > 0) {
      const headerLower = headers.map((h) => h.toLowerCase());
      const hasMatchingColumn = columns.some((col) =>
        headerLower.some(
          (h) => h.includes(col.toLowerCase()) || col.toLowerCase().includes(h)
        )
      );
      if (!hasMatchingColumn) continue;
    }

    const matchedRows = chunk.tableData.rows.filter((row) => {
      const rowText = row.join(" ").toLowerCase();
      return queryTerms.some((term) => rowText.includes(term));
    });

    if (matchedRows.length > 0 || matchesHeaders(headers, queryTerms)) {
      results.push({
        chunkId: chunk._id.toString(),
        documentId: chunk.documentId.toString(),
        caption: chunk.tableData.caption || "",
        headers,
        matchedRows:
          matchedRows.length > 0
            ? matchedRows.slice(0, 20)
            : chunk.tableData.rows.slice(0, 10),
        page: chunk.pageNumber || 0,
        sectionPath: chunk.sectionPath,
      });
    }
  }

  results.sort((a, b) => b.matchedRows.length - a.matchedRows.length);
  return results.slice(0, limit);
}

function matchesHeaders(headers: string[], queryTerms: string[]): boolean {
  const headerText = headers.join(" ").toLowerCase();
  return queryTerms.some((term) => headerText.includes(term));
}
