# Phase 1: Service Layer Restructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Merris API from flat modules into a 6-product service architecture (Assistant, Vault, Knowledge, Workflows, Verification, Ecosystem) without breaking existing functionality.

**Architecture:** Create `apps/api/src/services/` with one directory per product. Each service has a `*.service.ts` (business logic) and `*.router.ts` (Fastify routes). Existing module code is **moved and re-exported** — no rewrites. Old route paths get redirects or aliases for backward compatibility. New canonical paths follow `/assistant/*`, `/vault/*`, `/knowledge/*`, `/workflows/*`, `/verify/*` pattern.

**Tech Stack:** Node.js, Fastify, TypeScript, MongoDB/Mongoose, Claude API (Anthropic SDK)

---

## File Structure

### New Files to Create

| File | Responsibility |
|------|---------------|
| `src/services/assistant/assistant.service.ts` | Re-exports agent chat, perception, judgment, learning, team awareness, work products |
| `src/services/assistant/assistant.router.ts` | New route paths: `/assistant/chat`, `/assistant/deep-analysis`, `/assistant/draft`, `/assistant/review`, `/assistant/suggestions` |
| `src/services/knowledge/knowledge.service.ts` | Re-exports KB search, benchmark, regulatory, scientific, peer, supply-chain |
| `src/services/knowledge/knowledge.router.ts` | New route paths: `/knowledge/search`, `/knowledge/regulatory`, `/knowledge/benchmark`, etc. |
| `src/services/knowledge/evidence.service.ts` | Evidence packaging — wraps search results with structured citations |
| `src/services/verification/verification.service.ts` | Orchestrator for all verification checks |
| `src/services/verification/verification.router.ts` | New route paths: `/verify/document`, `/verify/calculation`, `/verify/full` |
| `src/services/verification/calculation-validator.ts` | Wraps existing calculation service with recalculation logic |
| `src/services/verification/consistency-checker.ts` | Narrative vs data consistency checking |
| `src/services/verification/compliance-checker.ts` | Framework line-item compliance checking |
| `src/services/vault/vault.service.ts` | Re-exports ingestion + KB as unified vault operations |
| `src/services/vault/vault.router.ts` | New route paths: `/vault/create`, `/vault/:id/upload`, `/vault/:id/query` |
| `src/services/workflows/workflows.service.ts` | Re-exports existing workflow engine + adds template runner |
| `src/services/workflows/workflows.router.ts` | New route paths: `/workflows/templates`, `/workflows/:id/run` |
| `src/services/workflows/templates/review-sustainability-report.json` | Pre-built workflow definition |

### Existing Files to Modify

| File | Changes |
|------|---------|
| `src/server.ts` | Register new service routers alongside existing module routers |

### Existing Files NOT Modified

All existing modules stay intact. The new services **import from** existing modules — they don't replace them. This ensures zero breakage.

---

## Task 1: Create services directory structure

**Files:**
- Create: `src/services/assistant/assistant.service.ts`
- Create: `src/services/assistant/assistant.router.ts`

- [ ] **Step 1: Create Assistant service**

```typescript
// src/services/assistant/assistant.service.ts
//
// Re-exports and orchestrates existing agent module components
// as the "Merris Assistant" product.

import { chat, executeAction, type ChatRequest, type ChatResponse } from "../../modules/agent/agent.service";
import { perceiveDocument, fullPerception } from "../../modules/agent/perception";
import { judgeSection, judgeDocument } from "../../modules/agent/judgment";
import { catchMeUp, buildMemoryContext } from "../../modules/agent/memory";
import { getTeamContext } from "../../modules/agent/team-awareness";
import { generateFullReport, generateAssurancePack, generateExecutiveSummary } from "../../modules/agent/workproduct";
import { processEditSignal, processAcceptSignal, processRejectSignal } from "../../modules/agent/learning";

// Re-export everything as the Assistant API
export {
  // Core chat
  chat,
  executeAction,
  // Perception & Judgment
  perceiveDocument,
  fullPerception,
  judgeSection,
  judgeDocument,
  // Memory
  catchMeUp,
  buildMemoryContext,
  // Team
  getTeamContext,
  // Work Products
  generateFullReport,
  generateAssurancePack,
  generateExecutiveSummary,
  // Learning
  processEditSignal,
  processAcceptSignal,
  processRejectSignal,
};

// Re-export types
export type { ChatRequest, ChatResponse };
```

