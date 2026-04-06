// src/services/verification/consistency-checker.ts
//
// Checks narrative-data consistency within a document.

import { sendMessage } from "../../lib/claude";
import type { VerificationFinding } from "./verification.service";

export type ConsistencyFinding = VerificationFinding;

export async function checkConsistency(
  engagementId: string,
  documentBody: string
): Promise<ConsistencyFinding[]> {
  const findings: ConsistencyFinding[] = [];

  if (!documentBody || documentBody.trim().length < 100) return findings;

  // Use Claude to detect inconsistencies
  const prompt = `You are a senior ESG auditor reviewing a document for internal consistency.

Analyze this document and identify:
1. Quantitative claims in narrative text that contradict data tables or other numbers
2. Claims of "reduction" or "increase" that don't match the actual numbers
3. Numbers that appear multiple times with different values
4. Unsupported claims (narrative makes a claim with no supporting data nearby)

Document:
${documentBody.substring(0, 15000)}

Respond as JSON array only. Each item:
{"section":"section name","description":"what is inconsistent","severity":"high|medium|low","recommendation":"how to fix"}

If no inconsistencies found, return [].`;

  const response = await sendMessage({
    system: "You are a precise ESG document auditor. Return only valid JSON arrays.",
    messages: [{ role: "user", content: prompt }],
    maxTokens: 2000,
  });

  if (!response) return findings;

  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return findings;

    const items = JSON.parse(jsonMatch[0]);
    let counter = 1;

    for (const item of items) {
      findings.push({
        id: `C-${String(counter++).padStart(3, "0")}`,
        type: "consistency_issue",
        severity: item.severity || "medium",
        location: { section: item.section },
        description: item.description,
        recommendation: item.recommendation || "Review and correct the inconsistency",
        auditRisk: item.severity === "high"
          ? "High — auditor will flag contradictions between narrative and data"
          : "Medium — inconsistency may undermine report credibility",
      });
    }
  } catch {
    // JSON parse failed — return empty
  }

  return findings;
}
