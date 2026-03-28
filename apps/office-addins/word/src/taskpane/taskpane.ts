/**
 * Merris ESG Agent -- Word Taskpane
 *
 * Panels:
 * 1. Current section detector (natural language heading detection with action buttons)
 * 2. Agent chat contextual to current section
 * 3. Compliance coverage (framework gaps with "Draft this" buttons)
 * 4. Suggested content (judgment issues with "Redraft" / "Add content" buttons)
 * 5. Citation trail (data sources from engagement data points)
 *
 * All Word.js operations use RELIABLE patterns:
 * - body.insertParagraph(text, "End") for appending
 * - paragraph.clear() + insertText() for replacement
 * - \r for line breaks within a single paragraph
 * - Never chain insertParagraph on returned refs (stale in Word Online)
 */

import { AgentPanel } from "../../../shared/agent-panel";
import { EngagementSelector, EngagementInfo } from "../../../shared/engagement-selector";
import { ensureAuthenticated } from "../../../shared/auth";
import {
  api,
  agentChat,
  draftDisclosure,
  checkConsistency,
  getEvidenceTrail,
  judgeFullDocument,
  type DocumentJudgment,
  type SectionJudgment,
} from "../../../shared/api-client";
import "../../../shared/styles.css";

// ---- Perception types ----
interface PerceptionResult {
  structure: {
    title: string;
    sections: Array<{ heading: string; status: string; frameworkRef: string | null; wordCount: number; figureCount: number }>;
    totalSections: number;
    draftedSections: number;
    emptySections: number;
    placeholderSections: number;
  };
  dataAlignment: {
    mismatches: Array<{ metric: string; documentValue: number; databaseValue: number; databaseUnit: string; severity: string; suggestion: string }>;
    missingFromDocument: string[];
  };
  complianceStatus: {
    mandatoryGaps: Array<{ framework: string; disclosureCode: string; disclosureName: string }>;
  };
  urgency: {
    deadlineDays: number | null;
    criticalActions: string[];
    partnerReadiness: number;
  };
  briefing: string;
}

/* globals Office, Word */
declare const Office: any;
declare const Word: any;

// ---- Module-level state ----
let agentPanel: AgentPanel | null = null;
let engagementSelector: EngagementSelector | null = null;
let currentHeading = "";
let currentFramework = "";
let selectedEngagement: EngagementInfo | null = null;

// Store perception and judgment results for tab population
let lastPerception: PerceptionResult | null = null;
let lastJudgment: DocumentJudgment | null = null;

// ---- Initialization ----

Office.onReady(async (info: { host: string }) => {
  if (info.host === "Word" || info.host === "Document") {
    try {
      await ensureAuthenticated();
    } catch {
      // Continue without auth in dev
    }

    // Show engagement selector first
    const mainContent = document.getElementById("main-content");
    const selectorContainer = document.getElementById("engagement-selector-container");

    if (selectorContainer) {
      engagementSelector = new EngagementSelector({
        parentElement: selectorContainer,
        onSelect: (engagement, mode) => {
          selectedEngagement = engagement;
          if (engagement) {
            localStorage.setItem("merris_engagement_id", engagement.id);
          }
          // Hide selector, show main content
          if (selectorContainer) selectorContainer.style.display = "none";
          if (mainContent) mainContent.style.display = "block";

          // Update header with engagement info
          const engLabel = document.getElementById("engagement-label");
          if (engLabel) {
            engLabel.textContent = engagement ? engagement.name : "Quick Mode";
            engLabel.style.cursor = "pointer";
            engLabel.title = "Click to change engagement";
            engLabel.addEventListener("click", () => {
              if (selectorContainer) selectorContainer.style.display = "block";
              if (mainContent) mainContent.style.display = "none";
              engagementSelector?.show();
            });
          }

          setupTabs();
          initAgentPanel();
          detectCurrentSection();

          // Auto-perceive document on engagement selection
          if (engagement) {
            runPerception(engagement.id);
          }
        },
      });
      // Hide main content until engagement selected
      if (mainContent) mainContent.style.display = "none";
    } else {
      // Fallback: no selector container in HTML, just init directly
      setupTabs();
      initAgentPanel();
      detectCurrentSection();
    }

    // Re-detect section on selection change
    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      () => detectCurrentSection()
    );
  }
});

// ---- Tab navigation ----

function setupTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>(".merris-tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.remove("active", "merris-btn-primary");
        t.classList.add("merris-btn-secondary");
      });
      tab.classList.add("active", "merris-btn-primary");
      tab.classList.remove("merris-btn-secondary");

      const panels = document.querySelectorAll<HTMLElement>(".merris-panel");
      panels.forEach((p) => (p.style.display = "none"));

      const target = tab.getAttribute("data-tab");
      const panel = document.getElementById(`panel-${target}`);
      if (panel) panel.style.display = "block";
    });
  });
}

// ---- Natural Language Section Detection (FIX 4) ----

async function detectCurrentSection(): Promise<void> {
  try {
    await Word.run(async (context: any) => {
      const selection = context.document.getSelection();
      const body = context.document.body;
      const paragraphs = body.paragraphs;
      paragraphs.load("items/text,items/style");
      selection.load("text");
      await context.sync();

      // Walk through paragraphs to find nearest heading above cursor
      let foundHeading = "";
      let detectedFramework = "";
      const selText = (selection.text || "").trim();

      // Find the paragraph closest to selection, then walk backwards
      let cursorIndex = -1;
      if (selText) {
        for (let i = 0; i < paragraphs.items.length; i++) {
          const pText = (paragraphs.items[i].text || "").trim();
          if (pText.includes(selText.substring(0, 30))) {
            cursorIndex = i;
            break;
          }
        }
      }

      // Walk backwards from cursor (or from end if cursor not found)
      const startIdx = cursorIndex >= 0 ? cursorIndex : paragraphs.items.length - 1;
      for (let i = startIdx; i >= 0; i--) {
        const style = (paragraphs.items[i].style || "").toLowerCase();
        const text = (paragraphs.items[i].text || "").trim();

        if (isHeading(text, style)) {
          foundHeading = text;
          detectedFramework = detectFramework(text);
          break;
        }
      }

      currentHeading = foundHeading;
      currentFramework = detectedFramework;

      // Update UI - show actual heading text, not framework-specific message
      const headingEl = document.getElementById("section-heading");
      const frameworkEl = document.getElementById("section-framework");
      if (headingEl) {
        headingEl.textContent = foundHeading || "No heading detected above cursor";
      }
      if (frameworkEl) {
        frameworkEl.textContent = detectedFramework
          ? `Framework: ${detectedFramework}`
          : "";
      }

      // Show section action buttons (FIX 4)
      renderSectionActions(foundHeading);

      // Update agent context
      if (agentPanel) {
        agentPanel.updateContext({
          current_heading: currentHeading,
          framework: currentFramework,
        });
      }

      // Load compliance notes for detected section
      if (currentHeading && currentFramework) {
        loadComplianceNotes(currentHeading, currentFramework);
      }
    });
  } catch {
    // Section detection is best-effort
  }
}

