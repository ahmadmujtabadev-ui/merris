// src/taskpane/tabs/insights-tab.ts

import { MerrisState, InsightCard, SectionInfo } from "../state";
import { scrollToHeading } from "../document-ops";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export class InsightsTab {
  private container: HTMLElement;
  private state: MerrisState;

  constructor(container: HTMLElement, state: MerrisState) {
    this.container = container;
    this.state = state;
    this.render();

    state.on("insights", () => this.renderInsightCards());
    state.on("score", () => this.renderHeader());
    state.on("sections", () => this.renderSectionMap());
  }

  render(): void {
    this.container.innerHTML = `
      <div id="insights-header"></div>
      <div id="insights-review-buttons" style="display:flex;gap:4px;margin:8px 0;">
        <button class="merris-btn merris-btn-primary" id="btn-quick-review" style="flex:1;font-size:10px;padding:5px;">Quick Review</button>
        <button class="merris-btn merris-btn-secondary" id="btn-full-review" style="flex:1;font-size:10px;padding:5px;">Full Review</button>
        <button class="merris-btn merris-btn-secondary" id="btn-partner-sim" style="flex:1;font-size:10px;padding:5px;">Partner Sim</button>
      </div>
      <div style="display:flex;gap:4px;margin:4px 0 8px;">
        <button class="merris-btn merris-btn-primary" id="btn-verify-doc" style="flex:1;font-size:10px;padding:5px;">Verify Document</button>
        <button class="merris-btn merris-btn-secondary" id="btn-run-workflow" style="flex:1;font-size:10px;padding:5px;">Run Workflow</button>
      </div>
      <div id="insights-section-map" style="margin-bottom:10px;"></div>
      <div id="insights-cards"></div>
    `;

    this.renderHeader();
    this.renderSectionMap();
    this.renderInsightCards();
  }

  renderHeader(): void {
    const el = document.getElementById("insights-header");
    if (!el) return;

    const score = this.state.overallScore;
    const scoreColor = score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : score >= 0 ? "#ef4444" : "#999";
    const deadline = this.state.deadlineDays;
    const deadlineText = deadline !== null ? `${deadline}d to deadline` : "";

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--merris-text);">${escapeHtml(this.state.documentTitle || "Document")}</div>
          <div style="font-size:11px;color:var(--merris-text-secondary);">${escapeHtml(this.state.engagementName)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:22px;font-weight:700;color:${scoreColor};">${score >= 0 ? score + "/100" : "--"}</div>
          ${deadlineText ? `<div style="font-size:10px;color:var(--merris-text-secondary);">${deadlineText}</div>` : ""}
        </div>
      </div>
      ${score >= 0 ? `<div style="height:4px;background:var(--merris-border);border-radius:2px;margin-bottom:8px;">
        <div style="height:100%;width:${score}%;background:${scoreColor};border-radius:2px;"></div>
      </div>` : ""}
    `;
  }

  renderSectionMap(): void {
    const el = document.getElementById("insights-section-map");
    if (!el) return;

    if (this.state.sections.length === 0) {
      el.innerHTML = `<div style="font-size:11px;color:var(--merris-text-secondary);padding:8px 0;">Analyzing document structure...</div>`;
      return;
    }

    const statusIcon = (s: SectionInfo["status"]) => {
      switch (s) {
        case "drafted": return '<span style="color:#22c55e;">✓</span>';
        case "placeholder": return '<span style="color:#f59e0b;">!</span>';
        case "empty": return '<span style="color:#999;">○</span>';
        case "data_only": return '<span style="color:#3b82f6;">◆</span>';
      }
    };

    el.innerHTML = `
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--merris-text-secondary);margin-bottom:4px;">Sections</div>
      <div style="max-height:180px;overflow-y:auto;">
        ${this.state.sections.map(s => {
          const scoreColor = s.score >= 75 ? "#22c55e" : s.score >= 50 ? "#eab308" : s.score >= 0 ? "#ef4444" : "#999";
          return `
            <div class="section-map-item" data-heading="${escapeHtml(s.heading)}">
              <span class="section-map-status">${statusIcon(s.status)}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.heading)}</span>
              ${s.framework ? `<span style="font-size:9px;color:var(--merris-text-secondary);">${s.framework}</span>` : ""}
              <span class="section-map-score" style="color:${scoreColor};">${s.score >= 0 ? s.score : "--"}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;

    el.querySelectorAll<HTMLElement>(".section-map-item").forEach(item => {
      item.addEventListener("click", () => {
        const heading = item.dataset.heading;
        if (heading) scrollToHeading(heading);
      });
    });
  }

  renderInsightCards(): void {
    const el = document.getElementById("insights-cards");
    if (!el) return;

    const active = this.state.activeInsights;
    if (active.length === 0) {
      el.innerHTML = `<div style="font-size:11px;color:var(--merris-text-secondary);padding:16px 0;text-align:center;">No insights yet. Run a review or start editing.</div>`;
      return;
    }

    el.innerHTML = active.map(card => `
      <div class="merris-insight-card ${card.resolved ? "resolved" : ""}" data-type="${card.type}" data-id="${card.id}">
        ${card.proactive ? '<div class="insight-label">Suggested</div>' : ""}
        <div class="insight-title">${escapeHtml(card.title)}</div>
        <div class="insight-detail">${escapeHtml(card.detail)}</div>
        ${card.actions.length > 0 ? `
          <div class="insight-actions">
            ${card.actions.map(a => `
              <button class="merris-btn merris-btn-${a.actionType === "dismiss" ? "secondary" : "primary"} insight-action-btn"
                      data-card-id="${card.id}" data-action="${a.actionType}"
                      style="font-size:10px;padding:3px 8px;">${escapeHtml(a.label)}</button>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `).join("");

    el.querySelectorAll<HTMLElement>(".merris-insight-card").forEach(cardEl => {
      cardEl.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".insight-action-btn")) return;
        cardEl.classList.toggle("collapsed");
      });
    });

    el.querySelectorAll<HTMLButtonElement>(".insight-action-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const cardId = btn.dataset.cardId!;
        const action = btn.dataset.action!;
        this.handleInsightAction(cardId, action);
      });
    });
  }

  private handleInsightAction(cardId: string, action: string): void {
    const card = this.state.insights.find(c => c.id === cardId);
    if (!card) return;

    if (action === "dismiss") {
      this.state.dismissInsight(cardId);
      return;
    }

    let description = "";
    let kind: "insert" | "replace" = "insert";
    switch (action) {
      case "fix":
        description = `Fix: ${card.title}`;
        kind = "replace";
        break;
      case "draft":
        description = `Draft section for: ${card.title}`;
        kind = "insert";
        break;
      case "request_data":
        description = `Request data: ${card.title}`;
        kind = "insert";
        break;
    }

    this.state.addAction({
      description,
      targetHeading: card.sectionRef || "",
      kind,
      content: "",
    });

    this.state.switchTab("actions");
  }
}
