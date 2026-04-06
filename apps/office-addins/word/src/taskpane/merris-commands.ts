// src/taskpane/merris-commands.ts

import { MerrisState } from "./state";
import * as docOps from "./document-ops";
import { agentChat } from "../../../shared/api-client";

// ---- Command Classification ----

export type CommandType = "REVIEW" | "WRITE" | "EDIT" | "INSERT_ARTIFACT" | "EXPLAIN" | "REFERENCE";

export function classifyCommand(instruction: string): CommandType {
  const lower = instruction.toLowerCase().trim();
  if (!lower) return "EXPLAIN";

  if (/\b(insert\s+table|add\s+table|create\s+table|show\s+data|add\s+chart|insert\s+chart|add\s+comparison|comparison\s+table|waterfall\s+chart|data\s+table|emissions\s+table)\b/.test(lower))
    return "INSERT_ARTIFACT";
  if (/\b(add\s+references?|cite\s+sources?|add\s+evidence|add\s+citations?|where\s+does\s+this\s+come\s+from|source\s+this|back\s+this\s+up)\b/.test(lower))
    return "REFERENCE";
  if (/\b(review|check|assess|evaluate|score|is\s+this\s+correct|what\s+do\s+you\s+think|is\s+.*\s+correct|verify|validate|audit|flag\s+issues|any\s+issues|look\s+at\s+this)\b/.test(lower))
    return "REVIEW";
  if (/\b(explain|why\s|what\s+does|what\s+would|what\s+is|help\s+me\s+understand|tell\s+me\s+about|how\s+does|what\s+are\s+the|meaning\s+of)\b/.test(lower))
    return "EXPLAIN";
  if (/\b(rewrite|redraft|improve|shorten|expand|simplify|make\s+more|make\s+it|cut\s+this|too\s+wordy|tighten|rephrase|rework|needs\s+work|fix\s+this|clean\s+up|more\s+formal|less\s+formal|more\s+concise|more\s+detailed)\b/.test(lower))
    return "EDIT";
  if (/\b(write|draft|create|add|insert|compose|generate|produce|defend|justify|summarise|summarize|introduce|conclude)\b/.test(lower))
    return "WRITE";
  if (lower.endsWith("?") || lower.startsWith("is ") || lower.startsWith("are ") || lower.startsWith("does ") || lower.startsWith("should "))
    return "REVIEW";

  return "WRITE";
}

// ---- Polling ----

interface DetectedCommand {
  lineText: string;
  instruction: string;
  paragraphIndex: number;
  firstSeenAt: number;
  lastChangedAt: number;
}

const detected = new Map<number, DetectedCommand>();
let polling = false;
let processing = false;
let pollCount = 0;

export function startPolling(state: MerrisState): void {
  console.log("[Merris] Polling started — scanning every 3s");

  setInterval(async () => {
    if (polling || processing) return;
    polling = true;
    pollCount++;

    try {
      await pollCycle(state);
    } catch (e) {
      console.error("[Merris] Poll error:", e);
    }

    polling = false;
  }, 3000);
}

async function pollCycle(state: MerrisState): Promise<void> {
  const paras = await docOps.readAllParagraphs();
  const cursorIdx = await docOps.getCursorParagraphIndex();
  const now = Date.now();
  const currentIndices = new Set<number>();
  let foundCount = 0;

  for (const p of paras) {
    // Skip markers
    if (p.text.includes("[Working on:") || p.text.includes("[Merris ready") || p.text.includes("[Merris:")) continue;

    const match = p.text.match(/@merris\s*(.*)/i);
    if (!match) continue;

    foundCount++;
    currentIndices.add(p.index);
    const instruction = (match[1] || "").replace(/\s*\[Merris ready.*?\]/g, "").trim();

    const existing = detected.get(p.index);
    if (existing) {
      if (existing.lineText !== p.text) {
        existing.lineText = p.text;
        existing.instruction = instruction;
        existing.lastChangedAt = now;
      }
    } else {
      detected.set(p.index, {
        lineText: p.text,
        instruction,
        paragraphIndex: p.index,
        firstSeenAt: now,
        lastChangedAt: now,
      });
    }
  }

  // Cleanup removed detections
  for (const idx of detected.keys()) {
    if (!currentIndices.has(idx)) detected.delete(idx);
  }

  console.log(`[Merris] Poll #${pollCount}: found ${foundCount}, pending ${detected.size}`);

  // Check which are ready to fire
  const ready: DetectedCommand[] = [];
  for (const [idx, det] of detected.entries()) {
    const idle = now - det.lastChangedAt;
    const cursorOnLine = cursorIdx === idx;

    // Fire when: cursor left + 2s idle, OR 5s idle regardless
    if ((!cursorOnLine && idle >= 2000) || idle >= 5000) {
      ready.push(det);
      detected.delete(idx);
    }
  }

  // Process ready commands
  if (ready.length > 0) {
    processing = true;
    for (const cmd of ready) {
      await processCommand(cmd, state);
    }
    processing = false;
  }
}

