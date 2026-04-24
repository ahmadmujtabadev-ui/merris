// src/services/verification/compliance-checker.ts
//
// Checks framework line-item compliance.

import { Disclosure } from "../../models/disclosure.model.js";
import type { VerificationFinding } from "./verification.service.js";

export type ComplianceFinding = VerificationFinding;

export async function checkCompliance(
  engagementId: string,
  documentBody: string,
  frameworkCodes: string[]
): Promise<ComplianceFinding[]> {
  const findings: ComplianceFinding[] = [];
  if (!documentBody || frameworkCodes.length === 0) return findings;

  let counter = 1;
  const docLower = documentBody.toLowerCase();

  for (const fwCode of frameworkCodes) {
    // Get mandatory disclosures for this framework
    const disclosures = await Disclosure.find({
      frameworkCode: fwCode,
    }).lean();

    if (disclosures.length === 0) continue;

    for (const disc of disclosures) {
      const d = disc as any;
      // Check if disclosure code or name appears in document
      const codeFound = docLower.includes(d.code.toLowerCase());
      const nameFound = docLower.includes(d.name.toLowerCase().substring(0, 30));

      // Check if any required metrics are mentioned
      const metricsFound = (d.requiredMetrics || []).some((m: any) =>
        docLower.includes(m.name.toLowerCase().substring(0, 20))
      );

      if (!codeFound && !nameFound && !metricsFound) {
        findings.push({
          id: `R-${String(counter++).padStart(3, "0")}`,
          type: "compliance_gap",
          severity: d.dataType === "quantitative" ? "high" : "medium",
          location: { section: `${fwCode} ${d.code}` },
          description: `Missing disclosure: ${d.code} — ${d.name}`,
          expected: { value: d.name, source: `${fwCode} framework requirements` },
          recommendation: `Add disclosure for ${d.code}: ${d.name}. ${d.guidanceText?.substring(0, 100) || ""}`,
          auditRisk: "High — mandatory disclosures must be addressed for framework compliance",
        });
      }
    }
  }

  return findings;
}