function isHeading(text: string, style: string): boolean {
  if (!text) return false;

  // Word style-based heading
  if (style.includes("heading")) return true;

  // Framework headings: GRI 305-1, ESRS E1, TCFD, etc.
  if (/^(GRI|ESRS|IFRS S|TCFD|SASB)\s/i.test(text)) return true;

  // Numbered headings: "1. Executive Summary", "2.1 GHG Emissions"
  if (/^\d+(\.\d+)*\.?\s+\S/.test(text)) return true;

  // Short capitalized lines that look like headings (under 80 chars, starts with capital)
  if (text.length < 80 && text.length > 2 && /^[A-Z]/.test(text)) {
    // All caps line
    if (text === text.toUpperCase() && text.length > 3) return true;
    // Title case short line not ending with period
    if (!text.endsWith(".") && text.length < 60) return true;
  }

  return false;
}

function detectFramework(text: string): string {
  if (/^GRI\s/i.test(text) || /GRI\s\d/i.test(text)) return "GRI";
  if (/^ESRS\s/i.test(text) || /ESRS\s[A-Z]/i.test(text)) return "ESRS";
  if (/TCFD/i.test(text)) return "TCFD";
  if (/SASB/i.test(text)) return "SASB";
  if (/IFRS\sS/i.test(text)) return "IFRS S";
  return "";
}

function renderSectionActions(heading: string): void {
  const actionsEl = document.getElementById("section-actions");
  if (!actionsEl) return;

  if (!heading) {
    actionsEl.style.display = "none";
    return;
  }

  actionsEl.style.display = "flex";
  actionsEl.innerHTML = `
    <button class="merris-btn merris-btn-primary" style="font-size:10px;padding:4px 8px;" id="sa-draft">Draft this section</button>
    <button class="merris-btn merris-btn-secondary" style="font-size:10px;padding:4px 8px;" id="sa-review">Review this section</button>
    <button class="merris-btn merris-btn-secondary" style="font-size:10px;padding:4px 8px;" id="sa-data">Add data</button>
    <button class="merris-btn merris-btn-secondary" style="font-size:10px;padding:4px 8px;" id="sa-refs">Add references</button>
  `;

  document.getElementById("sa-draft")?.addEventListener("click", () => {
    runSectionAction("Draft the content for the section: " + heading);
  });
  document.getElementById("sa-review")?.addEventListener("click", () => {
    runSectionAction("Review and critique the section: " + heading);
  });
  document.getElementById("sa-data")?.addEventListener("click", () => {
    runSectionAction("Add relevant quantitative data and metrics to the section: " + heading);
  });
  document.getElementById("sa-refs")?.addEventListener("click", () => {
    runSectionAction("Add citations and references to the section: " + heading);
  });
}

async function runSectionAction(instruction: string): Promise<void> {
  const statusEl = document.getElementById("merris-command-status");
  if (statusEl) {
    statusEl.style.display = "block";
    statusEl.innerHTML = `
      <div style="border-left:3px solid #f59e0b;padding:10px 12px;font-size:12px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;color:#f59e0b;">
          <span class="merris-spinner" style="width:14px;height:14px;"></span>
          <span style="font-weight:600;">Merris is thinking...</span>
        </div>
        <div style="margin-top:4px;color:var(--merris-text-secondary,#999);font-size:11px;">"${instruction.substring(0, 60)}"</div>
      </div>
    `;
  }

  try {
    const docText = await readFullDocument();
    const engId = localStorage.getItem("merris_engagement_id") || "";
    const response = await agentChat({
      message: instruction,
      engagementId: engId,
      documentBody: docText,
      cursorSection: currentHeading,
    });

    const text = response.reply || "";

    // Write response into the document using reliable pattern
    await writeToDocument(text, currentHeading);

    if (statusEl) {
      statusEl.innerHTML = `
        <div style="border-left:3px solid #22c55e;padding:10px 12px;font-size:12px;margin-bottom:8px;">
          <span style="font-weight:600;color:#22c55e;">Done</span>
          <span style="color:var(--merris-text-secondary,#999);font-size:11px;margin-left:8px;">${text.split(/\s+/).length} words written</span>
        </div>
      `;
      setTimeout(() => { statusEl.style.display = "none"; }, 6000);
    }
  } catch (err: any) {
    if (statusEl) {
      statusEl.innerHTML = `<div style="border-left:3px solid #ef4444;padding:10px 12px;font-size:11px;color:#ef4444;margin-bottom:8px;">Failed: ${err.message || "Unknown error"}</div>`;
      setTimeout(() => { statusEl.style.display = "none"; }, 6000);
    }
  }
}

// ---- Agent Panel ----

function initAgentPanel(): void {
  const container = document.getElementById("panel-agent");
  if (!container) return;

  agentPanel = new AgentPanel({
    parentElement: container,
    context: { host: "word", current_heading: "", framework: "" },
    onAction: handleAgentAction,
    getDocumentContext: getDocumentContextForChat,
  });

  // Start @Merris polling
  startMerrisPoll();
}

async function getDocumentContextForChat(): Promise<{ documentBody: string; cursorSection: string } | null> {
  return new Promise((resolve) => {
    try {
      Word.run(async (context: any) => {
        const body = context.document.body;
        body.load("text");
        const paragraphs = body.paragraphs;
        paragraphs.load("items/text,items/style");
        const selection = context.document.getSelection();
        selection.load("text");
        await context.sync();

        let fullText = "";
        let cursorSec = "";
        const selText = selection.text || "";

        for (const para of paragraphs.items) {
          const text = para.text?.trim() || "";
          if (!text) continue;
          const style = para.style?.toLowerCase() || "";
          if (style.includes("heading")) {
            fullText += "\n" + text + "\n";
          } else {
            fullText += text + "\n";
          }
        }

        let lastHeading = "";
        for (const para of paragraphs.items) {
          const text = para.text?.trim() || "";
          const style = para.style?.toLowerCase() || "";
          if (isHeading(text, style)) {
            lastHeading = text;
          }
          if (text.includes(selText.substring(0, 30)) && selText.length > 0) {
            cursorSec = lastHeading;
            break;
          }
        }

        resolve({ documentBody: fullText, cursorSection: cursorSec || currentHeading });
      });
    } catch {
      resolve(null);
    }
  });
}

function handleAgentAction(action: {
  type: string;
  payload: Record<string, unknown>;
}): void {
  switch (action.type) {
    case "insert_content":
      if (typeof action.payload.text === "string") {
        insertContentReliable(action.payload.text);
      }
      break;
    case "insert_table":
      if (action.payload.data) {
        insertTable(action.payload.data as string[][]);
      }
      break;
    default:
      console.log("Unknown agent action:", action.type);
  }
}

// ============================================================
// FIX 1: Reliable Word.js Document Writing
// ============================================================

/**
 * Write text into the document, replacing a placeholder or marker paragraph.
 * Uses \r for line breaks within a single paragraph — guaranteed reliable in Word Online.
 */