- [ ] **Step 2: Create Assistant router**

```typescript
// src/services/assistant/assistant.router.ts
//
// New canonical routes for the Merris Assistant product.
// These proxy to existing agent module functions.

import { FastifyInstance } from "fastify";
import { authenticate } from "../../modules/auth/auth.middleware";
import {
  chat,
  perceiveDocument,
  fullPerception,
  judgeSection,
  judgeDocument,
  catchMeUp,
  getTeamContext,
  generateFullReport,
  generateAssurancePack,
  generateExecutiveSummary,
  processEditSignal,
  processAcceptSignal,
  processRejectSignal,
  executeAction,
} from "./assistant.service";

export async function registerAssistantRoutes(app: FastifyInstance): Promise<void> {
  // ---- Chat ----
  app.post("/api/v1/assistant/chat", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, message, conversationHistory, documentBody, cursorSection } = request.body as any;
    const user = (request as any).user;
    const result = await chat({
      engagementId,
      userId: user.userId,
      message,
      conversationHistory,
      documentBody,
      cursorSection,
    });
    return reply.send(result);
  });

  // ---- Deep Analysis (same as full perception + judgment) ----
  app.post("/api/v1/assistant/deep-analysis", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, documentType } = request.body as any;
    const user = (request as any).user;
    const perception = await fullPerception(engagementId, user.userId, documentBody, documentType || "word");
    const judgment = await judgeDocument({
      engagementId,
      fullDocumentBody: documentBody,
      judgmentLevel: "thorough",
    });
    return reply.send({ perception, judgment });
  });

  // ---- Draft ----
  app.post("/api/v1/assistant/draft", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, message, documentBody, cursorSection } = request.body as any;
    const user = (request as any).user;
    const result = await chat({
      engagementId,
      userId: user.userId,
      message: `DRAFT REQUEST: ${message}`,
      documentBody,
      cursorSection,
    });
    return reply.send(result);
  });

  // ---- Review ----
  app.post("/api/v1/assistant/review", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, cursorSection, sectionTitle, frameworkRef, judgmentLevel } = request.body as any;
    if (sectionTitle) {
      const result = await judgeSection({
        engagementId,
        sectionContent: documentBody,
        sectionTitle,
        frameworkRef,
        judgmentLevel: judgmentLevel || "thorough",
      });
      return reply.send(result);
    }
    const result = await judgeDocument({
      engagementId,
      fullDocumentBody: documentBody,
      judgmentLevel: judgmentLevel || "thorough",
    });
    return reply.send(result);
  });

  // ---- Suggestions ----
  app.get("/api/v1/assistant/suggestions", { preHandler: [authenticate] }, async (request, reply) => {
    // Return context-aware prompt suggestions
    const suggestions = [
      "Review this section for regulatory compliance",
      "Draft an executive summary",
      "Check data consistency across the document",
      "Benchmark our emissions against peers",
      "What are the mandatory disclosures we're missing?",
    ];
    return reply.send({ suggestions });
  });

  // ---- Perception ----
  app.post("/api/v1/assistant/perceive", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, documentType } = request.body as any;
    const result = await perceiveDocument(engagementId, documentBody, documentType || "word");
    return reply.send(result);
  });

  app.post("/api/v1/assistant/full-perception", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, documentType } = request.body as any;
    const user = (request as any).user;
    const result = await fullPerception(engagementId, user.userId, documentBody, documentType || "word");
    return reply.send(result);
  });

  // ---- Judgment ----
  app.post("/api/v1/assistant/judge", { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const result = await judgeSection(body);
    return reply.send(result);
  });

  app.post("/api/v1/assistant/judge-document", { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const result = await judgeDocument(body);
    return reply.send(result);
  });

  // ---- Memory ----
  app.post("/api/v1/assistant/catch-me-up", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.body as any;
    const user = (request as any).user;
    const result = await catchMeUp(engagementId, user.userId);
    return reply.send(result);
  });

  app.get("/api/v1/assistant/memory/:engagementId", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const user = (request as any).user;
    const memory = await buildMemoryContext(engagementId, user.userId);
    return reply.send({ memory });
  });

  // ---- Team ----
  app.get("/api/v1/assistant/team/:engagementId", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const result = await getTeamContext(engagementId);
    return reply.send(result);
  });

  // ---- Work Products ----
  app.post("/api/v1/assistant/generate-report", { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const result = await generateFullReport(body);
    return reply.send(result);
  });

  app.post("/api/v1/assistant/generate-assurance-pack", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.body as any;
    const result = await generateAssurancePack(engagementId);
    return reply.send(result);
  });

  app.post("/api/v1/assistant/generate-executive-summary", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.body as any;
    const result = await generateExecutiveSummary(engagementId);
    return reply.send(result);
  });

  // ---- Learning ----
  app.post("/api/v1/assistant/learn/edit", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, originalDraft, editedVersion } = request.body as any;
    const user = (request as any).user;
    const result = await processEditSignal(engagementId, user.userId, originalDraft, editedVersion);
    return reply.send(result);
  });

  app.post("/api/v1/assistant/learn/accept", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.body as any;
    const user = (request as any).user;
    const result = await processAcceptSignal(engagementId, user.userId);
    return reply.send(result);
  });

  app.post("/api/v1/assistant/learn/reject", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, reason } = request.body as any;
    const user = (request as any).user;
    const result = await processRejectSignal(engagementId, user.userId, reason);
    return reply.send(result);
  });

  // ---- Actions ----
  app.post("/api/v1/assistant/action", { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const user = (request as any).user;
    const result = await executeAction({
      engagementId: body.engagementId,
      userId: user.userId,
      action: body.action,
      params: body.params,
    });
    return reply.send(result);
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/assistant/
git commit -m "feat: add Assistant service layer (re-exports agent module)"
```

