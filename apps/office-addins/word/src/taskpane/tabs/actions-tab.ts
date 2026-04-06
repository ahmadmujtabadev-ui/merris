// src/taskpane/tabs/actions-tab.ts

import { MerrisState, ActionCard } from "../state";
import * as docOps from "../document-ops";
import { agentChat } from "../../../../shared/api-client";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export class ActionsTab {
  private container: HTMLElement;
  private state: MerrisState;

  constructor(container: HTMLElement, state: MerrisState) {
    this.container = container;
    this.state = state;
    this.render();
    state.on("actions", () => this.render());
  }

  render(): void {
    const pending = this.state.pendingActions;
    const applied = this.state.appliedActions;

    this.container.innerHTML = `
      ${pending.length > 0 ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:600;">${pending.length} pending</span>
          <div style="display:flex;gap:4px;">
            <button class="merris-btn merris-btn-primary" id="btn-apply-all" style="font-size:10px;padding:4px 8px;">Apply All</button>
            <button class="merris-btn merris-btn-secondary" id="btn-clear-queue" style="font-size:10px;padding:4px 8px;">Clear</button>
          </div>
        </div>
      ` : ""}
      <div id="actions-pending">
        ${pending.length === 0 ? '<div style="font-size:11px;color:var(--merris-text-secondary);padding:16px 0;text-align:center;">No pending actions. Use @merris or chat to generate changes.</div>' : ""}
        ${pending.map(a => this.renderActionCard(a)).join("")}
      </div>
      ${applied.length > 0 ? `
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--merris-text-secondary);margin:12px 0 6px;">Applied</div>
        ${applied.map(a => this.renderActionCard(a)).join("")}
      ` : ""}
    `;

    this.wireHandlers();
  }

  private renderActionCard(action: ActionCard): string {
    const isApplied = action.status === "applied";
    const isSkipped = action.status === "skipped";
    const isPreviewing = action.status === "previewing";

    return `
      <div class="merris-action-card ${isApplied ? "applied" : ""} ${isSkipped ? "skipped" : ""}" data-id="${action.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="flex:1;">
            <div style="font-weight:600;color:var(--merris-text);">${escapeHtml(action.description)}</div>
            ${action.targetHeading ? `<div style="font-size:10px;color:var(--merris-text-secondary);margin-top:2px;">→ ${escapeHtml(action.targetHeading)}</div>` : ""}
          </div>
          <span style="font-size:9px;padding:2px 6px;border-radius:3px;background:var(--merris-bg-secondary);color:var(--merris-text-secondary);">${action.status}</span>
        </div>
        ${isPreviewing && action.content ? `
          ${action.beforeText ? `
            <div class="action-diff-before" style="margin-top:8px;font-size:10px;color:var(--merris-text-secondary);">
              <div style="font-weight:600;color:#ef4444;font-size:9px;margin-bottom:2px;">BEFORE</div>
              ${escapeHtml(action.beforeText.substring(0, 300))}${action.beforeText.length > 300 ? "..." : ""}
            </div>
            <div class="action-diff-after" style="font-size:10px;">
              <div style="font-weight:600;color:#22c55e;font-size:9px;margin-bottom:2px;">AFTER</div>
              ${escapeHtml(action.content.substring(0, 300))}${action.content.length > 300 ? "..." : ""}
            </div>
          ` : `
            <div class="action-preview">${escapeHtml(action.content)}</div>
          `}
        ` : ""}
        ${!isApplied && !isSkipped ? `
          <div class="action-buttons">
            ${!isPreviewing ? `<button class="merris-btn merris-btn-secondary action-btn" data-id="${action.id}" data-action="preview" style="font-size:10px;padding:3px 8px;">Preview</button>` : ""}
            <button class="merris-btn merris-btn-primary action-btn" data-id="${action.id}" data-action="apply" style="font-size:10px;padding:3px 8px;">Apply</button>
            <button class="merris-btn merris-btn-secondary action-btn" data-id="${action.id}" data-action="revise" style="font-size:10px;padding:3px 8px;">Revise</button>
            <button class="merris-btn merris-btn-secondary action-btn" data-id="${action.id}" data-action="skip" style="font-size:10px;padding:3px 8px;">Skip</button>
          </div>
        ` : ""}
      </div>
    `;
  }

  private wireHandlers(): void {
    // Per-action buttons
    this.container.querySelectorAll<HTMLButtonElement>(".action-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id!;
        const action = btn.dataset.action!;
        btn.disabled = true;
        await this.handleAction(id, action);
      });
    });

    // Apply All
    document.getElementById("btn-apply-all")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-apply-all") as HTMLButtonElement;
      if (btn) { btn.disabled = true; btn.textContent = "Applying..."; }
      for (const a of this.state.pendingActions) {
        await this.applyAction(a);
      }
      this.render();
    });

    // Clear Queue
    document.getElementById("btn-clear-queue")?.addEventListener("click", () => {
      for (const a of this.state.pendingActions) {
        this.state.updateAction(a.id, { status: "skipped" });
      }
    });
  }

  private async handleAction(id: string, action: string): Promise<void> {
    const card = this.state.actions.find(a => a.id === id);
    if (!card) return;

    switch (action) {
      case "preview":
        await this.previewAction(card);
        break;
      case "apply":
        await this.applyAction(card);
        break;
      case "revise":
        this.showReviseInput(card);
        break;
      case "skip":
        this.state.updateAction(id, { status: "skipped" });
        this.state.addHistory({ type: "action_applied", description: `Skipped: ${card.description}` });
        break;
    }
  }

  private async previewAction(card: ActionCard): Promise<void> {
    // If content is empty, generate it now
    if (!card.content) {
      this.state.updateAction(card.id, { status: "previewing" });
      // Trigger generation
      const docText = await docOps.readFullDocument();
      const response = await agentChat({
        message: card.description,
        engagementId: this.state.engagementId,
        documentBody: docText,
        cursorSection: card.targetHeading,
      });
      this.state.updateAction(card.id, { content: response.reply || "", status: "previewing" });
    } else {
      this.state.updateAction(card.id, { status: "previewing" });
    }
  }

  async applyAction(card: ActionCard): Promise<void> {
    // Generate content if not yet generated
    if (!card.content) {
      const docText = await docOps.readFullDocument();
      const response = await agentChat({
        message: card.description,
        engagementId: this.state.engagementId,
        documentBody: docText,
        cursorSection: card.targetHeading,
      });
      card.content = response.reply || "";
    }

    let success = false;
    switch (card.kind) {
      case "insert":
        // Find heading, insert after it
        if (card.targetHeading) {
          success = await docOps.insertAfterIndex(
            await findHeadingIndex(card.targetHeading), card.content
          );
        }
        if (!success) {
          // Fallback: insert at end
          await docOps.insertAfterIndex(-1, card.content).catch(() => {});
        }
        break;

      case "replace":
        if (card.beforeText) {
          await docOps.replaceParagraphText(card.beforeText.substring(0, 50), card.content);
        }
        break;

      case "table": {
        const tableData = parseMarkdownTable(card.content);
        if (tableData && card.targetHeading) {
          // Insert a marker paragraph after heading, then replace with table
          const idx = await findHeadingIndex(card.targetHeading);
          await docOps.insertAfterIndex(idx, "[TABLE_MARKER]");
          await docOps.insertTableAfter("[TABLE_MARKER]", tableData);
        }
        break;
      }

      case "comment":
        if (card.targetHeading) {
          const paras = await docOps.readAllParagraphs();
          // Find first content paragraph under the heading
          let targetText = "";
          let found = false;
          for (const p of paras) {
            if (found && p.text.trim() && !docOps.isHeading(p.text, p.style)) {
              targetText = p.text;
              break;
            }
            if (p.text.trim() === card.targetHeading) found = true;
          }
          if (targetText) {
            await docOps.insertCommentOn(targetText, card.content);
          }
        }
        break;

      case "reference":
        if (card.targetHeading) {
          const idx = await findHeadingIndex(card.targetHeading);
          await docOps.insertAfterIndex(idx, card.content);
        }
        break;
    }

    this.state.updateAction(card.id, { status: "applied", appliedAt: Date.now() });
    this.state.addHistory({ type: "action_applied", description: `Applied: ${card.description}` });
  }

  private showReviseInput(card: ActionCard): void {
    const cardEl = this.container.querySelector(`[data-id="${card.id}"]`);
    if (!cardEl) return;

    const existing = cardEl.querySelector(".revise-input-area");
    if (existing) { existing.remove(); return; }

    const div = document.createElement("div");
    div.className = "revise-input-area";
    div.style.cssText = "margin-top:6px;display:flex;gap:4px;";
    div.innerHTML = `
      <input type="text" class="merris-input" placeholder="How should I change this?" style="flex:1;font-size:11px;padding:4px 8px;" />
      <button class="merris-btn merris-btn-primary" style="font-size:10px;padding:4px 8px;">Send</button>
    `;
    cardEl.appendChild(div);

    const input = div.querySelector("input")!;
    const btn = div.querySelector("button")!;

    const submit = async () => {
      const feedback = input.value.trim();
      if (!feedback) return;
      btn.disabled = true;
      btn.textContent = "...";

      const docText = await docOps.readFullDocument();
      const response = await agentChat({
        message: `Revise this action: "${card.description}". User feedback: ${feedback}. Previous content:\n${card.content}`,
        engagementId: this.state.engagementId,
        documentBody: docText,
        cursorSection: card.targetHeading,
      });
      this.state.updateAction(card.id, { content: response.reply || "", status: "previewing" });
    };

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    input.focus();
  }
}

// ---- Helpers ----

async function findHeadingIndex(heading: string): Promise<number> {
  const paras = await docOps.readAllParagraphs();
  for (const p of paras) {
    if (p.text.trim() === heading) return p.index;
  }
  return paras.length - 1; // fallback to end
}

function parseMarkdownTable(text: string): string[][] | null {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.startsWith("|"));
  if (lines.length < 2) return null;
  const rows: string[][] = [];
  for (const line of lines) {
    const cells = line.split("|").map(c => c.trim()).filter(c => c !== "");
    if (cells.every(c => /^[-:]+$/.test(c))) continue;
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length < 2) return null;
  const maxCols = Math.max(...rows.map(r => r.length));
  return rows.map(r => { while (r.length < maxCols) r.push(""); return r.slice(0, maxCols); });
}
