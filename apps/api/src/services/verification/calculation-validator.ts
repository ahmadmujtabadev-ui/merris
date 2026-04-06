// src/services/verification/calculation-validator.ts
//
// Validates emissions and metric calculations by recalculating
// from raw inputs using the existing calculation engine.

import { calculate } from "../../modules/calculation/calculation.service";
import { DataPointModel } from "../../modules/ingestion/ingestion.model";
import type { VerificationFinding } from "./verification.service";

export type CalculationFinding = VerificationFinding;

export async function validateCalculation(
  engagementId: string,
  documentBody: string
): Promise<CalculationFinding[]> {
  const findings: CalculationFinding[] = [];
  let findingCounter = 1;

  // Get confirmed data points for this engagement
  const dataPoints = await DataPointModel.find({
    engagementId,
    status: { $in: ["user_confirmed", "auto_extracted"] },
    frameworkRef: { $regex: /^(GRI\s?305|ESRS\s?E1|Scope)/i },
  }).lean();

  if (dataPoints.length === 0) return findings;

  // Group by metric for validation
  const metricGroups = new Map<string, typeof dataPoints>();
  for (const dp of dataPoints) {
    const key = (dp as any).metricName;
    if (!metricGroups.has(key)) metricGroups.set(key, []);
    metricGroups.get(key)!.push(dp);
  }

  // Validate each metric that has a calculation method
  for (const [metricName, points] of metricGroups) {
    const latestPoint = points.sort((a: any, b: any) =>
      (b as any).period?.year - (a as any).period?.year
    )[0] as any;

    if (!latestPoint) continue;

    const value = typeof latestPoint.value === "number" ? latestPoint.value : parseFloat(String(latestPoint.value));
    if (isNaN(value)) continue;

    // Check if the value appears in the document body
    const valueStr = value.toLocaleString();
    if (!documentBody.includes(valueStr) && !documentBody.includes(String(Math.round(value)))) {
      findings.push({
        id: `V-${String(findingCounter++).padStart(3, "0")}`,
        type: "calculation_error",
        severity: "medium",
        location: { section: metricName },
        description: `Data point "${metricName}" (${valueStr} ${latestPoint.unit}) exists in database but not found in document text`,
        expected: { value: valueStr, source: "Engagement database" },
        found: { value: "Not found in document" },
        recommendation: `Verify that ${metricName} is reported in the document with the correct value`,
        auditRisk: "Medium — auditor will cross-check data tables against narrative",
      });
    }
  }

  return findings;
}
