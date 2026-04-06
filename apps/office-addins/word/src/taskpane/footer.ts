// src/taskpane/footer.ts

import { MerrisState } from "./state";

export class MerrisFooter {
  private container: HTMLElement;
  private state: MerrisState;
  private onQuickInput: (text: string) => void;

  constructor(container: HTMLElement, state: MerrisState, onQuickInput: (text: string) => void) {
    this.container = container;
    this.state = state;
    this.onQuickInput = onQuickInput;
    this.render();

    state.on("score", () => this.updateStats());
    state.on("actions", () => this.updateStats());
    state.on("insights", () => this.updateStats());
    state.on("badges", () => this.updateStats());
  }

  render(): void {
    this.container.innerHTML = `
      <div class="merris-footer-stats" id="footer-stats"></div>
      <div class="merris-footer-input">
        <input type="text" id="footer-input" placeholder="Ask Merris..." />
      </div>
    `;

    this.updateStats();

    const input = document.getElementById("footer-input") as HTMLInputElement;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const text = input.value.trim();
        if (text) {
          input.value = "";
          this.onQuickInput(text);
        }
      }
    });
  }

  updateStats(): void {
    const el = document.getElementById("footer-stats");
    if (!el) return;

    const score = this.state.overallScore;
    const scoreColor = score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : score >= 0 ? "#ef4444" : "#999";
    const pendingCount = this.state.pendingActions.length;
    const newInsights = this.state.badges.insights;

    el.innerHTML = `
      <span class="merris-footer-score" style="color:${scoreColor};">${score >= 0 ? score + "/100" : "--"}</span>
      <span class="stat-clickable" data-tab="actions">${pendingCount} action${pendingCount !== 1 ? "s" : ""}</span>
      <span class="stat-clickable" data-tab="insights">${newInsights > 0 ? newInsights + " new insight" + (newInsights !== 1 ? "s" : "") : "insights"}</span>
      <label class="proactive-toggle">
        <input type="checkbox" id="proactive-toggle" ${this.state.proactiveEnabled ? "checked" : ""} style="margin:0;" />
        Auto
      </label>
    `;

    // Clickable stats
    el.querySelectorAll<HTMLElement>(".stat-clickable").forEach(s => {
      s.addEventListener("click", () => {
        const tab = s.dataset.tab as "insights" | "actions";
        this.state.switchTab(tab);
      });
    });

    // Proactive toggle
    document.getElementById("proactive-toggle")?.addEventListener("change", (e) => {
      this.state.proactiveEnabled = (e.target as HTMLInputElement).checked;
    });
  }
}