async function writeToDocument(responseText: string, nearHeading?: string): Promise<void> {
  await Word.run(async (context: any) => {
    const paras = context.document.body.paragraphs;
    paras.load("items/text,items/font");
    await context.sync();

    // Strategy 1: Find and replace [Merris is working:...] marker
    for (const p of paras.items) {
      const pText = p.text || "";
      if (pText.includes("[Merris is working:")) {
        p.clear();
        p.insertText(responseText.replace(/\n/g, "\r"), "Start");
        p.font.color = "#000000";
        p.font.italic = false;
        p.font.size = 11;
        await context.sync();
        return;
      }
    }

    // Strategy 2: Find and replace [Merris received:...] marker
    for (const p of paras.items) {
      const pText = p.text || "";
      if (pText.includes("[Merris received:")) {
        p.clear();
        p.insertText(responseText.replace(/\n/g, "\r"), "Start");
        p.font.color = "#000000";
        p.font.italic = false;
        p.font.size = 11;
        await context.sync();
        return;
      }
    }

    // Strategy 3: Find placeholders in the document
    const placeholders = ["[TO BE DRAFTED BY MERRIS]", "[TO BE COMPLETED]", "[TO BE DRAFTED]", "[PLACEHOLDER]", "[TBD]"];
    for (const p of paras.items) {
      const pText = (p.text || "").trim();
      for (const ph of placeholders) {
        if (pText.includes(ph)) {
          p.clear();
          p.insertText(responseText.replace(/\n/g, "\r"), "Start");
          p.font.color = "#000000";
          p.font.italic = false;
          p.font.size = 11;
          await context.sync();
          return;
        }
      }
    }

    // Strategy 4: Insert at end of document
    context.document.body.insertParagraph(responseText.replace(/\n/g, "\r"), "End");
    await context.sync();
  });
}

/**
 * Insert content at cursor or replace placeholder. Used by agent panel "Insert into document" button.
 * Reliable single-paragraph approach with \r for line breaks.
 */
async function insertContentReliable(text: string): Promise<void> {
  try {
    await Word.run(async (context: any) => {
      // Try to find and replace placeholder text first
      const placeholders = [
        "[TO BE DRAFTED BY MERRIS]",
        "[TO BE COMPLETED]",
        "[TO BE DRAFTED]",
        "[PLACEHOLDER]",
        "[TBD]",
      ];

      const paras = context.document.body.paragraphs;
      paras.load("items/text,items/font");
      await context.sync();

      let replaced = false;
      for (const p of paras.items) {
        const pText = (p.text || "").trim();
        for (const ph of placeholders) {
          if (pText.includes(ph)) {
            p.clear();
            p.insertText(text.replace(/\n/g, "\r"), "Start");
            p.font.color = "#000000";
            p.font.italic = false;
            p.font.size = 11;
            replaced = true;
            break;
          }
        }
        if (replaced) break;
      }

      if (!replaced) {
        // Insert at end of document — always reliable
        context.document.body.insertParagraph(text.replace(/\n/g, "\r"), "End");
      }

      await context.sync();
      showNotification("Content inserted into document.");
    });
  } catch (err: any) {
    showNotification("Insert error: " + (err.message || "Unknown error"));
  }
}

// ============================================================
// FIX 2: @Merris In-Document Detection (reliable patterns)
// ============================================================

let merrisPolling = false;
let merrisProcessing = false;

// Pending action -- waiting for user approval
let pendingAction: {
  instruction: string;
  nearestHeading: string;
  sectionContent: string;
  fullDocText: string;
} | null = null;

function startMerrisPoll(): void {
  setInterval(async () => {
    if (merrisPolling || merrisProcessing || pendingAction) return;
    merrisPolling = true;

    try {
      await Word.run(async (context: any) => {
        const paras = context.document.body.paragraphs;
        paras.load("items/text,items/style");
        await context.sync();

        for (let i = 0; i < paras.items.length; i++) {
          const text = paras.items[i].text || "";
          const match = text.match(/@[Mm]erris\s+(.+)/);
          if (!match) continue;

          const instruction = match[1].trim();

          // Replace @merris line with working indicator
          paras.items[i].clear();
          paras.items[i].insertText("[Merris received: " + instruction + "]", "Start");
          paras.items[i].font.color = "#6366f1";
          paras.items[i].font.italic = true;
          paras.items[i].font.size = 9;
          await context.sync();

          // Find nearest heading above
          let nearestHeading = "";
          let sectionContent = "";
          for (let j = i - 1; j >= 0; j--) {
            const prevText = (paras.items[j].text || "").trim();
            const prevStyle = (paras.items[j].style || "").toLowerCase();
            if (isHeading(prevText, prevStyle)) {
              nearestHeading = prevText;
              break;
            }
            sectionContent = prevText + "\n" + sectionContent;
          }

          // Highlight target heading
          if (nearestHeading) {
            for (let j = 0; j < paras.items.length; j++) {
              if ((paras.items[j].text || "").trim() === nearestHeading) {
                paras.items[j].font.highlightColor = "#FFFF00";
                break;
              }
            }
            await context.sync();
          }

          // Read full document text
          const bodyRef = context.document.body;
          bodyRef.load("text");
          await context.sync();
          const fullDocText = bodyRef.text || "";

          // Store pending action on window to avoid TypeScript narrowing issues
          (window as any).__merrisPending = {
            instruction,
            heading: nearestHeading,
            docText: fullDocText,
            sectionContent: sectionContent.trim(),
          };
          break;
        }
      });

      // Process pending command outside Word.run
      const merrisPending = (window as any).__merrisPending as { instruction: string; heading: string; docText: string; sectionContent: string } | undefined;
      if (merrisPending) {
        delete (window as any).__merrisPending;
        pendingAction = {
          instruction: merrisPending.instruction,
          nearestHeading: merrisPending.heading,
          sectionContent: merrisPending.sectionContent,
          fullDocText: merrisPending.docText,
        };
        showConfirmationDialog(pendingAction);
      }
    } catch (e) {
      console.error("Poll error:", e);
    }

    merrisPolling = false;
  }, 3000);
}

