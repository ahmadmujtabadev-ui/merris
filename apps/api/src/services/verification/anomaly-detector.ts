// src/services/verification/anomaly-detector.ts
//
// Detects statistical anomalies, missing periods, and internal
// consistency issues in engagement data points.

import { DataPointModel } from "../../modules/ingestion/ingestion.model.js";
import type { VerificationFinding } from "./verification.service.js";

export type AnomalyFinding = VerificationFinding;

export async function detectAnomalies(
  engagementId: string,
  documentBody: string
): Promise<AnomalyFinding[]> {
  const findings: AnomalyFinding[] = [];
  let counter = 1;

  // Get all confirmed data points for this engagement
  const dataPoints = await DataPointModel.find({
    engagementId,
    status: { $in: ["user_confirmed", "auto_extracted", "user_edited"] },
  }).lean();

  if (dataPoints.length === 0) return findings;

  // Group by metricName
  const metricGroups = new Map<string, typeof dataPoints>();
  for (const dp of dataPoints) {
    const key = dp.metricName;
    if (!metricGroups.has(key)) metricGroups.set(key, []);
    metricGroups.get(key)!.push(dp);
  }

  // ------------------------------------------------------------------
  // 1. Year-over-year change > 20%
  // ------------------------------------------------------------------
  for (const [metricName, points] of metricGroups) {
    // Sort by year ascending
    const sorted = points
      .filter((p) => p.period?.year != null)
      .sort((a, b) => a.period.year - b.period.year);

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;

      const prevVal = typeof prev.value === "number" ? prev.value : parseFloat(String(prev.value));
      const currVal = typeof curr.value === "number" ? curr.value : parseFloat(String(curr.value));

      if (isNaN(prevVal) || isNaN(currVal) || prevVal === 0) continue;

      const pctChange = ((currVal - prevVal) / Math.abs(prevVal)) * 100;

      if (Math.abs(pctChange) > 20) {
        const direction = pctChange > 0 ? "increase" : "decrease";
        findings.push({
          id: `A-${String(counter++).padStart(3, "0")}`,
          type: "anomaly",
          severity: Math.abs(pctChange) > 50 ? "high" : "medium",
          location: { section: metricName },
          description: `"${metricName}" shows a ${Math.abs(pctChange).toFixed(1)}% ${direction} from ${prev.period.year} (${prevVal} ${prev.unit}) to ${curr.period.year} (${currVal} ${curr.unit})`,
          expected: { value: `Within 20% of prior year`, source: "Year-over-year trend analysis" },
          found: { value: `${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}%` },
          recommendation: `Provide narrative explanation for the significant year-over-year ${direction} in ${metricName}. Auditors will expect justification for changes exceeding 20%.`,
          auditRisk: Math.abs(pctChange) > 50
            ? "High — large swings in reported metrics without explanation will trigger auditor inquiry"
            : "Medium — notable change that should be explained in narrative",
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // 2. Internal consistency: Scope 1 + Scope 2 = Total (if all exist)
  // ------------------------------------------------------------------
  const scopeMetrics = new Map<string, number>();
  for (const dp of dataPoints) {
    const name = dp.metricName.toLowerCase();
    const val = typeof dp.value === "number" ? dp.value : parseFloat(String(dp.value));
    if (isNaN(val)) continue;

    if (name.includes("scope 1") && !name.includes("scope 1+2") && !name.includes("total")) {
      scopeMetrics.set("scope1", val);
    } else if (name.includes("scope 2") && !name.includes("scope 1+2") && !name.includes("total")) {
      scopeMetrics.set("scope2", val);
    } else if (
      (name.includes("total") && (name.includes("ghg") || name.includes("emission"))) ||
      name.includes("scope 1+2") ||
      name.includes("scope 1 + 2")
    ) {
      scopeMetrics.set("total", val);
    }
  }

  const scope1 = scopeMetrics.get("scope1");
  const scope2 = scopeMetrics.get("scope2");
  const total = scopeMetrics.get("total");

  if (scope1 !== undefined && scope2 !== undefined && total !== undefined) {
    const expectedTotal = scope1 + scope2;
    const diff = Math.abs(total - expectedTotal);
    const tolerance = Math.abs(expectedTotal) * 0.01; // 1% tolerance for rounding

    if (diff > tolerance) {
      findings.push({
        id: `A-${String(counter++).padStart(3, "0")}`,
        type: "anomaly",
        severity: "critical",
        location: { section: "GHG Emissions Summary" },
        description: `Scope 1 (${scope1}) + Scope 2 (${scope2}) = ${expectedTotal}, but reported total is ${total} (difference: ${diff.toFixed(2)})`,
        expected: { value: expectedTotal, source: "Scope 1 + Scope 2 sum" },
        found: { value: total },
        recommendation: "Correct the emissions total to match the sum of Scope 1 and Scope 2, or explain any excluded/included categories.",
        auditRisk: "Critical — arithmetic errors in headline emissions figures are a red flag for auditors",
      });
    }
  }

  // ------------------------------------------------------------------
  // 3. Missing metrics: reported in prior periods but absent in current
  // ------------------------------------------------------------------
  // Determine the latest reporting year
  const allYears = dataPoints
    .map((dp) => dp.period?.year)
    .filter((y): y is number => y != null);

  if (allYears.length > 0) {
    const maxYear = Math.max(...allYears);
    const priorYears = new Set(allYears.filter((y) => y < maxYear));

    if (priorYears.size > 0) {
      // Metrics present in prior years
      const priorMetrics = new Set<string>();
      const currentMetrics = new Set<string>();

      for (const dp of dataPoints) {
        if (dp.period?.year != null && dp.period.year < maxYear) {
          priorMetrics.add(dp.metricName);
        }
        if (dp.period?.year === maxYear) {
          currentMetrics.add(dp.metricName);
        }
      }

      for (const metricName of priorMetrics) {
        if (!currentMetrics.has(metricName)) {
          findings.push({
            id: `A-${String(counter++).padStart(3, "0")}`,
            type: "anomaly",
            severity: "medium",
            location: { section: metricName },
            description: `"${metricName}" was reported in prior period(s) but is missing from the current reporting year (${maxYear})`,
            expected: { value: "Metric present", source: `Prior year data points` },
            found: { value: "Missing" },
            recommendation: `Either include ${metricName} in the current reporting period or provide a disclosure explaining why it has been discontinued.`,
            auditRisk: "Medium — discontinuing previously reported metrics without explanation may indicate selective disclosure",
          });
        }
      }
    }
  }

  return findings;
}
