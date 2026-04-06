/**
 * Engagement Selector for Merris Office Add-ins.
 * Lets users link a document to an existing engagement, create a new one,
 * or use the agent for quick tasks without an engagement.
 */

import { api } from "./api-client";

export interface EngagementInfo {
  id: string;
  name: string;
  frameworks?: string[];
  status?: string;
  deadline?: string;
}

type Mode = "engagement" | "quick";

export class EngagementSelector {
  private container: HTMLElement;
  private engagements: EngagementInfo[] = [];
  private selectedId: string | null = null;
  private mode: Mode = "engagement";
  private onSelect: (engagement: EngagementInfo | null, mode: Mode) => void;

  constructor(options: {
    parentElement: HTMLElement;
    onSelect: (engagement: EngagementInfo | null, mode: Mode) => void;
  }) {
    this.onSelect = options.onSelect;

    this.container = document.createElement("div");
    this.container.className = "merris-engagement-selector";
    this.container.innerHTML = `
      <div class="merris-section">
        <h2>Link Document</h2>
        <p style="font-size:12px; color:var(--merris-text-secondary, #999); margin-bottom:12px;">
          Connect this document to an engagement for full ESG data access, or use Quick Mode for standalone questions.
        </p>
        <div id="engagement-list" class="merris-engagement-list">
          <div class="merris-loading"><span class="merris-spinner"></span> Loading engagements...</div>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          <button id="btn-quick-mode" class="merris-btn merris-btn-secondary" style="flex:1;">
            Quick Mode (no engagement)
          </button>
          <button id="btn-new-engagement" class="merris-btn merris-btn-secondary" style="flex:1;">
            + New Engagement
          </button>
        </div>
      </div>
    `;

    options.parentElement.appendChild(this.container);

    this.container.querySelector("#btn-quick-mode")!.addEventListener("click", () => {
      this.mode = "quick";
      this.selectedId = null;
      localStorage.removeItem("merris_engagement_id");
      this.onSelect(null, "quick");
    });

    this.container.querySelector("#btn-new-engagement")!.addEventListener("click", () => {
      this.showNewEngagementForm();
    });

    this.loadEngagements();
  }

  private async loadEngagements(): Promise<void> {
    const listEl = this.container.querySelector("#engagement-list")!;

    try {
      const data = await api.get<{ engagements: EngagementInfo[] } | EngagementInfo[]>(
        "/engagements"
      );
      this.engagements = Array.isArray(data) ? data : data.engagements || [];

      if (this.engagements.length === 0) {
        listEl.innerHTML = `
          <div class="merris-card" style="text-align:center; padding:16px;">
            <p style="color:var(--merris-text-secondary, #999);">No engagements found.</p>
            <p style="font-size:12px; color:var(--merris-text-secondary, #999);">Create one or use Quick Mode.</p>
          </div>
        `;
        return;
      }

      // Check if we have a previously selected engagement
      const storedId = localStorage.getItem("merris_engagement_id");

      listEl.innerHTML = this.engagements
        .map((eng) => {
          const isSelected = eng.id === storedId;
          const frameworks = (eng.frameworks || []).join(", ").toUpperCase() || "No frameworks";
          const statusBadge = eng.status
            ? `<span class="merris-badge">${eng.status}</span>`
            : "";
          return `
            <div class="merris-card merris-engagement-card ${isSelected ? "selected" : ""}"
                 data-id="${eng.id}"
                 style="cursor:pointer; margin-bottom:8px; padding:10px; border:1px solid ${isSelected ? "var(--merris-accent, #1a7a4c)" : "var(--merris-border, #333)"}; border-radius:6px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:13px;">${eng.name}</strong>
                ${statusBadge}
              </div>
              <div style="font-size:11px; color:var(--merris-text-secondary, #999); margin-top:4px;">
                ${frameworks}
              </div>
              ${eng.deadline ? `<div style="font-size:11px; color:var(--merris-text-secondary, #999);">Due: ${new Date(eng.deadline).toLocaleDateString()}</div>` : ""}
            </div>
          `;
        })
        .join("");

      // Add click handlers
      listEl.querySelectorAll(".merris-engagement-card").forEach((card) => {
        card.addEventListener("click", () => {
          const id = (card as HTMLElement).dataset.id!;
          this.selectEngagement(id);
        });
      });

      // Auto-select if previously stored
      if (storedId && this.engagements.find((e) => e.id === storedId)) {
        this.selectEngagement(storedId);
      }
    } catch (err: any) {
      listEl.innerHTML = `
        <div class="merris-card" style="padding:12px; color:#ef4444;">
          Failed to load engagements: ${err.message || "Unknown error"}
        </div>
      `;
    }
  }

