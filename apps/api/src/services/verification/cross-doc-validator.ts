// src/services/verification/cross-doc-validator.ts
//
// Validates consistency of data points across multiple documents
// within the same engagement.

import { DataPointModel } from "../../modules/ingestion/ingestion.model.js";
import { ESGDocumentModel } from "../../modules/ingestion/ingestion.model.js";
import type { VerificationFinding } from "./verification.service.js";

export type CrossDocFinding = VerificationFinding;

export async function validateCrossDocument(
  engagementId: string
): Promise<CrossDocFinding[]> {
  const findings: CrossDocFinding[] = [];
  let counter = 1;

  // Get all confirmed data points for this engagement that have a documentId
  const dataPoints = await DataPointModel.find({
    engagementId,
    status: { $in: ["user_confirmed", "auto_extracted", "user_edited"] },
    documentId: { $exists: true, $ne: null },
  }).lean();

  if (dataPoints.length === 0) return findings;

  // Build a document ID -> filename lookup
  const docIds = [...new Set(dataPoints.map((dp) => String(dp.documentId)))];
  const documents = await ESGDocumentModel.find({
    _id: { $in: docIds },
  })
    .select("_id filename")
    .lean();

  const docNameMap = new Map<string, string>();
  for (const doc of documents) {
    docNameMap.set(String(doc._id), doc.filename);
  }

  // Group data points by metricName
  const metricGroups = new Map<
    string,
    Array<{ value: number | string; documentId: string; unit: string; period?: { year: number; quarter?: number } }>
  >();

  for (const dp of dataPoints) {
    const key = dp.metricName;
    if (!metricGroups.has(key)) metricGroups.set(key, []);
    metricGroups.get(key)!.push({
      value: dp.value,
      documentId: String(dp.documentId),
      unit: dp.unit,
      period: dp.period,
    });
  }

  // For each metric, check for cross-document discrepancies
  for (const [metricName, points] of metricGroups) {
    // Only examine metrics that appear in multiple documents
    const uniqueDocIds = new Set(points.map((p) => p.documentId));
    if (uniqueDocIds.size < 2) continue;

    // Group by period (year + quarter) to compare same-period values across docs
    const periodGroups = new Map<string, typeof points>();
    for (const p of points) {
      const periodKey = p.period ? `${p.period.year}${p.period.quarter ? `-Q${p.period.quarter}` : ""}` : "unspecified";
      if (!periodGroups.has(periodKey)) periodGroups.set(periodKey, []);
      periodGroups.get(periodKey)!.push(p);
    }

    for (const [periodKey, periodPoints] of periodGroups) {
      // Check if same metric in same period has different values across documents
      const uniqueDocs = new Set(periodPoints.map((p) => p.documentId));
      if (uniqueDocs.size < 2) continue;

      // Compare all pairs
      const seen = new Set<string>();
      for (let i = 0; i < periodPoints.length; i++) {
        for (let j = i + 1; j < periodPoints.length; j++) {
          const a = periodPoints[i]!;
          const b = periodPoints[j]!;

          if (a.documentId === b.documentId) continue;

          const pairKey = [a.documentId, b.documentId].sort().join("|");
          if (seen.has(pairKey)) continue;
          seen.add(pairKey);

          const aVal = typeof a.value === "number" ? a.value : parseFloat(String(a.value));
          const bVal = typeof b.value === "number" ? b.value : parseFloat(String(b.value));

          // Compare numeric values
          if (!isNaN(aVal) && !isNaN(bVal)) {
            if (aVal !== bVal) {
              const diff = Math.abs(aVal - bVal);
              const pctDiff = aVal !== 0 ? (diff / Math.abs(aVal)) * 100 : 100;

              const docA = docNameMap.get(a.documentId) || a.documentId;
              const docB = docNameMap.get(b.documentId) || b.documentId;

              findings.push({
                id: `X-${String(counter++).padStart(3, "0")}`,
                type: "consistency_issue",
                severity: pctDiff > 10 ? "high" : "medium",
                location: {
                  document: `${docA} vs ${docB}`,
                  section: metricName,
                },
                description: `"${metricName}" for period ${periodKey} has conflicting values: ${aVal} ${a.unit} in "${docA}" vs ${bVal} ${b.unit} in "${docB}" (${pctDiff.toFixed(1)}% difference)`,
                expected: { value: "Consistent values across documents", source: "Cross-document validation" },
                found: { value: `${aVal} vs ${bVal}` },
                recommendation: `Reconcile the differing values for ${metricName} across documents. Ensure all documents report the same figure for period ${periodKey}.`,
                auditRisk: pctDiff > 10
                  ? "High — material discrepancies across documents will trigger an auditor finding"
                  : "Medium — minor discrepancies should be corrected for consistency",
              });
            }
          } else {
            // Compare string values
            const aStr = String(a.value).trim().toLowerCase();
            const bStr = String(b.value).trim().toLowerCase();

            if (aStr !== bStr) {
              const docA = docNameMap.get(a.documentId) || a.documentId;
              const docB = docNameMap.get(b.documentId) || b.documentId;

              findings.push({
                id: `X-${String(counter++).padStart(3, "0")}`,
                type: "consistency_issue",
                severity: "medium",
                location: {
                  document: `${docA} vs ${docB}`,
                  section: metricName,
                },
                description: `"${metricName}" for period ${periodKey} has differing values across documents: "${a.value}" in "${docA}" vs "${b.value}" in "${docB}"`,
                expected: { value: "Consistent values across documents", source: "Cross-document validation" },
                found: { value: `"${a.value}" vs "${b.value}"` },
                recommendation: `Review and reconcile the differing values for ${metricName} across these documents.`,
                auditRisk: "Medium — textual discrepancies across documents undermine report credibility",
              });
            }
          }
        }
      }
    }
  }

  return findings;
}
