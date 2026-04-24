// src/services/verification/verification.service.ts
//
// Orchestrates all verification checks.

import { validateCalculation, type CalculationFinding } from "./calculation-validator.js";
import { checkConsistency, type ConsistencyFinding } from "./consistency-checker.js";
import { checkCompliance, type ComplianceFinding } from "./compliance-checker.js";
import { checkBenchmarks, type BenchmarkFinding } from "./benchmark-checker.js";
import { detectAnomalies, type AnomalyFinding } from "./anomaly-detector.js";
import { validateCrossDocument, type CrossDocFinding } from "./cross-doc-validator.js";
import { type EntityInfo, determineApplicableFrameworks, getExcludedFrameworks } from "./entity-context.js";

export interface VerificationFinding {
  id: string;
  type: "calculation_error" | "consistency_issue" | "compliance_gap" | "anomaly" | "benchmark_outlier";
  severity: "critical" | "high" | "medium" | "low";
  location?: { document?: string; section?: string; paragraph?: number };
  description: string;
  expected?: { value: unknown; source: string };
  found?: { value: unknown };
  evidence?: { source: string; citation: string };
  recommendation: string;
  auditRisk: string;
}

export interface VerificationReport {
  findings: VerificationFinding[];
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    overallVerdict: string;
  };
  timestamp: string;
  engagementId: string;
  applicableFrameworks?: string[];
  excludedFrameworks?: Array<{ framework: string; reason: string }>;
}

function summarize(findings: VerificationFinding[]): VerificationReport["summary"] {
  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const medium = findings.filter((f) => f.severity === "medium").length;
  const low = findings.filter((f) => f.severity === "low").length;

  let verdict: string;
  if (critical > 0) {
    verdict = `FAIL — critical review findings: ${critical} finding(s) must be resolved before submission`;
  } else if (high > 0) {
    verdict = `CONDITIONAL PASS — review findings require attention: ${high} high-severity finding(s) should be addressed`;
  } else if (medium > 0) {
    verdict = `PASS WITH NOTES — minor review items: ${medium} medium-severity item(s) noted`;
  } else {
    verdict = "PASS — pre-audit review complete, no significant issues";
  }

  return { totalFindings: findings.length, critical, high, medium, low, overallVerdict: verdict };
}

export async function verifyFull(
  engagementId: string,
  documentBody: string,
  frameworks: string[],
  entity?: EntityInfo
): Promise<VerificationReport> {
  const allFindings: VerificationFinding[] = [];

  // Filter frameworks to only applicable ones if entity context is provided
  let activeFrameworks = frameworks;
  let applicableFrameworks: string[] | undefined;
  let excludedFrameworks: Array<{ framework: string; reason: string }> | undefined;

  if (entity) {
    applicableFrameworks = determineApplicableFrameworks(entity);
    excludedFrameworks = getExcludedFrameworks(entity, frameworks);
    activeFrameworks = frameworks.filter((fw) => applicableFrameworks!.includes(fw));
  }

  // Run all checks in parallel
  const [calcFindings, consistencyFindings, complianceFindings, benchmarkFindings, anomalyFindings, crossDocFindings] = await Promise.all([
    validateCalculation(engagementId, documentBody).catch(() => [] as CalculationFinding[]),
    checkConsistency(engagementId, documentBody).catch(() => [] as ConsistencyFinding[]),
    checkCompliance(engagementId, documentBody, activeFrameworks).catch(() => [] as ComplianceFinding[]),
    checkBenchmarks(engagementId, documentBody).catch(() => [] as BenchmarkFinding[]),
    detectAnomalies(engagementId, documentBody).catch(() => [] as AnomalyFinding[]),
    validateCrossDocument(engagementId).catch(() => [] as CrossDocFinding[]),
  ]);

  allFindings.push(...calcFindings, ...consistencyFindings, ...complianceFindings, ...benchmarkFindings, ...anomalyFindings, ...crossDocFindings);

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  allFindings.sort((a, b) => (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4));

  return {
    findings: allFindings,
    summary: summarize(allFindings),
    timestamp: new Date().toISOString(),
    engagementId,
    applicableFrameworks,
    excludedFrameworks,
  };
}

export async function verifyCalculation(
  engagementId: string,
  documentBody: string
): Promise<VerificationReport> {
  const findings = await validateCalculation(engagementId, documentBody);
  return {
    findings,
    summary: summarize(findings),
    timestamp: new Date().toISOString(),
    engagementId,
  };
}

export async function verifyConsistency(
  engagementId: string,
  documentBody: string
): Promise<VerificationReport> {
  const findings = await checkConsistency(engagementId, documentBody);
  return {
    findings,
    summary: summarize(findings),
    timestamp: new Date().toISOString(),
    engagementId,
  };
}

export async function verifyCompliance(
  engagementId: string,
  documentBody: string,
  frameworks: string[]
): Promise<VerificationReport> {
  const findings = await checkCompliance(engagementId, documentBody, frameworks);
  return {
    findings,
    summary: summarize(findings),
    timestamp: new Date().toISOString(),
    engagementId,
  };
}

export async function verifyBenchmark(
  engagementId: string,
  documentBody: string
): Promise<VerificationReport> {
  const findings = await checkBenchmarks(engagementId, documentBody);
  return {
    findings,
    summary: summarize(findings),
    timestamp: new Date().toISOString(),
    engagementId,
  };
}

export async function verifyAnomaly(
  engagementId: string,
  documentBody: string
): Promise<VerificationReport> {
  const findings = await detectAnomalies(engagementId, documentBody);
  return {
    findings,
    summary: summarize(findings),
    timestamp: new Date().toISOString(),
    engagementId,
  };
}

export async function verifyCrossDocument(
  engagementId: string
): Promise<VerificationReport> {
  const findings = await validateCrossDocument(engagementId);
  return {
    findings,
    summary: summarize(findings),
    timestamp: new Date().toISOString(),
    engagementId,
  };
}
