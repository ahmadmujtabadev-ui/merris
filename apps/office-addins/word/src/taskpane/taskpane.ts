// src/taskpane/taskpane.ts — Orchestrator
//
// Slim entry point: Office.onReady → engagement selection → init modules.

import { EngagementSelector, EngagementInfo } from "../../../shared/engagement-selector";
import { ensureAuthenticated } from "../../../shared/auth";
import "../../../shared/styles.css";

import { MerrisState } from "./state";
import { InsightsTab } from "./tabs/insights-tab";
import { ActionsTab } from "./tabs/actions-tab";
import { ChatTab } from "./tabs/chat-tab";
import { HistoryTab } from "./tabs/history-tab";
import { MerrisFooter } from "./footer";
import { startPolling, classifyCommand } from "./merris-commands";
import { runInitialPerception, runJudgment } from "./perception";

/* globals Office */
declare const Office: any;

let state: MerrisState;
let chatTab: ChatTab;

Office.onReady(async (info: { host: string }) => {
  if (info.host !== "Word" && info.host !== "Document") return;

  try { await ensureAuthenticated(); } catch { /* dev mode */ }

  state = new MerrisState();

  const selectorContainer = document.getElementById("engagement-selector-container")!;
  const appContainer = document.getElementById("merris-app")!;

  new EngagementSelector({
    parentElement: selectorContainer,
    onSelect: (engagement: EngagementInfo | null, mode: string) => {
      selectorContainer.style.display = "none";
      appContainer.style.display = "flex";

      if (engagement) {
        state.engagementId = engagement.id;
        state.engagementName = engagement.name;
        localStorage.setItem("merris_engagement_id", engagement.id);
      }

      initApp();
    },
  });
});

function initApp(): void {
  // Init tabs
  const insightsTab = new InsightsTab(document.getElementById("tab-insights")!, state);
  const actionsTab = new ActionsTab(document.getElementById("tab-actions")!, state);
  chatTab = new ChatTab(document.getElementById("tab-chat")!, state);
  const historyTab = new HistoryTab(document.getElementById("tab-history")!, state);

  // Init footer
  const footer = new MerrisFooter(
    document.getElementById("merris-footer")!,
    state,
    handleQuickInput
  );

  // Tab switching
  setupTabSwitching();

  // Wire review buttons in Insights tab
  document.getElementById("btn-quick-review")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-quick-review") as HTMLButtonElement;
    btn.disabled = true; btn.textContent = "...";
    await runJudgment(state, "quick");
    btn.disabled = false; btn.textContent = "Quick Review";
  });

  document.getElementById("btn-full-review")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-full-review") as HTMLButtonElement;
    btn.disabled = true; btn.textContent = "...";
    await runJudgment(state, "thorough");
    btn.disabled = false; btn.textContent = "Full Review";
  });

  document.getElementById("btn-partner-sim")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-partner-sim") as HTMLButtonElement;
    btn.disabled = true; btn.textContent = "...";
    await runJudgment(state, "partner_review");
    btn.disabled = false; btn.textContent = "Partner Sim";
  });

  // Verify Document button
  document.getElementById("btn-verify-doc")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-verify-doc") as HTMLButtonElement;
    btn.disabled = true; btn.textContent = "Verifying...";
    try {
      const { readFullDocument } = await import("./document-ops");
      const { verifyDocument } = await import("../../../shared/api-client");
      const docText = await readFullDocument();
      const result = await verifyDocument(state.engagementId, docText, []);
      // Convert verification findings to insight cards
      if (result.findings) {
        for (const f of result.findings.slice(0, 10)) {
          const description = f.description ?? f.message ?? "";
          const sectionRef = typeof f.location === "string" ? f.location : f.location?.section ?? "";
          state.addInsight({
            type: f.type === "compliance_gap" ? "compliance_gap" : f.type === "calculation_error" ? "data_issue" : "quality_issue",
            title: description.substring(0, 80),
            detail: `${description}\n\nRecommendation: ${f.recommendation ?? ""}\nAudit Risk: ${f.auditRisk ?? ""}`,
            sectionRef,
            proactive: false,
            actions: [
              { label: "Fix this", actionType: "fix" },
              { label: "Dismiss", actionType: "dismiss" },
            ],
          });
        }
      }
      // Update score from verification
      if (result.summary) {
        const verdict = typeof result.summary === "string" ? result.summary : result.summary.overallVerdict ?? "";
        state.addHistory({
          type: "action_applied",
          description: `Verification: ${verdict}`,
        });
      }
    } catch (err: any) {
      state.addInsight({
        type: "quality_issue",
        title: "Verification failed",
        detail: err.message || "Unknown error",
        proactive: false,
        actions: [{ label: "Dismiss", actionType: "dismiss" }],
      });
    }
    btn.disabled = false; btn.textContent = "Verify Document";
  });

  // Run Workflow button
  document.getElementById("btn-run-workflow")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-run-workflow") as HTMLButtonElement;
    btn.disabled = true; btn.textContent = "Running...";
    try {
      const { readFullDocument } = await import("./document-ops");
      const { runWorkflow } = await import("../../../shared/api-client");
      const docText = await readFullDocument();
      const result = await runWorkflow("review-sustainability-report", state.engagementId, { document: docText });
      state.addAction({
        description: "Workflow: Review Sustainability Report",
        targetHeading: "",
        kind: "insert",
        content: JSON.stringify(result.results || {}, null, 2),
      });
      state.switchTab("actions");
    } catch (err: any) {
      state.addInsight({
        type: "quality_issue",
        title: "Workflow failed",
        detail: err.message || "Unknown error",
        proactive: false,
        actions: [{ label: "Dismiss", actionType: "dismiss" }],
      });
    }
    btn.disabled = false; btn.textContent = "Run Workflow";
  });

  // Start @Merris polling
  startPolling(state);

  // Run initial perception
  runInitialPerception(state);
}

function setupTabSwitching(): void {
  const tabBar = document.getElementById("tab-bar")!;
  const tabs = tabBar.querySelectorAll<HTMLButtonElement>(".merris-tab");

  // Listen to state tab changes
  state.on("tab", () => {
    const active = state.activeTab;
    tabs.forEach(t => {
      const name = t.dataset.tab;
      t.classList.toggle("active", name === active);
    });
    document.querySelectorAll<HTMLElement>(".merris-tab-panel").forEach(p => {
      p.style.display = p.id === `tab-${active}` ? "block" : "none";
      p.classList.toggle("active", p.id === `tab-${active}`);
    });
  });

  // Click handlers
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      state.switchTab(tab.dataset.tab as any);
    });
  });

  // Badge updates
  state.on("badges", () => {
    tabs.forEach(t => {
      const name = t.dataset.tab as string;
      const count = state.badges[name as keyof typeof state.badges];
      let badge = t.querySelector(".tab-badge") as HTMLElement;
      if (count > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "tab-badge";
          t.appendChild(badge);
        }
        badge.textContent = count > 9 ? "9+" : String(count);
        badge.classList.remove("dot");
      } else if (badge) {
        badge.remove();
      }
    });
  });
}

function handleQuickInput(text: string): void {
  const cmdType = classifyCommand(text);

  if (cmdType === "EXPLAIN" || cmdType === "REVIEW") {
    state.switchTab("chat");
    chatTab.send(text);
  } else {
    state.switchTab("chat");
    chatTab.send(text);
  }
}
