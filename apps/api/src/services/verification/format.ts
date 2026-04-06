// src/services/verification/format.ts
//
// Standardized output formatters for verification results.

import type { VerificationReport, VerificationFinding } from "./verification.service";

export interface FormattedCalculationVerification {
  verdict: "Correct" | "Incorrect" | "Requires Review";
  reported: { value: number | string; unit: string };
  calculated: { value: number | string; unit: string };
  variance: { absolute: number | string; percentage: string };
  materiality: "Immaterial (<5%)" | "Material (>5%)" | "Critical (>20%)";
  formula: string;
  emissionFactor?: { value: number; source: string; year: number };
  methodology: string;
  regionalContext: string;
  compliance: string;
}

export interface FormattedVerificationSummary {
  overallVerdict: string;
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  consistencyFindings: VerificationFinding[];
  complianceGaps: {
    framework: string;
    missing: number;
    total: number;
    coveragePercent: number;
    highPriority: VerificationFinding[];
    mediumPriority: VerificationFinding[];
  }[];
  benchmarkOutliers: VerificationFinding[];
  anomalies: VerificationFinding[];
  calculationErrors: VerificationFinding[];
  applicableFrameworks: string[];
  excludedFrameworks: Array<{ framework: string; reason: string }>;
}

/** Known total disclosure counts per framework. */
const FRAMEWORK_TOTALS: Record<string, number> = {
  gri: 116,
  qse: 14,
  tcfd: 10,
  issb: 15,
  "saudi-exchange": 29,
  adx: 26,
  esrs: 66,
};

export function formatVerificationReport(
  report: VerificationReport,
): FormattedVerificationSummary {
  const { findings } = report;

  // Group findings by type
  const consistency = findings.filter((f) => f.type === "consistency_issue");
  const compliance = findings.filter((f) => f.type === "compliance_gap");
  const benchmarks = findings.filter((f) => f.type === "benchmark_outlier");
  const anomalies = findings.filter((f) => f.type === "anomaly");
  const calculations = findings.filter((f) => f.type === "calculation_error");

  // Group compliance findings by framework (first token of section)
  const fwGroups = new Map<string, VerificationFinding[]>();
  for (const f of compliance) {
    const section = f.location?.section || "";
    const fw = section.split(" ")[0] || "unknown";
    if (!fwGroups.has(fw)) fwGroups.set(fw, []);
    fwGroups.get(fw)!.push(f);
  }

  const complianceGaps = Array.from(fwGroups.entries())
    .map(([fw, items]) => {
      const total =
        FRAMEWORK_TOTALS[fw.toLowerCase()] || items.length;
      const missing = items.length;
      return {
        framework: fw,
        missing,
        total,
        coveragePercent: Math.round(((total - missing) / total) * 100),
        highPriority: items.filter((f) => f.severity === "high"),
        mediumPriority: items.filter((f) => f.severity === "medium"),
      };
    })
    .sort((a, b) => b.missing - a.missing);

  return {
    overallVerdict: report.summary.overallVerdict,
    totalFindings: report.summary.totalFindings,
    critical: report.summary.critical,
    high: report.summary.high,
    medium: report.summary.medium,
    low: report.summary.low,
    consistencyFindings: consistency,
    complianceGaps,
    benchmarkOutliers: benchmarks,
    anomalies,
    calculationErrors: calculations,
    applicableFrameworks: [],
    excludedFrameworks: [],
  };
}