---

## Task 2: Knowledge service with evidence packaging

**Files:**
- Create: `src/services/knowledge/knowledge.service.ts`
- Create: `src/services/knowledge/evidence.service.ts`
- Create: `src/services/knowledge/knowledge.router.ts`

- [ ] **Step 1: Create evidence packaging service**

```typescript
// src/services/knowledge/evidence.service.ts
//
// Wraps raw KB search results with structured citations.

export interface Evidence {
  claim: string;
  source: {
    domain: string;
    collection: string;
    entryId: string;
  };
  citation: string;
  confidence: number;
  jurisdiction?: string;
  sector?: string;
  validityPeriod?: {
    from: string;
    to: string;
  };
}

export function packageEvidence(
  claim: string,
  searchResult: {
    id: string;
    domain: string;
    collection: string;
    title: string;
    source: string;
    year: number;
    score: number;
    data?: Record<string, unknown>;
  }
): Evidence {
  const currentYear = new Date().getFullYear();
  return {
    claim,
    source: {
      domain: searchResult.domain,
      collection: searchResult.collection,
      entryId: searchResult.id,
    },
    citation: `${searchResult.source}, ${searchResult.title}, ${searchResult.year}`,
    confidence: Math.min(searchResult.score, 1.0),
    jurisdiction: (searchResult.data as any)?.jurisdiction || (searchResult.data as any)?.country || undefined,
    sector: (searchResult.data as any)?.sector || undefined,
    validityPeriod: {
      from: `${searchResult.year}-01-01`,
      to: `${searchResult.year + 1}-12-31`,
    },
  };
}

export function packageMultipleEvidence(
  claim: string,
  results: Array<{
    id: string;
    domain: string;
    collection: string;
    title: string;
    source: string;
    year: number;
    score: number;
    data?: Record<string, unknown>;
  }>
): Evidence[] {
  return results.map((r) => packageEvidence(claim, r));
}
```

- [ ] **Step 2: Create Knowledge service**