async function processCommand(cmd: DetectedCommand, state: MerrisState): Promise<void> {
  const instruction = cmd.instruction || "what should go here?";
  const cmdType = classifyCommand(instruction);

  console.log(`[Merris] Processing: "${instruction}" → ${cmdType}`);

  // Delete the @merris line from document
  await docOps.deleteParagraphContaining(cmd.lineText.substring(0, 40));

  // Gather context
  const paras = await docOps.readAllParagraphs();
  let nearestHeading = "";
  for (let j = Math.min(cmd.paragraphIndex, paras.length - 1); j >= 0; j--) {
    if (docOps.isHeading(paras[j].text, paras[j].style)) {
      nearestHeading = paras[j].text.trim();
      break;
    }
  }

  // Route based on classification
  switch (cmdType) {
    case "REVIEW":
      await routeReview(instruction, nearestHeading, state);
      break;
    case "WRITE":
    case "EDIT":
    case "INSERT_ARTIFACT":
    case "REFERENCE":
      routeToActions(instruction, nearestHeading, cmdType, state);
      break;
    case "EXPLAIN":
      await routeExplain(instruction, nearestHeading, state);
      break;
  }
}

async function routeReview(instruction: string, heading: string, state: MerrisState): Promise<void> {
  // Generate review immediately and create insight card
  try {
    const docText = await docOps.readFullDocument();
    const response = await agentChat({
      message: `REVIEW (feedback only, do NOT write replacement content): ${instruction}\nSection: ${heading}`,
      engagementId: state.engagementId,
      documentBody: docText,
      cursorSection: heading,
    });

    const reply = response.reply || "";

    // Insert as comment in document
    if (heading) {
      const paras = await docOps.readAllParagraphs();
      let targetText = "";
      let foundHeading = false;
      for (const p of paras) {
        if (foundHeading && p.text.trim() && !docOps.isHeading(p.text, p.style)) {
          targetText = p.text;
          break;
        }
        if (p.text.trim() === heading) foundHeading = true;
      }

      if (targetText) {
        await docOps.insertCommentOn(targetText, `Merris Review: ${reply}`);
      }
    }

    // Create insight card
    state.addInsight({
      type: "quality_issue",
      title: `Review: ${heading || instruction.substring(0, 40)}`,
      detail: reply,
      sectionRef: heading,
      proactive: false,
      actions: [{ label: "Dismiss", actionType: "dismiss" }],
    });
  } catch (err: any) {
    state.addInsight({
      type: "quality_issue",
      title: `Review failed: ${instruction.substring(0, 40)}`,
      detail: `Error: ${err.message || "Unknown"}`,
      proactive: false,
      actions: [{ label: "Dismiss", actionType: "dismiss" }],
    });
  }
}

function routeToActions(instruction: string, heading: string, cmdType: CommandType, state: MerrisState): void {
  const kindMap: Record<string, "insert" | "replace" | "table" | "reference"> = {
    WRITE: "insert",
    EDIT: "replace",
    INSERT_ARTIFACT: "table",
    REFERENCE: "reference",
  };

  state.addAction({
    description: instruction.substring(0, 80),
    targetHeading: heading,
    kind: kindMap[cmdType] || "insert",
    content: "", // generated on Preview/Apply
  });

  // Auto-switch to Actions tab
  state.switchTab("actions");
}

async function routeExplain(instruction: string, heading: string, state: MerrisState): Promise<void> {
  state.addChatMessage({ role: "user", content: instruction });

  try {
    const docText = await docOps.readFullDocument();
    const response = await agentChat({
      message: `EXPLAIN (respond conversationally, do not produce document content): ${instruction}\nSection: ${heading}`,
      engagementId: state.engagementId,
      documentBody: docText,
      cursorSection: heading,
    });
    state.addChatMessage({ role: "assistant", content: response.reply || "" });
  } catch (err: any) {
    state.addChatMessage({ role: "assistant", content: `Error: ${err.message || "Unknown"}` });
  }

  state.switchTab("chat");
}