function showConfirmationDialog(action: NonNullable<typeof pendingAction>): void {
  const statusEl = document.getElementById("merris-command-status");
  if (!statusEl) return;
  statusEl.style.display = "block";

  // Determine what Merris plans to do based on instruction keywords
  let planDescription = "";
  const instr = action.instruction.toLowerCase();

  if (instr.includes("review") || instr.includes("critique") || instr.includes("assess")) {
    planDescription = "I will review this section and insert my assessment directly below it. The review will cover accuracy, completeness, and what a partner would flag.";
  } else if (instr.includes("draft") || instr.includes("write") || instr.includes("redraft")) {
    planDescription = "I will draft replacement content for this section using the engagement data. The new text will replace the marker in the document.";
  } else if (instr.includes("explain") || instr.includes("why") || instr.includes("justify")) {
    planDescription = "I will add an explanatory paragraph addressing your question.";
  } else if (instr.includes("translate")) {
    planDescription = "I will insert a translated version below the current section.";
  } else if (instr.includes("summarise") || instr.includes("summarize")) {
    planDescription = "I will insert a concise summary below this section.";
  } else if (instr.includes("challenge") || instr.includes("defend")) {
    planDescription = "I will insert counter-arguments or supporting evidence below this section.";
  } else {
    planDescription = "I will process your instruction and insert the result into the document.";
  }

  const sectionPreview = action.sectionContent
    ? action.sectionContent.substring(0, 150) + (action.sectionContent.length > 150 ? "..." : "")
    : "(empty section)";

  statusEl.innerHTML = `
    <div style="border:1px solid #6366f1;border-radius:6px;padding:12px;margin-bottom:10px;background:rgba(99,102,241,0.05);">
      <div style="font-size:12px;font-weight:600;color:#6366f1;margin-bottom:8px;">Merris understood your request</div>

      <div style="font-size:11px;color:var(--merris-text,#eee);margin-bottom:6px;">
        <span style="color:var(--merris-text-secondary,#999);">You said:</span> "${escapeHtml(action.instruction)}"
      </div>

      <div style="font-size:11px;color:var(--merris-text,#eee);margin-bottom:6px;">
        <span style="color:var(--merris-text-secondary,#999);">Target section:</span> ${escapeHtml(action.nearestHeading || "End of document")}
        <span style="color:#FFFF00;font-size:10px;margin-left:4px;">(highlighted in document)</span>
      </div>

      <div style="font-size:11px;color:var(--merris-text-secondary,#999);margin-bottom:6px;font-style:italic;border-left:2px solid #333;padding-left:8px;">
        ${escapeHtml(sectionPreview)}
      </div>

      <div style="font-size:11px;color:var(--merris-text,#eee);margin-bottom:10px;">
        <span style="color:var(--merris-text-secondary,#999);">Plan:</span> ${planDescription}
      </div>

      <div style="display:flex;gap:8px;">
        <button id="merris-confirm-yes" class="merris-btn merris-btn-primary" style="flex:1;font-size:11px;padding:6px;">Go ahead</button>
        <button id="merris-confirm-edit" class="merris-btn merris-btn-secondary" style="flex:1;font-size:11px;padding:6px;">Let me clarify</button>
        <button id="merris-confirm-no" class="merris-btn merris-btn-secondary" style="flex:0.5;font-size:11px;padding:6px;color:#ef4444;">Cancel</button>
      </div>
    </div>
  `;

  // Wire up buttons
  document.getElementById("merris-confirm-yes")?.addEventListener("click", () => {
    executeMerrisCommand();
  });

  document.getElementById("merris-confirm-edit")?.addEventListener("click", () => {
    statusEl.innerHTML = `
      <div style="border:1px solid #f59e0b;border-radius:6px;padding:10px;margin-bottom:10px;font-size:11px;color:#f59e0b;">
        Type your clarification in the chat below. I will use it along with your original instruction.
      </div>
    `;
    const chatInput = document.querySelector<HTMLInputElement>(".merris-agent-input input");
    if (chatInput) {
      chatInput.placeholder = "Clarify: " + action.instruction.substring(0, 30) + "...";
      chatInput.focus();
    }
  });

  document.getElementById("merris-confirm-no")?.addEventListener("click", () => {
    cancelPendingAction();
  });
}

async function executeMerrisCommand(): Promise<void> {
  if (!pendingAction) return;
  const action = pendingAction;
  pendingAction = null;
  merrisProcessing = true;

  const statusEl = document.getElementById("merris-command-status");

  // Update marker in document to "working" state
  try {
    await Word.run(async (context: any) => {
      const paras = context.document.body.paragraphs;
      paras.load("items/text,items/font");
      await context.sync();
      for (const p of paras.items) {
        if ((p.text || "").includes("[Merris received:")) {
          p.clear();
          p.insertText("[Merris is working: " + action.instruction.substring(0, 50) + "...]", "Start");
          p.font.color = "#6366f1";
          p.font.italic = true;
          p.font.size = 9;
          break;
        }
      }
      await context.sync();
    });
  } catch {
    // best effort
  }

  // Phase: Thinking
  if (statusEl) {
    statusEl.innerHTML = `
      <div style="border-left:3px solid #f59e0b;padding:10px 12px;font-size:12px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;color:#f59e0b;">
          <span class="merris-spinner" style="width:14px;height:14px;"></span>
          <span style="font-weight:600;">Merris is thinking...</span>
        </div>
        <div style="margin-top:4px;color:var(--merris-text-secondary,#999);font-size:11px;">"${escapeHtml(action.instruction.substring(0, 60))}"</div>
      </div>
    `;
  }

  try {
    const engId = localStorage.getItem("merris_engagement_id") || "";
    const response = await agentChat({
      message: action.instruction,
      engagementId: engId,
      documentBody: action.fullDocText,
      cursorSection: action.nearestHeading,
    });

    const text = response.reply || "";

    // Phase: Writing
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="border-left:3px solid #1a7a4c;padding:10px 12px;font-size:12px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;color:#1a7a4c;">
            <span class="merris-spinner" style="width:14px;height:14px;"></span>
            <span style="font-weight:600;">Writing to document...</span>
          </div>
        </div>
      `;
    }

    // Replace the working indicator with the response (FIX 1: reliable pattern)
    await Word.run(async (context: any) => {
      const paras = context.document.body.paragraphs;
      paras.load("items/text,items/font");
      await context.sync();

      let found = false;
      for (const p of paras.items) {
        if ((p.text || "").includes("[Merris is working:")) {
          p.clear();
          p.insertText(text.replace(/\n/g, "\r"), "Start");
          p.font.color = "#000000";
          p.font.italic = false;
          p.font.size = 11;
          found = true;
          break;
        }
      }

      if (!found) {
        // Fallback: also check for [Merris received:
        for (const p of paras.items) {
          if ((p.text || "").includes("[Merris received:")) {
            p.clear();
            p.insertText(text.replace(/\n/g, "\r"), "Start");
            p.font.color = "#000000";
            p.font.italic = false;
            p.font.size = 11;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // Last resort: append to end
        context.document.body.insertParagraph(text.replace(/\n/g, "\r"), "End");
      }

      // Remove heading highlights
      for (const p of paras.items) {
        try {
          if (p.font.highlightColor) p.font.highlightColor = "None";
        } catch { /* skip */ }
      }

      await context.sync();
    });

    // Done
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="border-left:3px solid #22c55e;padding:10px 12px;font-size:12px;margin-bottom:8px;">
          <span style="font-weight:600;color:#22c55e;">Done</span>
          <span style="color:var(--merris-text-secondary,#999);font-size:11px;margin-left:8px;">${text.split(/\s+/).length} words inserted under "${escapeHtml(action.nearestHeading || "document")}"</span>
        </div>
      `;
      setTimeout(() => { statusEl.style.display = "none"; }, 8000);
    }
  } catch (err: any) {
    // Replace working indicator with error
    try {
      await Word.run(async (context: any) => {
        const paras = context.document.body.paragraphs;
        paras.load("items/text,items/font");
        await context.sync();
        for (const p of paras.items) {
          if ((p.text || "").includes("[Merris is working:") || (p.text || "").includes("[Merris received:")) {
            p.clear();
            p.insertText("[Merris failed: " + (err.message || "error") + "]", "Start");
            p.font.color = "#ef4444";
            p.font.italic = true;
            p.font.size = 9;
            break;
          }
        }
        await context.sync();
      });
    } catch { /* best effort */ }

    if (statusEl) {
      statusEl.innerHTML = `<div style="border-left:3px solid #ef4444;padding:10px 12px;font-size:11px;color:#ef4444;margin-bottom:8px;">Failed: ${err.message || "Unknown error"}</div>`;
      setTimeout(() => { statusEl.style.display = "none"; }, 6000);
    }
  }

  merrisProcessing = false;
}

async function cancelPendingAction(): Promise<void> {
  pendingAction = null;
  const statusEl = document.getElementById("merris-command-status");
  if (statusEl) statusEl.style.display = "none";
  await cleanupDocumentMarkers();
}