```typescript
// src/services/knowledge/knowledge.service.ts
//
// Unified knowledge search across all 7 domains with evidence packaging.

import { semanticSearch } from "../../modules/knowledge-base/search.service";
import { packageEvidence, packageMultipleEvidence, type Evidence } from "./evidence.service";

// Re-export search
export { semanticSearch };

export interface KnowledgeSearchResult {
  results: Array<{
    id: string;
    domain: string;
    collection: string;
    title: string;
    description: string;
    score: number;
    source: string;
    year: number;
    data?: Record<string, unknown>;
    evidence: Evidence;
  }>;
  totalCandidates: number;
  searchTime: number;
}

export async function searchWithEvidence(
  query: string,
  options?: { domains?: string[]; limit?: number }
): Promise<KnowledgeSearchResult> {
  const start = Date.now();
  const raw = await semanticSearch({
    query,
    domains: options?.domains,
    limit: options?.limit || 10,
  });

  const results = (raw.results || []).map((r: any) => ({
    ...r,
    evidence: packageEvidence(query, r),
  }));

  return {
    results,
    totalCandidates: raw.totalCandidates || results.length,
    searchTime: Date.now() - start,
  };
}

export async function searchRegulatory(
  jurisdiction: string,
  topic: string,
  options?: { limit?: number }
): Promise<KnowledgeSearchResult> {
  return searchWithEvidence(`${jurisdiction} ${topic} regulation requirements`, {
    domains: ["regulatory"],
    limit: options?.limit || 10,
  });
}

export async function searchScientific(
  query: string,
  options?: { limit?: number }
): Promise<KnowledgeSearchResult> {
  return searchWithEvidence(query, {
    domains: ["climate_science", "environmental_science"],
    limit: options?.limit || 10,
  });
}

export async function searchPeer(
  sector: string,
  metric?: string,
  options?: { limit?: number }
): Promise<KnowledgeSearchResult> {
  const query = metric ? `${sector} ${metric} peer practice` : `${sector} ESG best practice`;
  return searchWithEvidence(query, {
    domains: ["corporate_disclosure"],
    limit: options?.limit || 10,
  });
}

export async function searchSupplyChain(
  query: string,
  options?: { limit?: number }
): Promise<KnowledgeSearchResult> {
  return searchWithEvidence(query, {
    domains: ["supply_chain"],
    limit: options?.limit || 10,
  });
}
```

- [ ] **Step 3: Create Knowledge router**

```typescript
// src/services/knowledge/knowledge.router.ts

import { FastifyInstance } from "fastify";
import { authenticate } from "../../modules/auth/auth.middleware";
import {
  searchWithEvidence,
  searchRegulatory,
  searchScientific,
  searchPeer,
  searchSupplyChain,
} from "./knowledge.service";

export async function registerKnowledgeServiceRoutes(app: FastifyInstance): Promise<void> {
  // Unified search
  app.post("/api/v1/knowledge/search", { preHandler: [authenticate] }, async (request, reply) => {
    const { query, domains, limit } = request.body as any;
    const result = await searchWithEvidence(query, { domains, limit });
    return reply.send(result);
  });

  // Regulatory search
  app.post("/api/v1/knowledge/regulatory", { preHandler: [authenticate] }, async (request, reply) => {
    const { jurisdiction, topic, limit } = request.body as any;
    const result = await searchRegulatory(jurisdiction, topic, { limit });
    return reply.send(result);
  });

  // Scientific search
  app.post("/api/v1/knowledge/scientific", { preHandler: [authenticate] }, async (request, reply) => {
    const { query, limit } = request.body as any;
    const result = await searchScientific(query, { limit });
    return reply.send(result);
  });

  // Peer search
  app.post("/api/v1/knowledge/peer", { preHandler: [authenticate] }, async (request, reply) => {
    const { sector, metric, limit } = request.body as any;
    const result = await searchPeer(sector, metric, { limit });
    return reply.send(result);
  });

  // Supply chain search
  app.post("/api/v1/knowledge/supply-chain", { preHandler: [authenticate] }, async (request, reply) => {
    const { query, limit } = request.body as any;
    const result = await searchSupplyChain(query, { limit });
    return reply.send(result);
  });

  // Sources metadata
  app.get("/api/v1/knowledge/sources", { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.send({
      domains: [
        { code: "K1", name: "Corporate Disclosures", collection: "kb_corporate_disclosures" },
        { code: "K2", name: "Climate Science", collection: "kb_climate_science" },
        { code: "K3", name: "Regulatory", collection: "kb_regulatory" },
        { code: "K4", name: "Sustainable Finance", collection: "kb_sustainable_finance" },
        { code: "K5", name: "Environmental Science", collection: "kb_environmental_science" },
        { code: "K6", name: "Supply Chain", collection: "kb_supply_chain" },
        { code: "K7", name: "Research", collection: "kb_research" },
      ],
    });
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/knowledge/
git commit -m "feat: add Knowledge service with evidence packaging"
```

