/**
 * Merris ESG Agent -- Word Taskpane
 *
 * Panels:
 * 1. Current section detector (reads headings, identifies GRI/ESRS disclosure)
 * 2. Agent chat contextual to current section
 * 3. Compliance notes (requirements for detected disclosure)
 * 4. Suggested content (click to insert)
 * 5. Citation trail (data sources for inserted figures)
 */

import { AgentPanel } from "../../../shared/agent-panel";
import { ensureAuthenticated } from "../../../shared/auth";
import {
  api,
  draftDisclosure,
  checkConsistency,
  getEvidenceTrail,
} from "../../../shared/api-client";
import "../../../shared/styles.css";

/* globals Office, Word */
declare const Office: any;
declare const Word: any;

let agentPanel: AgentPanel | null = null;
let currentHeading = "";
let currentFramework = "";

// ---- Initialization ----

Office.onReady(async (info: { host: string }) => {
  if (info.host === "Word" || info.host === "Document") {
    try {
      await ensureAuthenticated();
    } catch {
      // Continue without auth in dev
    }
    setupTabs();
    initAgentPanel();
    detectCurrentSection();

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

// ---- Section Detection ----

async function detectCurrentSection(): Promise<void> {
  try {
    await Word.run(async (context: any) => {
      // Get paragraphs near cursor
      const selection = context.document.getSelection();
      const body = context.document.body;
      const paragraphs = body.paragraphs;
      paragraphs.load("items/text,items/style");
      selection.load("text");
      await context.sync();

      // Walk backwards from cursor position to find nearest heading
      let foundHeading = "";
      let detectedFramework = "";

      for (const para of paragraphs.items) {
        const style = para.style?.toLowerCase() || "";
        const text = para.text?.trim() || "";

        if (
          style.includes("heading") ||
          text.match(/^(GRI|ESRS|IFRS S|TCFD|SASB)\s/i)
        ) {
          foundHeading = text;

          // Detect framework from heading text
          if (text.match(/^GRI\s/i) || text.match(/GRI\s\d/i)) {
            detectedFramework = "GRI";
          } else if (text.match(/^ESRS\s/i) || text.match(/ESRS\s[A-Z]/i)) {
            detectedFramework = "ESRS";
          } else if (text.match(/TCFD/i)) {
            detectedFramework = "TCFD";
          } else if (text.match(/SASB/i)) {
            detectedFramework = "SASB";
          } else if (text.match(/IFRS\sS/i)) {
            detectedFramework = "IFRS S";
          }
        }
      }

      currentHeading = foundHeading;
      currentFramework = detectedFramework;

      // Update UI
      const headingEl = document.getElementById("section-heading");
      const frameworkEl = document.getElementById("section-framework");
      if (headingEl) {
        headingEl.textContent = foundHeading || "No disclosure heading detected";
      }
      if (frameworkEl) {
        frameworkEl.textContent = detectedFramework
          ? `Framework: ${detectedFramework}`
          : "Place cursor under a GRI/ESRS heading";
      }

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
        loadSuggestedContent(currentHeading, currentFramework);
      }
    });
  } catch {
    // Section detection is best-effort
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
  });
}

function handleAgentAction(action: {
  type: string;
  payload: Record<string, unknown>;
}): void {
  switch (action.type) {
    case "insert_content":
      if (typeof action.payload.text === "string") {
        insertContent(action.payload.text);
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

// ---- Compliance Notes ----

async function loadComplianceNotes(
  heading: string,
  framework: string
): Promise<void> {
  const container = document.getElementById("compliance-notes");
  if (!container) return;

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
    container.innerHTML = `<p style="color:var(--merris-text-secondary); font-size:13px;">Could not load compliance notes. Check your connection.</p>`;
  }
}

// ---- Suggested Content ----

async function loadSuggestedContent(
  heading: string,
  framework: string
): Promise<void> {
  const container = document.getElementById("suggested-content");
  if (!container) return;

  container.innerHTML = `<div class="merris-loading"><span class="merris-spinner"></span> Generating suggestions...</div>`;

  try {
    const draft = await draftDisclosure(heading, framework);

    container.innerHTML = `
      <div class="merris-card">
        <div class="merris-card-header">${draft.disclosure_id}: ${draft.heading}</div>
        <p style="font-size:13px; color:var(--merris-text-secondary); margin:8px 0; white-space:pre-wrap;">${draft.content.substring(0, 300)}${draft.content.length > 300 ? "..." : ""}</p>
        <button class="merris-btn merris-btn-primary" id="btn-insert-draft">Insert Draft</button>
      </div>
      ${
        draft.citations.length > 0
          ? `<div class="merris-card">
              <div class="merris-card-header">Sources</div>
              <ul class="merris-list">
                ${draft.citations.map((c) => `<li>${c.source}${c.page ? ` (p. ${c.page})` : ""}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }
    `;

    const insertBtn = document.getElementById("btn-insert-draft");
    if (insertBtn) {
      insertBtn.addEventListener("click", () => insertContent(draft.content));
    }
  } catch {
    container.innerHTML = `
      <div class="merris-card">
        <p style="font-size:13px; color:var(--merris-text-secondary);">
          Could not generate suggestions. Try using the Agent chat instead.
        </p>
      </div>
    `;
  }
}

// ---- Document Operations ----

async function insertContent(text: string): Promise<void> {
  try {
    await Word.run(async (context: any) => {
      const selection = context.document.getSelection();
      // Insert after current cursor position with tracked-changes style
      const paragraphs = text.split("\n").filter((p: string) => p.trim());
      for (const para of paragraphs) {
        context.document.body.insertParagraph(para, Word.InsertLocation.end);
      }
      await context.sync();
      showNotification("Content inserted successfully.");
    });
  } catch (err: any) {
    showNotification(`Insert error: ${err.message || "Unknown error"}`);
  }
}

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

      // Style the header row
      table.styleBuiltIn = Word.BuiltInStyleName.gridTable4Accent1;
      table.headerRowCount = 1;

      await context.sync();
      showNotification("Table inserted successfully.");
    });
  } catch (err: any) {
    showNotification(`Table insert error: ${err.message || "Unknown error"}`);
  }
}

// ---- Helpers ----

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
