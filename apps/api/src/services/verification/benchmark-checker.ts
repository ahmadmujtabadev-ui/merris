// src/services/verification/benchmark-checker.ts
//
// Compares engagement metrics against peer benchmarks from knowledge base.

import mongoose from "mongoose";
import { DataPointModel } from "../../modules/ingestion/ingestion.model.js";
import { KnowledgeReportModel } from "../../models/knowledge-report.model.js";
import type { VerificationFinding } from "./verification.service.js";

export type BenchmarkFinding = VerificationFinding;

/**
 * Resolve the sector for an engagement by looking up the orgprofile
 * linked through the engagement document.
 */
async function resolveSector(engagementId: string): Promise<string | null> {
  try {
    const db = mongoose.connection.db;
    if (!db) return null;
    const engagement = await db.collection("engagements").findOne({
      _id: new (mongoose.Types.ObjectId as any)(engagementId),
    });
    if (!engagement?.orgId) return null;
    const orgProfile = await db.collection("orgprofiles").findOne({
      orgId: engagement.orgId,
    });
    return orgProfile?.subIndustry || orgProfile?.industryGICS || null;
  } catch {
    return null;
  }
}

export async function checkBenchmarks(
  engagementId: string,
  documentBody: string
): Promise<BenchmarkFinding[]> {
  const findings: BenchmarkFinding[] = [];
  let counter = 1;

  // Get confirmed quantitative data points for this engagement
  const dataPoints = await DataPointModel.find({
    engagementId,
    status: { $in: ["user_confirmed", "auto_extracted", "user_edited"] },
  }).lean();

  if (dataPoints.length === 0) return findings;

  // Resolve sector for peer comparison
  const sector = await resolveSector(engagementId);

  // Build sector query filter — broad match on first word if available
  const sectorFilter = sector
    ? { sector: { $regex: new RegExp(sector.split(" ")[0] || "", "i") } }
    : {};

  // Group data points by metricName, keep latest value per metric
  const metricMap = new Map<string, { value: number; unit: string; metricName: string }>();
  for (const dp of dataPoints) {
    const numValue = typeof dp.value === "number" ? dp.value : parseFloat(String(dp.value));
    if (isNaN(numValue)) continue;

    const existing = metricMap.get(dp.metricName);
    if (!existing) {
      metricMap.set(dp.metricName, { value: numValue, unit: dp.unit, metricName: dp.metricName });
    }
  }

  // For each quantitative metric, find peer values from knowledge reports
  for (const [metricName, metric] of metricMap) {
    const peerReports = await KnowledgeReportModel.find({
      "metrics.name": { $regex: new RegExp(`^${metricName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      ...sectorFilter,
    }).lean();

    // Extract peer values for this metric
    const peerValues: number[] = [];
    for (const report of peerReports) {
      for (const m of report.metrics) {
        if (m.name.toLowerCase() === metricName.toLowerCase()) {
          const val = typeof m.value === "number" ? m.value : parseFloat(String(m.value));
          if (!isNaN(val)) peerValues.push(val);
        }
      }
    }

    if (peerValues.length < 3) continue; // Need enough peers for meaningful statistics

    // Calculate mean and standard deviation
    const mean = peerValues.reduce((sum, v) => sum + v, 0) / peerValues.length;
    const variance = peerValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / peerValues.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) continue;

    const zScore = Math.abs(metric.value - mean) / stdDev;

    // Flag >2 standard deviations as benchmark outlier (critical/high)
    if (zScore > 2) {
      const direction = metric.value > mean ? "above" : "below";
      findings.push({
        id: `B-${String(counter++).padStart(3, "0")}`,
        type: "benchmark_outlier",
        severity: zScore > 3 ? "critical" : "high",
        location: { section: metricName },
        description: `"${metricName}" value of ${metric.value} ${metric.unit} is ${zScore.toFixed(1)} standard deviations ${direction} the peer mean of ${mean.toFixed(2)} ${metric.unit} (n=${peerValues.length} peers)`,
        expected: { value: mean.toFixed(2), source: `Peer benchmark (${peerValues.length} reports, same sector)` },
        found: { value: metric.value },
        recommendation: `Verify the reported value for ${metricName}. If accurate, provide narrative justification for the significant deviation from industry peers.`,
        auditRisk: "High — outlier values attract auditor scrutiny and require supporting evidence",
      });
      continue;
    }

    // Flag bottom quartile as medium severity
    const sorted = [...peerValues].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q1Value = sorted[q1Index];

    // For metrics where lower is worse (e.g., scores), check bottom quartile
    // For emissions metrics, higher could be worse — but we flag bottom quartile generically
    if (q1Value !== undefined && metric.value <= q1Value) {
      findings.push({
        id: `B-${String(counter++).padStart(3, "0")}`,
        type: "benchmark_outlier",
        severity: "medium",
        location: { section: metricName },
        description: `"${metricName}" value of ${metric.value} ${metric.unit} falls in the bottom quartile of peers (Q1 threshold: ${q1Value.toFixed(2)} ${metric.unit}, mean: ${mean.toFixed(2)} ${metric.unit})`,
        expected: { value: mean.toFixed(2), source: `Peer benchmark (${peerValues.length} reports)` },
        found: { value: metric.value },
        recommendation: `Consider providing additional context or explanation for the below-average performance on ${metricName}.`,
        auditRisk: "Medium — bottom-quartile performance may require disclosure of improvement plans",
      });
    }
  }

  return findings;
}