  private selectEngagement(id: string): void {
    this.selectedId = id;
    this.mode = "engagement";
    localStorage.setItem("merris_engagement_id", id);

    // Update visual selection
    this.container.querySelectorAll(".merris-engagement-card").forEach((card) => {
      const cardEl = card as HTMLElement;
      if (cardEl.dataset.id === id) {
        cardEl.style.borderColor = "var(--merris-accent, #1a7a4c)";
        cardEl.classList.add("selected");
      } else {
        cardEl.style.borderColor = "var(--merris-border, #333)";
        cardEl.classList.remove("selected");
      }
    });

    const eng = this.engagements.find((e) => e.id === id)!;
    this.onSelect(eng, "engagement");
  }

  private showNewEngagementForm(): void {
    const listEl = this.container.querySelector("#engagement-list")!;
    listEl.innerHTML = `
      <div class="merris-card" style="padding:12px;">
        <div style="margin-bottom:8px;">
          <label style="font-size:12px; color:var(--merris-text-secondary, #999);">Engagement Name</label>
          <input id="new-eng-name" type="text" class="merris-input" placeholder="e.g., QAPCO ESG Report 2026" style="width:100%; margin-top:4px;" />
        </div>
        <div style="margin-bottom:8px;">
          <label style="font-size:12px; color:var(--merris-text-secondary, #999);">Frameworks (comma-separated)</label>
          <input id="new-eng-frameworks" type="text" class="merris-input" placeholder="e.g., gri, tcfd, qse" style="width:100%; margin-top:4px;" />
        </div>
        <div style="display:flex; gap:8px;">
          <button id="btn-create-eng" class="merris-btn merris-btn-primary" style="flex:1;">Create</button>
          <button id="btn-cancel-eng" class="merris-btn merris-btn-secondary" style="flex:1;">Cancel</button>
        </div>
      </div>
    `;

    this.container.querySelector("#btn-cancel-eng")!.addEventListener("click", () => {
      this.loadEngagements();
    });

    this.container.querySelector("#btn-create-eng")!.addEventListener("click", async () => {
      const name = (this.container.querySelector("#new-eng-name") as HTMLInputElement).value.trim();
      const frameworks = (this.container.querySelector("#new-eng-frameworks") as HTMLInputElement).value
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      if (!name) return;

      try {
        // For now, show as created and reload
        const createBtn = this.container.querySelector("#btn-create-eng") as HTMLButtonElement;
        createBtn.disabled = true;
        createBtn.innerHTML = '<span class="merris-spinner"></span>';

        // Try to create via API (may not exist yet — stub)
        try {
          await api.post("/engagements", {
            name,
            frameworks,
            scope: { reportingPeriod: { start: new Date().toISOString(), end: new Date().toISOString() }, reportType: "sustainability_report" },
            status: "setup",
          });
        } catch {
          // API might not have create endpoint — that's ok for now
        }

        await this.loadEngagements();
      } catch {
        await this.loadEngagements();
      }
    });
  }

  hide(): void {
    this.container.style.display = "none";
  }

  show(): void {
    this.container.style.display = "block";
    this.loadEngagements();
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  getMode(): Mode {
    return this.mode;
  }
}
