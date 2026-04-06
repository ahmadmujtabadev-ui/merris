// src/taskpane/perception.ts

import { MerrisState } from "./state";
import * as docOps from "./document-ops";
import { api, judgeFullDocument } from "../../../shared/api-client";

interface PerceptionResult {
  structure: {
    title: string;
    sections: Array<{
      heading: string;
      status: string;
      frameworkRef: string | null;
      wordCount: number;
      figureCount: number;
    }>;
    totalSections: number;
    draftedSections: number;
    emptySections: number;
    placeholderSections: number;
  };
  dataAlignment: {
    mismatches: Array<{
      metric: string;
      documentValue: number;
      databaseValue: number;
      databaseUnit: string;
      severity: string;
      suggestion: string;
    }>;
    missingFromDocument: string[];
  };
  complianceStatus: {
    mandatoryGaps: Array<{
      framework: string;
      disclosureCode: string;
      disclosureName: string;
    }>;
  };
  urgency: {
    deadlineDays: number | null;
    criticalActions: string[];
    partnerReadiness: number;
  };
  briefing: string;
}

let lastDocHash = "";
let perceptionInterval: ReturnType<typeof setInterval> | null = null;

export async function runInitialPerception(state: MerrisState): Promise<void> {
  await runPerception(state);

  // Start periodic re-perception (every 30s)
  if (perceptionInterval) clearInterval(perceptionInterval);
  perceptionInterval = setInterval(async () => {
    if (!state.proactiveEnabled) return;
    await runPerception(state, true);
  }, 30000);
}

async function runPerception(state: MerrisState, isProactive = false): Promise<void> {
  const docBody = await docOps.readFullDocument();
  if (!docBody || docBody.trim().length < 20) return;

  // Skip if document hasn't changed
  const hash = simpleHash(docBody);
  if (hash === lastDocHash && isProactive) return;
  lastDocHash = hash;

  try {
    const result: PerceptionResult = await api.post("/agent/perceive", {
      engagementId: state.engagementId,
      documentBody: docBody,
      documentType: "word",
    });

    // Update state
    state.documentTitle = result.structure.title || state.documentTitle;
    state.setScore(result.urgency.partnerReadiness);
    state.deadlineDays = result.urgency.deadlineDays;

    // Update sections
    state.sections = result.structure.sections.map(s => ({
      heading: s.heading,
      framework: docOps.detectFramework(s.heading),
      score: -1, // will be set by judgment
      status: s.status as any,
      wordCount: s.wordCount,
      figureCount: s.figureCount,
    }));
    state.emit("sections");

    // Generate insight cards from perception
    if (result.dataAlignment.mismatches.length > 0) {
      for (const m of result.dataAlignment.mismatches.slice(0, 5)) {
        state.addInsight({
          type: "data_issue",
          title: `Data mismatch: ${m.metric}`,
          detail: `Document: ${m.documentValue.toLocaleString()} | Database: ${m.databaseValue.toLocaleString()} ${m.databaseUnit}. ${m.suggestion}`,
          sectionRef: "",
          proactive: isProactive,
          actions: [
            { label: "Fix this", actionType: "fix" },
            { label: "Dismiss", actionType: "dismiss" },
          ],
        });
      }
    }

    if (result.complianceStatus.mandatoryGaps.length > 0) {
      for (const gap of result.complianceStatus.mandatoryGaps.slice(0, 5)) {
        state.addInsight({
          type: "compliance_gap",
          title: `Missing: ${gap.framework} ${gap.disclosureCode}`,
          detail: gap.disclosureName,
          proactive: isProactive,
          actions: [
            { label: "Draft section", actionType: "draft" },
            { label: "Dismiss", actionType: "dismiss" },
          ],
        });
      }
    }

    for (const missing of result.dataAlignment.missingFromDocument.slice(0, 3)) {
      state.addInsight({
        type: "data_issue",
        title: `Missing from document: ${missing}`,
        detail: "This metric exists in the engagement database but is not mentioned in the document.",
        proactive: isProactive,
        actions: [
          { label: "Draft section", actionType: "draft" },
          { label: "Request data", actionType: "request_data" },
          { label: "Dismiss", actionType: "dismiss" },
        ],
      });
    }
  } catch (err: any) {
    console.error("[Merris] Perception failed:", err);
  }
}

export async function runJudgment(state: MerrisState, level: "quick" | "thorough" | "partner_review"): Promise<void> {
  const docBody = await docOps.readFullDocument();
  if (!docBody || docBody.trim().length < 20) return;

  try {
    const judgment = await judgeFullDocument(state.engagementId, docBody, level);

    state.setScore(judgment.overallScore);

    // Update section scores
    for (const sj of judgment.sections) {
      const section = state.sections.find(s => s.heading === sj.sectionTitle);
      if (section) section.score = sj.score;
    }
    state.emit("sections");

    // Create insight cards from judgment
    for (const issue of judgment.criticalIssues.slice(0, 5)) {
      state.addInsight({
        type: "quality_issue",
        title: `${issue.location}: ${issue.issue.substring(0, 60)}`,
        detail: `${issue.issue}\n\nRecommendation: ${issue.recommendation}`,
        sectionRef: issue.location,
        proactive: false,
        actions: [
          { label: "Fix this", actionType: "fix" },
          { label: "Dismiss", actionType: "dismiss" },
        ],
      });
    }

    for (const issue of (judgment.improvements ?? []).slice(0, 3)) {
      state.addInsight({
        type: "quality_issue",
        title: `Improvement: ${issue.location}`,
        detail: issue.issue + (issue.recommendation ? `\n\n${issue.recommendation}` : ""),
        sectionRef: issue.location,
        proactive: false,
        actions: [
          { label: "Fix this", actionType: "fix" },
          { label: "Dismiss", actionType: "dismiss" },
        ],
      });
    }

    if (level === "partner_review") {
      state.addInsight({
        type: "peer_benchmark",
        title: "Partner review simulation",
        detail: `Score: ${judgment.overallScore}/100. Partner would ${judgment.partnerWouldApprove ? "approve" : "reject"}. Auditor would ${judgment.auditorWouldAccept ? "accept" : "flag"}.`,
        proactive: false,
        actions: [{ label: "Dismiss", actionType: "dismiss" }],
      });
    }
  } catch (err: any) {
    console.error("[Merris] Judgment failed:", err);
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}
