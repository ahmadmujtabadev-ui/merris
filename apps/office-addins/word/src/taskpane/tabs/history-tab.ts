// src/taskpane/tabs/history-tab.ts

import { MerrisState } from "../state";
import { readFullDocument } from "../document-ops";
import { agentChat } from "../../../../shared/api-client";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export class HistoryTab {
  private container: HTMLElement;
  private state: MerrisState;

  constructor(container: HTMLElement, state: MerrisState) {
    this.container = container;
    this.state = state;
    this.render();
    state.on("history", () => this.renderEntries());
  }

  render(): void {
    this.container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:600;">Activity Log</span>
        <button class="merris-btn merris-btn-secondary" id="btn-catch-me-up" style="font-size:10px;padding:4px 8px;">Catch me up</button>
      </div>
      <div id="catch-me-up-result"></div>
      <div id="history-entries"></div>
    `;

    document.getElementById("btn-catch-me-up")?.addEventListener("click", () => this.catchMeUp());

    this.renderEntries();
  }

  renderEntries(): void {
    const el = document.getElementById("history-entries");
    if (!el) return;

    if (this.state.history.length === 0) {
      el.innerHTML = `<div style="font-size:11px;color:var(--merris-text-secondary);padding:16px 0;text-align:center;">No activity yet.</div>`;
      return;
    }

    const typeIcon: Record<string, string> = {
      action_applied: "✓",
      insight_dismissed: "×",
      chat_summary: "💬",
      score_change: "↑",
      team_activity: "👤",
      decision: "◆",
    };

    el.innerHTML = this.state.history.map(entry => `
      <div class="history-entry">
        <span class="history-time">${formatTime(entry.timestamp)}</span>
        <span style="width:16px;text-align:center;">${typeIcon[entry.type] || "·"}</span>
        <span class="history-desc">${escapeHtml(entry.description)}</span>
      </div>
    `).join("");
  }

  private async catchMeUp(): Promise<void> {
    const resultEl = document.getElementById("catch-me-up-result");
    const btn = document.getElementById("btn-catch-me-up") as HTMLButtonElement;
    if (!resultEl || !btn) return;

    btn.disabled = true;
    btn.textContent = "Loading...";
    resultEl.innerHTML = `<div class="merris-loading"><span class="merris-spinner"></span> Summarizing...</div>`;

    try {
      const historyText = this.state.history
        .slice(0, 50)
        .map(h => `[${formatTime(h.timestamp)}] ${h.type}: ${h.description}`)
        .join("\n");

      const docText = await readFullDocument();

      const response = await agentChat({
        message: `Summarize what has happened in this editing session. Be concise and actionable. Focus on what changed, what's left to do, and any decisions made.\n\nActivity log:\n${historyText}\n\nCurrent score: ${this.state.overallScore}/100`,
        engagementId: this.state.engagementId,
        documentBody: docText,
      });

      resultEl.innerHTML = `
        <div style="background:var(--merris-bg-secondary);border-radius:var(--merris-radius);padding:10px;margin-bottom:10px;font-size:11px;line-height:1.5;color:var(--merris-text);">
          ${escapeHtml(response.reply || "No summary available.")}
        </div>
      `;
    } catch {
      resultEl.innerHTML = `<div style="color:var(--merris-error);font-size:11px;">Could not generate summary.</div>`;
    }

    btn.disabled = false;
    btn.textContent = "Catch me up";
  }
}