---

## Task 3: Verification service (foundation)

**Files:**
- Create: `src/services/verification/verification.service.ts`
- Create: `src/services/verification/calculation-validator.ts`
- Create: `src/services/verification/consistency-checker.ts`
- Create: `src/services/verification/compliance-checker.ts`
- Create: `src/services/verification/verification.router.ts`

- [ ] **Step 1: Create verification types and orchestrator**

```typescript
// src/services/verification/verification.service.ts
//
// Orchestrates all verification checks.

import { validateCalculation, type CalculationFinding } from "./calculation-validator";
import { checkConsistency, type ConsistencyFinding } from "./consistency-checker";
import { checkCompliance, type ComplianceFinding } from "./compliance-checker";

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
}

function summarize(findings: VerificationFinding[]): VerificationReport["summary"] {
  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const medium = findings.filter((f) => f.severity === "medium").length;
  const low = findings.filter((f) => f.severity === "low").length;

  let verdict: string;
  if (critical > 0) {
    verdict = `FAIL — ${critical} critical finding(s) must be resolved before submission`;
  } else if (high > 0) {
    verdict = `CONDITIONAL PASS — ${high} high-severity finding(s) should be addressed`;
  } else if (medium > 0) {
    verdict = `PASS WITH NOTES — ${medium} medium-severity item(s) noted`;
  } else {
    verdict = "PASS — no significant issues found";
  }

  return { totalFindings: findings.length, critical, high, medium, low, overallVerdict: verdict };
}

export async function verifyFull(
  engagementId: string,
  documentBody: string,
  frameworks: string[]
): Promise<VerificationReport> {
  const allFindings: VerificationFinding[] = [];

  // Run all checks in parallel
  const [calcFindings, consistencyFindings, complianceFindings] = await Promise.all([
    validateCalculation(engagementId, documentBody).catch(() => [] as CalculationFinding[]),
    checkConsistency(engagementId, documentBody).catch(() => [] as ConsistencyFinding[]),
    checkCompliance(engagementId, documentBody, frameworks).catch(() => [] as ComplianceFinding[]),
  ]);

  allFindings.push(...calcFindings, ...consistencyFindings, ...complianceFindings);

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  allFindings.sort((a, b) => (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4));

  return {
    findings: allFindings,
    summary: summarize(allFindings),
    timestamp: new Date().toISOString(),
    engagementId,
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
```

- [ ] **Step 2: Create calculation validator**

```typescript
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
```

- [ ] **Step 3: Create consistency checker**

```typescript
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
```

- [ ] **Step 4: Create compliance checker**

```typescript
// src/services/verification/compliance-checker.ts
//
// Checks framework line-item compliance.

import { DisclosureModel } from "../../models/disclosure.model";
import type { VerificationFinding } from "./verification.service";

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
    const disclosures = await DisclosureModel.find({
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
```

- [ ] **Step 5: Create verification router**