async function cleanupDocumentMarkers(): Promise<void> {
  try {
    await Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text,items/font");
      await ctx.sync();
      for (const p of paras.items) {
        if (p.text?.includes("[Merris received:")) {
          p.delete();
        }
        try {
          if (p.font.highlightColor === "#FFFF00" || p.font.highlightColor === "Yellow") {
            p.font.highlightColor = "None";
          }
        } catch { /* skip */ }
      }
      await ctx.sync();
    });
  } catch {
    // cleanup is best-effort
  }
}

// ============================================================
// FIX 3: Compliance Tab (populated from perception results)
// ============================================================

function populateComplianceTab(): void {
  const notesEl = document.getElementById("compliance-notes");
  const summaryEl = document.getElementById("compliance-summary");
  if (!notesEl) return;

  if (!lastPerception) {
    notesEl.innerHTML = `<div class="merris-card"><p style="font-size:13px; color:var(--merris-text-secondary);">Run document analysis to see compliance coverage.</p></div>`;
    return;
  }

  const { complianceStatus, structure } = lastPerception;

  // Summary: count frameworks covered
  const frameworks: Record<string, { total: number; covered: number }> = {};
  for (const sec of structure.sections) {
    if (sec.frameworkRef) {
      const fw = sec.frameworkRef.split(" ")[0]; // e.g. "GRI" from "GRI 305-1"
      if (!frameworks[fw]) frameworks[fw] = { total: 0, covered: 0 };
      frameworks[fw].total++;
      if (sec.status === "drafted" || sec.status === "data_only") {
        frameworks[fw].covered++;
      }
    }
  }

  if (summaryEl) {
    const fwHtml = Object.entries(frameworks).map(([fw, data]) => {
      const pct = data.total > 0 ? Math.round((data.covered / data.total) * 100) : 0;
      const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444";
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px;">
        <span>${fw}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:60px;height:4px;background:var(--merris-border,#333);border-radius:2px;">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;"></div>
          </div>
          <span style="color:${color};font-weight:600;min-width:35px;text-align:right;">${pct}%</span>
        </div>
      </div>`;
    }).join("");
    summaryEl.innerHTML = fwHtml || "";
  }

  // Mandatory gaps with "Draft this" buttons
  if (complianceStatus.mandatoryGaps.length === 0) {
    notesEl.innerHTML = `<div class="merris-card"><p style="font-size:13px; color:#22c55e;">No mandatory compliance gaps detected.</p></div>`;
    return;
  }

  notesEl.innerHTML = complianceStatus.mandatoryGaps.map((gap, idx) => `
    <div class="merris-card" style="padding:8px 10px;margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:600;color:#ef4444;">${escapeHtml(gap.framework)} ${escapeHtml(gap.disclosureCode)}</div>
          <div style="font-size:11px;color:var(--merris-text-secondary,#999);margin-top:2px;">${escapeHtml(gap.disclosureName)}</div>
        </div>
        <button class="merris-btn merris-btn-primary compliance-draft-btn" data-gap-idx="${idx}" style="font-size:10px;padding:3px 8px;white-space:nowrap;margin-left:6px;">Draft this</button>
      </div>
    </div>
  `).join("");

  // Wire up "Draft this" buttons
  notesEl.querySelectorAll<HTMLButtonElement>(".compliance-draft-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-gap-idx") || "0", 10);
      const gap = complianceStatus.mandatoryGaps[idx];
      if (gap) {
        btn.disabled = true;
        btn.textContent = "Drafting...";
        runSectionAction("Draft the " + gap.framework + " " + gap.disclosureCode + " disclosure: " + gap.disclosureName);
      }
    });
  });
}

async function loadComplianceNotes(heading: string, framework: string): Promise<void> {
  const container = document.getElementById("compliance-notes");
  if (!container) return;

  // If we have perception data, use it
  if (lastPerception) {
    populateComplianceTab();
    return;
  }

  container.innerHTML = `<div class="merris-loading"><span class="merris-spinner"></span> Loading...</div>`;

  try {
    const result = await api.post<{
      requirements: Array<{ id: string; description: string; mandatory: boolean }>;
    }>("/agent/compliance-notes", { heading, framework });

    if (result.requirements.length === 0) {
      container.innerHTML = `<p style="color:var(--merris-text-secondary); font-size:13px;">No specific requirements found for this section.</p>`;
      return;
    }

    container.innerHTML = `<ul class="merris-list">${result.requirements
      .map(
        (r) => `
        <li>
          <span class="merris-badge ${r.mandatory ? "merris-badge-error" : "merris-badge-warning"}">${r.mandatory ? "Required" : "Recommended"}</span>
          <strong>${r.id}</strong>: ${r.description}
        </li>`
      )
      .join("")}</ul>`;
  } catch {
    container.innerHTML = `<p style="color:var(--merris-text-secondary); font-size:13px;">Could not load compliance notes.</p>`;
  }
}

// ============================================================
// FIX 3 + 5: Suggested Tab (populated from judgment results)
// ============================================================

function populateSuggestedTab(): void {
  const container = document.getElementById("suggested-content");
  if (!container) return;

  if (!lastJudgment) {
    container.innerHTML = `<div class="merris-card"><p style="font-size:13px; color:var(--merris-text-secondary);">Run a review to see issues and suggestions.</p></div>`;
    return;
  }

  const j = lastJudgment;
  let html = "";

  // Critical issues with "Redraft" buttons
  if (j.criticalIssues.length > 0) {
    html += `<div style="font-size:12px;font-weight:600;color:#ef4444;margin-bottom:6px;">Critical Issues (${j.criticalIssues.length})</div>`;
    html += j.criticalIssues.map((issue, idx) => `
      <div class="merris-card" style="padding:8px 10px;margin-bottom:6px;border-left:3px solid #ef4444;">
        <div style="font-size:11px;font-weight:600;color:var(--merris-text,#eee);">${escapeHtml(issue.location)}</div>
        <div style="font-size:11px;color:var(--merris-text-secondary,#999);margin:4px 0;">${escapeHtml(issue.issue)}</div>
        <div style="font-size:11px;color:var(--merris-text-secondary,#999);font-style:italic;margin-bottom:6px;">${escapeHtml(issue.recommendation)}</div>
        <div style="display:flex;gap:4px;">
          <button class="merris-btn merris-btn-primary suggested-redraft-btn" data-type="critical" data-idx="${idx}" style="font-size:10px;padding:3px 8px;">Redraft</button>
          <button class="merris-btn merris-btn-secondary suggested-add-btn" data-type="critical" data-idx="${idx}" style="font-size:10px;padding:3px 8px;">Add content</button>
        </div>
      </div>
    `).join("");
  }

  // Improvements with action buttons
  if (j.improvements.length > 0) {
    html += `<div style="font-size:12px;font-weight:600;color:#f59e0b;margin:10px 0 6px 0;">Improvements (${j.improvements.length})</div>`;
    html += j.improvements.map((issue, idx) => `
      <div class="merris-card" style="padding:8px 10px;margin-bottom:6px;border-left:3px solid #f59e0b;">
        <div style="font-size:11px;font-weight:600;color:var(--merris-text,#eee);">${escapeHtml(issue.location)}</div>
        <div style="font-size:11px;color:var(--merris-text-secondary,#999);margin:4px 0;">${escapeHtml(issue.issue)}</div>
        <div style="display:flex;gap:4px;margin-top:4px;">
          <button class="merris-btn merris-btn-secondary suggested-redraft-btn" data-type="improvement" data-idx="${idx}" style="font-size:10px;padding:3px 8px;">Redraft</button>
          <button class="merris-btn merris-btn-secondary suggested-add-btn" data-type="improvement" data-idx="${idx}" style="font-size:10px;padding:3px 8px;">Add content</button>
        </div>
      </div>
    `).join("");
  }

  // Suggestions
  if (j.suggestions.length > 0) {
    html += `<div style="font-size:12px;font-weight:600;color:#3b82f6;margin:10px 0 6px 0;">Suggestions (${j.suggestions.length})</div>`;
    html += j.suggestions.map((issue, idx) => `
      <div class="merris-card" style="padding:8px 10px;margin-bottom:6px;border-left:3px solid #3b82f6;">
        <div style="font-size:11px;font-weight:600;color:var(--merris-text,#eee);">${escapeHtml(issue.location)}</div>
        <div style="font-size:11px;color:var(--merris-text-secondary,#999);margin:4px 0;">${escapeHtml(issue.issue)}</div>
        <div style="display:flex;gap:4px;margin-top:4px;">
          <button class="merris-btn merris-btn-secondary suggested-add-btn" data-type="suggestion" data-idx="${idx}" style="font-size:10px;padding:3px 8px;">Apply</button>
        </div>
      </div>
    `).join("");
  }

  if (!html) {
    html = `<div class="merris-card"><p style="font-size:13px;color:#22c55e;">No issues found. The document looks good.</p></div>`;
  }

  container.innerHTML = html;

  // Wire up "Redraft" buttons (FIX 5)
  container.querySelectorAll<HTMLButtonElement>(".suggested-redraft-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-type") || "";
      const idx = parseInt(btn.getAttribute("data-idx") || "0", 10);
      const issues = type === "critical" ? j.criticalIssues : j.improvements;
      const issue = issues[idx];
      if (issue) {
        btn.disabled = true;
        btn.textContent = "Working...";
        const top3 = issues.slice(0, 3).map(i => i.issue).join("; ");
        runSectionAction("Redraft the section '" + issue.location + "' to address these issues: " + top3);
      }
    });
  });

  // Wire up "Add content" buttons (FIX 5)
  container.querySelectorAll<HTMLButtonElement>(".suggested-add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-type") || "";
      const idx = parseInt(btn.getAttribute("data-idx") || "0", 10);
      const issues = type === "critical" ? j.criticalIssues : type === "improvement" ? j.improvements : j.suggestions;
      const issue = issues[idx];
      if (issue) {
        btn.disabled = true;
        btn.textContent = "Working...";
        runSectionAction("Add the following missing content to the section '" + issue.location + "': " + issue.recommendation);
      }
    });
  });
}

// ============================================================
// FIX 3: Citations Tab (populated from perception data)
// ============================================================

function populateCitationsTab(): void {
  const container = document.getElementById("citation-trail");
  if (!container) return;

  if (!lastPerception) {
    container.innerHTML = `<div class="merris-card"><p style="font-size:13px; color:var(--merris-text-secondary);">Run document analysis to see data source citations.</p></div>`;
    return;
  }

  const { dataAlignment, structure } = lastPerception;
  let html = "";

  // Data mismatches as citation items
  if (dataAlignment.mismatches.length > 0) {
    html += `<div style="font-size:12px;font-weight:600;color:#ef4444;margin-bottom:6px;">Data Mismatches (${dataAlignment.mismatches.length})</div>`;
    html += dataAlignment.mismatches.map((m) => `
      <div class="merris-card" style="padding:8px 10px;margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:var(--merris-text,#eee);">${escapeHtml(m.metric)}</div>
        <div style="font-size:11px;color:var(--merris-text-secondary,#999);margin-top:2px;">
          Document: <span style="color:#ef4444;">${m.documentValue.toLocaleString()}</span>
          | Database: <span style="color:#22c55e;">${m.databaseValue.toLocaleString()} ${escapeHtml(m.databaseUnit)}</span>
        </div>
        <div style="font-size:11px;color:var(--merris-text-secondary,#999);font-style:italic;margin-top:2px;">${escapeHtml(m.suggestion)}</div>
      </div>
    `).join("");
  }

  // Missing from document
  if (dataAlignment.missingFromDocument.length > 0) {
    html += `<div style="font-size:12px;font-weight:600;color:#f59e0b;margin:10px 0 6px 0;">Missing from Document (${dataAlignment.missingFromDocument.length})</div>`;
    html += dataAlignment.missingFromDocument.map((metric) => `
      <div class="merris-card" style="padding:6px 10px;margin-bottom:4px;">
        <div style="font-size:11px;color:var(--merris-text-secondary,#999);">${escapeHtml(metric)}</div>
      </div>
    `).join("");
  }

  // Sections with data
  const dataSections = structure.sections.filter(s => s.figureCount > 0);
  if (dataSections.length > 0) {
    html += `<div style="font-size:12px;font-weight:600;color:#3b82f6;margin:10px 0 6px 0;">Sections with Data Points</div>`;
    html += dataSections.map((s) => `
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px;border-bottom:1px solid var(--merris-border,#333);">
        <span style="color:var(--merris-text,#eee);">${escapeHtml(s.heading)}</span>
        <span style="color:var(--merris-text-secondary,#999);">${s.figureCount} figures</span>
      </div>
    `).join("");
  }

  if (!html) {
    html = `<div class="merris-card"><p style="font-size:13px; color:var(--merris-text-secondary);">No data points detected in the document.</p></div>`;
  }

  container.innerHTML = html;
}

// ============================================================
// Document Operations (reliable patterns only)
// ============================================================

async function insertTable(data: string[][]): Promise<void> {
  try {
    await Word.run(async (context: any) => {
      if (data.length === 0) return;

      const rowCount = data.length;
      const colCount = data[0].length;

      const table = context.document.body.insertTable(
        rowCount,
        colCount,
        Word.InsertLocation.end,
        data
      );

      table.styleBuiltIn = Word.BuiltInStyleName.gridTable4Accent1;
      table.headerRowCount = 1;

      await context.sync();
      showNotification("Table inserted successfully.");
    });
  } catch (err: any) {
    showNotification("Table insert error: " + (err.message || "Unknown error"));
  }
}

// ---- Document Perception (auto-briefing on open) ----

async function runPerception(engagementId: string): Promise<void> {
  const briefingEl = document.getElementById("perception-briefing");
  if (briefingEl) {
    briefingEl.style.display = "block";
    briefingEl.innerHTML = `<div class="merris-loading"><span class="merris-spinner"></span> Analyzing document...</div>`;
  }

  try {
    const docBody = await readFullDocument();
    if (!docBody || docBody.trim().length < 20) {
      if (briefingEl) {
        briefingEl.innerHTML = `<div class="merris-card" style="padding:12px;">
          <p style="font-size:13px; color:var(--merris-text-secondary);">Document is empty or too short to analyze. Start writing and Merris will analyze when you return.</p>
        </div>`;
      }
      return;
    }

    const perception: PerceptionResult = await api.post("/agent/perceive", {
      engagementId,
      documentBody: docBody,
      documentType: "word",
    });

    // Store for tab population
    lastPerception = perception;

    renderPerceptionBriefing(perception);

    // Populate compliance and citations tabs from perception data
    populateComplianceTab();
    populateCitationsTab();
  } catch (err: any) {
    if (briefingEl) {
      briefingEl.innerHTML = `<div class="merris-card" style="padding:12px; color:#ef4444;">
        Perception failed: ${err.message || "Unknown error"}
      </div>`;
    }
  }
}

async function readFullDocument(): Promise<string> {
  return new Promise((resolve) => {
    try {
      Word.run(async (context: any) => {
        const body = context.document.body;
        body.load("text");
        const paragraphs = body.paragraphs;
        paragraphs.load("items/text,items/style");
        await context.sync();

        let fullText = "";
        for (const para of paragraphs.items) {
          const text = para.text?.trim() || "";
          if (!text) continue;
          const style = para.style?.toLowerCase() || "";
          if (style.includes("heading")) {
            fullText += "\n" + text + "\n";
          } else {
            fullText += text + "\n";
          }
        }
        resolve(fullText);
      });
    } catch {
      resolve("");
    }
  });
}

function renderPerceptionBriefing(p: PerceptionResult): void {
  const briefingEl = document.getElementById("perception-briefing");
  if (!briefingEl) return;

  const { structure, dataAlignment, complianceStatus, urgency } = p;

  // Status bar
  const readinessColor = urgency.partnerReadiness >= 75 ? "#22c55e" :
    urgency.partnerReadiness >= 50 ? "#eab308" : "#ef4444";
  const deadlineText = urgency.deadlineDays !== null ? `${urgency.deadlineDays}d to deadline` : "";

  // Section checklist
  const sectionIcons: Record<string, string> = {
    drafted: "[OK]", placeholder: "[TODO]", empty: "[--]", data_only: "[DATA]"
  };
  const sectionList = structure.sections.map((s) => {
    const icon = sectionIcons[s.status] || "[?]";
    const fw = s.frameworkRef ? ` (${s.frameworkRef})` : "";
    const detail = s.status === "drafted" ? `${s.wordCount}w, ${s.figureCount} figures` :
      s.status === "placeholder" ? "needs drafting" :
      s.status === "empty" ? "missing" : `${s.figureCount} data points`;
    return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px;">
      <span>${icon}</span>
      <span style="flex:1;">${escapeHtml(s.heading)}${fw}</span>
      <span style="color:var(--merris-text-secondary,#999);font-size:11px;">${detail}</span>
    </div>`;
  }).join("");

  // Mismatches
  const mismatchHtml = dataAlignment.mismatches.length > 0
    ? `<div style="margin-top:8px;">
        <div style="font-size:12px;font-weight:600;color:#ef4444;margin-bottom:4px;">Data Mismatches</div>
        ${dataAlignment.mismatches.slice(0, 5).map((m) =>
          `<div style="font-size:11px;padding:2px 0;color:var(--merris-text-secondary,#999);">
            ${escapeHtml(m.metric)}: <span style="color:#ef4444;">${m.documentValue.toLocaleString()}</span> to <span style="color:#22c55e;">${m.databaseValue.toLocaleString()} ${escapeHtml(m.databaseUnit)}</span>
          </div>`
        ).join("")}
      </div>` : "";

  // Mandatory gaps
  const gapHtml = complianceStatus.mandatoryGaps.length > 0
    ? `<div style="margin-top:8px;">
        <div style="font-size:12px;font-weight:600;color:#f59e0b;margin-bottom:4px;">Mandatory Gaps</div>
        ${complianceStatus.mandatoryGaps.slice(0, 5).map((g) =>
          `<div style="font-size:11px;padding:2px 0;color:var(--merris-text-secondary,#999);">
            ${escapeHtml(g.framework)} ${escapeHtml(g.disclosureCode)}: ${escapeHtml(g.disclosureName)}
          </div>`
        ).join("")}
        ${complianceStatus.mandatoryGaps.length > 5 ? `<div style="font-size:11px;color:var(--merris-text-secondary);">...and ${complianceStatus.mandatoryGaps.length - 5} more</div>` : ""}
      </div>` : "";

  // Review buttons
  const reviewButtons = `<div style="margin-top:10px;display:flex;gap:4px;">
    <button class="merris-btn merris-btn-primary" style="font-size:11px;padding:5px 10px;flex:1;" id="review-quick">Quick Review</button>
    <button class="merris-btn merris-btn-secondary" style="font-size:11px;padding:5px 10px;flex:1;" id="review-thorough">Full Review</button>
    <button class="merris-btn merris-btn-secondary" style="font-size:11px;padding:5px 10px;flex:1;" id="review-partner">Partner Sim</button>
  </div>`;

  const actionsHtml = urgency.criticalActions.length > 0
    ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px;">
        ${urgency.criticalActions.map((a) =>
          `<button class="merris-btn merris-btn-secondary critical-action-btn" style="font-size:11px;padding:4px 8px;">${escapeHtml(a.replace(/^(URGENT:|GAPS:)\s*/, "").substring(0, 40))}</button>`
        ).join("")}
      </div>` : "";

  briefingEl.style.display = "block";
  briefingEl.innerHTML = `
    <div style="border:1px solid var(--merris-border,#333);border-radius:8px;padding:12px;margin-bottom:12px;background:var(--merris-bg-secondary,#1a1a1a);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:600;">Document Analysis</span>
        <div style="display:flex;align-items:center;gap:8px;">
          ${deadlineText ? `<span style="font-size:11px;color:var(--merris-text-secondary,#999);">${deadlineText}</span>` : ""}
          <span style="font-size:12px;font-weight:700;color:${readinessColor};">${urgency.partnerReadiness}/100</span>
        </div>
      </div>
      <div style="height:4px;background:var(--merris-border,#333);border-radius:2px;margin-bottom:10px;">
        <div style="height:100%;width:${urgency.partnerReadiness}%;background:${readinessColor};border-radius:2px;transition:width 0.5s;"></div>
      </div>
      <div style="font-size:12px;color:var(--merris-text-secondary,#999);margin-bottom:8px;">
        ${structure.totalSections} sections: ${structure.draftedSections} drafted, ${structure.placeholderSections} placeholder, ${structure.emptySections} empty
      </div>
      ${sectionList}
      ${mismatchHtml}
      ${gapHtml}
      ${actionsHtml}
      ${reviewButtons}
    </div>
  `;

  // Wire review buttons (not using onclick to avoid CSP issues)
  document.getElementById("review-quick")?.addEventListener("click", () => {
    const engId = localStorage.getItem("merris_engagement_id");
    if (engId) runReview(engId, "quick");
  });
  document.getElementById("review-thorough")?.addEventListener("click", () => {
    const engId = localStorage.getItem("merris_engagement_id");
    if (engId) runReview(engId, "thorough");
  });
  document.getElementById("review-partner")?.addEventListener("click", () => {
    const engId = localStorage.getItem("merris_engagement_id");
    if (engId) runReview(engId, "partner_review");
  });

  // Wire critical action buttons
  briefingEl.querySelectorAll<HTMLButtonElement>(".critical-action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const actionText = btn.textContent || "";
      btn.style.opacity = "0.5";
      btn.disabled = true;
      runSectionAction(actionText);
    });
  });
}

// ---- Quality Judgment ----

async function runReview(engagementId: string, level: "quick" | "thorough" | "partner_review" = "thorough"): Promise<void> {
  const briefingEl = document.getElementById("perception-briefing");
  if (!briefingEl) return;

  const existingReview = document.getElementById("judgment-results");
  if (existingReview) existingReview.remove();

  const loadingEl = document.createElement("div");
  loadingEl.id = "judgment-results";
  loadingEl.innerHTML = `<div class="merris-loading" style="padding:12px;"><span class="merris-spinner"></span> Running ${level} review...</div>`;
  briefingEl.after(loadingEl);

  try {
    const docBody = await readFullDocument();
    if (!docBody || docBody.trim().length < 20) {
      loadingEl.innerHTML = `<div style="padding:12px;color:var(--merris-text-secondary);">Document too short to review.</div>`;
      return;
    }

    const judgment = await judgeFullDocument(engagementId, docBody, level);

    // Store for tab population
    lastJudgment = judgment;

    renderJudgment(judgment, loadingEl);

    // Populate suggested tab from judgment results (FIX 3 + 5)
    populateSuggestedTab();
  } catch (err: any) {
    loadingEl.innerHTML = `<div style="padding:12px;color:#ef4444;">Review failed: ${err.message || "Unknown error"}</div>`;
  }
}

function renderJudgment(j: DocumentJudgment, container: HTMLElement): void {
  const scoreColor = j.overallScore >= 85 ? "#22c55e" : j.overallScore >= 75 ? "#3b82f6" :
    j.overallScore >= 60 ? "#eab308" : "#ef4444";
  const partnerLabel = j.partnerWouldApprove ? "PASS" : "FAIL";
  const auditorLabel = j.auditorWouldAccept ? "PASS" : "FAIL";

  const issuesList = (items: typeof j.criticalIssues, color: string) =>
    items.slice(0, 5).map(i =>
      `<div style="font-size:11px;padding:4px 0;border-bottom:1px solid var(--merris-border,#333);">
        <div style="color:${color};font-weight:600;">${escapeHtml(i.location)}</div>
        <div style="color:var(--merris-text,#eee);">${escapeHtml(i.issue)}</div>
        <div style="color:var(--merris-text-secondary,#999);font-style:italic;">${escapeHtml(i.recommendation)}</div>
      </div>`
    ).join("");

  const sectionScores = j.sections.map(s => {
    const c = s.score >= 85 ? "#22c55e" : s.score >= 75 ? "#3b82f6" : s.score >= 60 ? "#eab308" : "#ef4444";
    return `<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:11px;">
      <span>${escapeHtml(s.sectionTitle.substring(0, 35))}</span>
      <span style="color:${c};font-weight:600;">${s.score}/100 ${s.verdict}</span>
    </div>`;
  }).join("");

  // FIX 5: Apply loop action buttons
  const applyButtons = `<div style="margin-top:10px;display:flex;gap:4px;">
    <button class="merris-btn merris-btn-primary" style="font-size:11px;padding:5px 10px;flex:1;" id="apply-redraft">Redraft weak sections</button>
    <button class="merris-btn merris-btn-secondary" style="font-size:11px;padding:5px 10px;flex:1;" id="apply-missing">Add missing content</button>
  </div>`;

  container.innerHTML = `
    <div style="border:1px solid var(--merris-border,#333);border-radius:8px;padding:12px;margin-top:8px;background:var(--merris-bg-secondary,#1a1a1a);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:600;">Quality Judgment</span>
        <span style="font-size:20px;font-weight:700;color:${scoreColor};">${j.overallScore}/100</span>
      </div>
      <div style="height:4px;background:var(--merris-border,#333);border-radius:2px;margin-bottom:8px;">
        <div style="height:100%;width:${j.overallScore}%;background:${scoreColor};border-radius:2px;"></div>
      </div>
      <div style="display:flex;gap:12px;font-size:11px;margin-bottom:10px;">
        <span>${partnerLabel} Partner: ${j.partnerWouldApprove ? "would approve" : "would reject"}</span>
        <span>${auditorLabel} Auditor: ${j.auditorWouldAccept ? "would accept" : "would flag"}</span>
      </div>
      ${sectionScores ? `<div style="margin-bottom:8px;"><div style="font-size:12px;font-weight:600;margin-bottom:4px;">Section Scores</div>${sectionScores}</div>` : ""}
      ${j.criticalIssues.length > 0 ? `<div style="margin-top:8px;"><div style="font-size:12px;font-weight:600;color:#ef4444;margin-bottom:4px;">Critical Issues (${j.criticalIssues.length})</div>${issuesList(j.criticalIssues, "#ef4444")}</div>` : ""}
      ${j.improvements.length > 0 ? `<div style="margin-top:8px;"><div style="font-size:12px;font-weight:600;color:#f59e0b;margin-bottom:4px;">Improvements (${j.improvements.length})</div>${issuesList(j.improvements, "#f59e0b")}</div>` : ""}
      ${j.suggestions.length > 0 ? `<div style="margin-top:8px;"><div style="font-size:12px;font-weight:600;color:#3b82f6;margin-bottom:4px;">Suggestions (${j.suggestions.length})</div>${issuesList(j.suggestions, "#3b82f6")}</div>` : ""}
      ${applyButtons}
    </div>
  `;

  // Wire apply loop buttons (FIX 5)
  document.getElementById("apply-redraft")?.addEventListener("click", async () => {
    const btn = document.getElementById("apply-redraft") as HTMLButtonElement;
    if (btn) { btn.disabled = true; btn.textContent = "Working..."; }

    // Find weakest sections and redraft them
    const weakSections = j.sections.filter(s => s.score < 70).slice(0, 3);
    const top3Issues = j.criticalIssues.slice(0, 3).map(i => i.issue).join("; ");
    const sectionNames = weakSections.map(s => s.sectionTitle).join(", ");
    const instruction = sectionNames
      ? "Redraft the following weak sections to address these issues: " + sectionNames + ". Issues: " + top3Issues
      : "Redraft the weakest parts of this document to address: " + top3Issues;

    await runSectionAction(instruction);

    // Re-run quick review after apply
    const engId = localStorage.getItem("merris_engagement_id");
    if (engId) {
      setTimeout(() => runReview(engId, "quick"), 2000);
    }
  });

  document.getElementById("apply-missing")?.addEventListener("click", async () => {
    const btn = document.getElementById("apply-missing") as HTMLButtonElement;
    if (btn) { btn.disabled = true; btn.textContent = "Working..."; }

    // Add missing content from improvements and suggestions
    const missingItems = [...j.improvements, ...j.suggestions].slice(0, 3).map(i => i.recommendation).join("; ");
    const instruction = "Add the following missing content to the document: " + missingItems;

    await runSectionAction(instruction);

    // Re-run quick review after apply
    const engId = localStorage.getItem("merris_engagement_id");
    if (engId) {
      setTimeout(() => runReview(engId, "quick"), 2000);
    }
  });
}

// Make runReview available globally for any remaining onclick refs
(window as any).merrisReview = (level: string) => {
  const engId = localStorage.getItem("merris_engagement_id");
  if (engId) runReview(engId, level as "quick" | "thorough" | "partner_review");
};

// ---- Helpers ----

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showNotification(message: string): void {
  console.log("[Merris]", message);
  const existing = document.getElementById("merris-notification");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "merris-notification";
  el.style.cssText = `
    position: fixed; bottom: 16px; left: 16px; right: 16px;
    padding: 10px 14px; background: var(--merris-bg-secondary);
    border: 1px solid var(--merris-border); border-radius: var(--merris-radius);
    color: var(--merris-text); font-size: 13px; z-index: 1000;
    box-shadow: var(--merris-shadow);
  `;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
