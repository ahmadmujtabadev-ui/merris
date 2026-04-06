// src/services/vault/review-table.service.ts
//
// Review table service: extract structured data across multiple documents
// in an engagement vault.

import { ESGDocumentModel } from "../../modules/ingestion/ingestion.model.js";
import { DataPointModel } from "../../modules/ingestion/ingestion.model.js";

// ============================================================
// Types
// ============================================================

export interface ReviewTableRequest {
  engagementId: string;
  columns: string[]; // e.g., ["Scope 1 emissions", "Scope 2 emissions", "water withdrawal"]
}

export interface ReviewTableCell {
  value: string | number | null;
  confidence: number;
  pageRef?: number;
}

export interface ReviewTableRow {
  documentId: string;
  documentName: string;
  values: Record<string, ReviewTableCell>;
}

export interface ReviewTableResult {
  columns: string[];
  rows: ReviewTableRow[];
  totalDocuments: number;
}

// ============================================================
// Service
// ============================================================

/**
 * Generates a review table by querying data points across all documents
 * in an engagement and matching them against requested column names.
 */
export async function generateReviewTable(
  request: ReviewTableRequest
): Promise<ReviewTableResult> {
  const { engagementId, columns } = request;

  // 1. Get all documents in the engagement
  const documents = await ESGDocumentModel.find({ engagementId })
    .select("_id filename")
    .lean();

  if (documents.length === 0) {
    return { columns, rows: [], totalDocuments: 0 };
  }

  const documentIds = documents.map((d: any) => d._id);

  // 2. Build regex matchers for each column (case-insensitive)
  const columnPatterns = columns.map((col) => ({
    column: col,
    regex: new RegExp(col.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  }));

  // 3. Query all data points for documents in this engagement
  const dataPoints = await DataPointModel.find({
    engagementId,
    documentId: { $in: documentIds },
  }).lean();

  // 4. Build a lookup: documentId -> data points
  const dpByDoc = new Map<string, typeof dataPoints>();
  for (const dp of dataPoints) {
    const docId = String(dp.documentId);
    if (!dpByDoc.has(docId)) {
      dpByDoc.set(docId, []);
    }
    dpByDoc.get(docId)!.push(dp);
  }

  // 5. For each document, build a row
  const rows: ReviewTableRow[] = documents.map((doc: any) => {
    const docId = String(doc._id);
    const docDataPoints = dpByDoc.get(docId) || [];

    const values: Record<string, ReviewTableCell> = {};

    for (const { column, regex } of columnPatterns) {
      // Find a data point whose metricName matches the column
      const match = docDataPoints.find(
        (dp: any) => regex.test(dp.metricName) || regex.test(dp.frameworkRef)
      );

      if (match) {
        const confidenceScore =
          match.confidence === "high"
            ? 0.95
            : match.confidence === "medium"
              ? 0.7
              : 0.4;

        values[column] = {
          value: match.value as string | number,
          confidence: confidenceScore,
          pageRef: match.sourcePage ?? undefined,
        };
      } else {
        values[column] = {
          value: null,
          confidence: 0,
        };
      }
    }

    return {
      documentId: docId,
      documentName: doc.filename,
      values,
    };
  });

  return {
    columns,
    rows,
    totalDocuments: documents.length,
  };
}