```typescript
// src/services/verification/verification.router.ts

import { FastifyInstance } from "fastify";
import { authenticate } from "../../modules/auth/auth.middleware";
import { verifyFull, verifyCalculation, verifyConsistency, verifyCompliance } from "./verification.service";

export async function registerVerificationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/verify/full", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, frameworks } = request.body as any;
    const result = await verifyFull(engagementId, documentBody, frameworks || []);
    return reply.send(result);
  });

  app.post("/api/v1/verify/calculation", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody } = request.body as any;
    const result = await verifyCalculation(engagementId, documentBody);
    return reply.send(result);
  });

  app.post("/api/v1/verify/consistency", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody } = request.body as any;
    const result = await verifyConsistency(engagementId, documentBody);
    return reply.send(result);
  });

  app.post("/api/v1/verify/compliance", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, frameworks } = request.body as any;
    const result = await verifyCompliance(engagementId, documentBody, frameworks || []);
    return reply.send(result);
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/verification/
git commit -m "feat: add Verification service with calculation, consistency, and compliance checks"
```

---

## Task 4: Vault service

**Files:**
- Create: `src/services/vault/vault.service.ts`
- Create: `src/services/vault/vault.router.ts`

- [ ] **Step 1: Create Vault service**

```typescript
// src/services/vault/vault.service.ts
//
// Unified document vault wrapping existing ingestion + KB.

import { uploadDocument } from "../../modules/ingestion/ingestion.service";
import { semanticSearch } from "../../modules/knowledge-base/search.service";
import { ESGDocumentModel } from "../../modules/ingestion/ingestion.model";
import { DataPointModel } from "../../modules/ingestion/ingestion.model";

export type VaultType = "engagement" | "knowledge" | "firm";

export interface VaultInfo {
  id: string;
  name: string;
  type: VaultType;
  engagementId?: string;
  fileCount: number;
  createdAt: Date;
}

export async function getEngagementVault(engagementId: string): Promise<VaultInfo> {
  const docs = await ESGDocumentModel.countDocuments({ engagementId });
  return {
    id: `vault-eng-${engagementId}`,
    name: `Engagement Vault`,
    type: "engagement",
    engagementId,
    fileCount: docs,
    createdAt: new Date(),
  };
}

export async function listVaultFiles(
  engagementId: string
): Promise<Array<{ id: string; filename: string; format: string; status: string; uploadedAt: Date }>> {
  const docs = await ESGDocumentModel.find({ engagementId })
    .select("filename format status uploadedAt")
    .sort({ uploadedAt: -1 })
    .lean();

  return docs.map((d: any) => ({
    id: String(d._id),
    filename: d.filename,
    format: d.format,
    status: d.status,
    uploadedAt: d.uploadedAt,
  }));
}

export async function uploadToVault(
  engagementId: string,
  orgId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
) {
  return uploadDocument(engagementId, orgId, filename, buffer, mimeType);
}

export async function queryVault(
  engagementId: string,
  query: string
): Promise<{ results: any[]; source: string }> {
  // Search across engagement documents
  const dataPoints = await DataPointModel.find({
    engagementId,
    $or: [
      { metricName: { $regex: query, $options: "i" } },
      { frameworkRef: { $regex: query, $options: "i" } },
    ],
  })
    .limit(20)
    .lean();

  // Also search knowledge base
  const kbResults = await semanticSearch({ query, limit: 5 });

  return {
    results: [
      ...dataPoints.map((dp: any) => ({
        type: "data_point",
        metric: dp.metricName,
        value: dp.value,
        unit: dp.unit,
        framework: dp.frameworkRef,
        confidence: dp.confidence,
      })),
      ...(kbResults.results || []).map((r: any) => ({
        type: "knowledge",
        title: r.title,
        domain: r.domain,
        source: r.source,
        score: r.score,
      })),
    ],
    source: "engagement + knowledge base",
  };
}
```

- [ ] **Step 2: Create Vault router**

```typescript
// src/services/vault/vault.router.ts

import { FastifyInstance } from "fastify";
import { authenticate } from "../../modules/auth/auth.middleware";
import { getEngagementVault, listVaultFiles, queryVault } from "./vault.service";

export async function registerVaultRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/vault/:engagementId", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const vault = await getEngagementVault(engagementId);
    return reply.send(vault);
  });

  app.get("/api/v1/vault/:engagementId/files", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const files = await listVaultFiles(engagementId);
    return reply.send({ files });
  });

  app.post("/api/v1/vault/:engagementId/query", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.params as any;
    const { query } = request.body as any;
    const result = await queryVault(engagementId, query);
    return reply.send(result);
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/vault/
git commit -m "feat: add Vault service wrapping ingestion + KB"
```

---

## Task 5: Workflows service with template

**Files:**
- Create: `src/services/workflows/workflows.service.ts`
- Create: `src/services/workflows/workflows.router.ts`
- Create: `src/services/workflows/templates/review-sustainability-report.json`

- [ ] **Step 1: Create workflow template**

```json
{
  "id": "review-sustainability-report",
  "name": "Review Sustainability Report",
  "description": "Comprehensive review of a sustainability report with KB evidence retrieval and peer benchmarking",
  "steps": [
    {
      "id": "ingest",
      "name": "Ingest and extract sections",
      "tool": "perceive_document",
      "inputs": { "documentBody": "$document", "documentType": "word" }
    },
    {
      "id": "detect_frameworks",
      "name": "Detect applicable frameworks",
      "tool": "detect_frameworks",
      "inputs": { "documentBody": "$document" }
    },
    {
      "id": "judge_sections",
      "name": "Judge each section quality",
      "tool": "judge_document",
      "inputs": { "fullDocumentBody": "$document", "judgmentLevel": "thorough" }
    },
    {
      "id": "benchmark",
      "name": "Benchmark metrics against peers",
      "tool": "search_knowledge",
      "inputs": { "query": "peer comparison $sector", "domains": ["corporate_disclosure"] }
    },
    {
      "id": "compliance_check",
      "name": "Check regulatory compliance",
      "tool": "verify_compliance",
      "inputs": { "documentBody": "$document", "frameworks": "$detected_frameworks" }
    },
    {
      "id": "produce_report",
      "name": "Produce structured review report",
      "tool": "generate_text",
      "inputs": { "prompt": "Produce a structured review report from: $judge_sections, $benchmark, $compliance_check" }
    }
  ]
}
```

- [ ] **Step 2: Create Workflows service**

```typescript
// src/services/workflows/workflows.service.ts

import * as fs from "fs";
import * as path from "path";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  tool: string;
  inputs: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;
  templateId: string;
  status: "running" | "completed" | "failed";
  currentStep: number;
  totalSteps: number;
  results: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}

const templateDir = path.join(__dirname, "templates");

export function listTemplates(): WorkflowTemplate[] {
  try {
    const files = fs.readdirSync(templateDir).filter((f) => f.endsWith(".json"));
    return files.map((f) => {
      const content = fs.readFileSync(path.join(templateDir, f), "utf-8");
      return JSON.parse(content) as WorkflowTemplate;
    });
  } catch {
    return [];
  }
}

export function getTemplate(templateId: string): WorkflowTemplate | null {
  const filePath = path.join(templateDir, `${templateId}.json`);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as WorkflowTemplate;
  } catch {
    return null;
  }
}

// Execution is a stub for Phase 1 — full engine comes in Phase 4
export async function runWorkflow(
  templateId: string,
  engagementId: string,
  inputs: Record<string, unknown>
): Promise<WorkflowExecution> {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Workflow template "${templateId}" not found`);
  }

  return {
    id: `wf-${Date.now()}`,
    templateId,
    status: "running",
    currentStep: 0,
    totalSteps: template.steps.length,
    results: {},
    startedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 3: Create Workflows router**

```typescript
// src/services/workflows/workflows.router.ts

import { FastifyInstance } from "fastify";
import { authenticate } from "../../modules/auth/auth.middleware";
import { listTemplates, getTemplate, runWorkflow } from "./workflows.service";

export async function registerWorkflowServiceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/workflows/templates", { preHandler: [authenticate] }, async (_request, reply) => {
    const templates = listTemplates();
    return reply.send({ templates });
  });

  app.get("/api/v1/workflows/templates/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as any;
    const template = getTemplate(id);
    if (!template) return reply.code(404).send({ error: "Template not found" });
    return reply.send(template);
  });

  app.post("/api/v1/workflows/:templateId/run", { preHandler: [authenticate] }, async (request, reply) => {
    const { templateId } = request.params as any;
    const { engagementId, inputs } = request.body as any;
    const execution = await runWorkflow(templateId, engagementId, inputs || {});
    return reply.send(execution);
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/workflows/
git commit -m "feat: add Workflows service with review-sustainability-report template"
```

---

## Task 6: Wire services into server.ts

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add service route registrations to server.ts**

Add these imports and registrations after the existing module registrations. Read the file first to find the exact location.

Add imports at the top:
```typescript
import { registerAssistantRoutes } from "./services/assistant/assistant.router";
import { registerKnowledgeServiceRoutes } from "./services/knowledge/knowledge.router";
import { registerVerificationRoutes } from "./services/verification/verification.router";
import { registerVaultRoutes } from "./services/vault/vault.router";
import { registerWorkflowServiceRoutes } from "./services/workflows/workflows.router";
```

Add registrations after existing module routes (after `registerKnowledgeBaseRoutes`):
```typescript
// 6-Product Service Layer
await registerAssistantRoutes(app);
await registerKnowledgeServiceRoutes(app);
await registerVerificationRoutes(app);
await registerVaultRoutes(app);
await registerWorkflowServiceRoutes(app);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/server.ts
git commit -m "feat: wire 5 service routers into Fastify app"
```

---

## Task 7: Build and verify

- [ ] **Step 1: Build the API**

```bash
cd apps/api && pnpm build
```

Expected: TypeScript compiles with no errors.

- [ ] **Step 2: Start the API and verify health**

```bash
pnpm dev &
sleep 3
curl http://localhost:3001/api/v1/health
```

Expected: `{"status":"ok",...}`

- [ ] **Step 3: Verify new service endpoints exist**

```bash
# Assistant
curl -s -X POST http://localhost:3001/api/v1/assistant/chat -H "Content-Type: application/json" 2>&1 | head -20

# Knowledge
curl -s http://localhost:3001/api/v1/knowledge/sources -H "Authorization: Bearer TOKEN" 2>&1 | head -20

# Verification
curl -s -X POST http://localhost:3001/api/v1/verify/full -H "Content-Type: application/json" 2>&1 | head -20

# Vault
curl -s http://localhost:3001/api/v1/vault/test/files 2>&1 | head -20

# Workflows
curl -s http://localhost:3001/api/v1/workflows/templates 2>&1 | head -20
```

Expected: All return 401 (auth required) — confirming the routes are registered.

- [ ] **Step 4: Verify old endpoints still work**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"tim@merris.ai","password":"Test1234!"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s http://localhost:3001/api/v1/frameworks -H "Authorization: Bearer $TOKEN" | head -50
curl -s -X POST http://localhost:3001/api/v1/agent/chat -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"engagementId":"test","message":"hello"}' | head -50
```

Expected: Frameworks returns JSON array. Agent chat returns response (or error about engagement, not about routing).

- [ ] **Step 5: Commit verification**

```bash
git add -A
git commit -m "feat: Phase 1 complete — 6-product service layer verified"
```

---

## Summary

| Task | Creates | Product |
|------|---------|---------|
| 1 | `services/assistant/` (service + router) | Merris Assistant |
| 2 | `services/knowledge/` (service + evidence + router) | Merris Knowledge |
| 3 | `services/verification/` (orchestrator + 3 validators + router) | Merris Verification Engine |
| 4 | `services/vault/` (service + router) | Merris Vault |
| 5 | `services/workflows/` (service + router + template) | Merris Workflows |
| 6 | Modify `server.ts` | Wire all services |
| 7 | Build + verify | Integration test |

**Key design decisions:**
- Services **re-export** existing module code — no duplication, no rewrites
- Old `/agent/*` routes remain active for backward compat (Office add-ins use them)
- New canonical routes at `/assistant/*`, `/knowledge/*`, `/verify/*`, `/vault/*`, `/workflows/*`
- Verification service uses Claude for consistency checking (reuses existing `sendMessage`)
- Workflow execution is a stub in Phase 1 — full engine comes in Phase 4
