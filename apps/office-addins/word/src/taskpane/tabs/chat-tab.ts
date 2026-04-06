// src/taskpane/tabs/chat-tab.ts

import { MerrisState } from "../state";
import { readFullDocument } from "../document-ops";
import { agentChat } from "../../../../shared/api-client";
import { classifyCommand } from "../merris-commands";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export class ChatTab {
  private container: HTMLElement;
  private state: MerrisState;
  private messagesEl!: HTMLElement;
  private inputEl!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;

  constructor(container: HTMLElement, state: MerrisState) {
    this.container = container;
    this.state = state;
    this.render();
    state.on("chat", () => this.renderMessages());
  }

  render(): void {
    this.container.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;">
        <div class="chat-messages" id="chat-messages"></div>
        <div style="display:flex;gap:6px;padding:8px 0 0;">
          <input type="text" class="merris-input" id="chat-input" placeholder="Ask Merris anything..." style="flex:1;font-size:12px;" />
          <button class="merris-btn merris-btn-primary" id="chat-send" style="font-size:11px;padding:6px 12px;">Send</button>
        </div>
      </div>
    `;

    this.messagesEl = document.getElementById("chat-messages")!;
    this.inputEl = document.getElementById("chat-input") as HTMLInputElement;
    this.sendBtn = document.getElementById("chat-send") as HTMLButtonElement;

    this.sendBtn.addEventListener("click", () => this.send());
    this.inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") this.send(); });

    this.renderMessages();
  }

  renderMessages(): void {
    if (!this.messagesEl) return;

    this.messagesEl.innerHTML = this.state.chatMessages.map(msg => `
      <div class="chat-msg chat-msg-${msg.role === "user" ? "user" : "assistant"}">
        ${escapeHtml(msg.content)}
        ${msg.routedTo ? `<div class="chat-routed-link" data-tab="${msg.routedTo}">Added to ${msg.routedTo === "actions" ? "Actions" : "Insights"} →</div>` : ""}
      </div>
    `).join("");

    // Wire routed links
    this.messagesEl.querySelectorAll<HTMLElement>(".chat-routed-link").forEach(link => {
      link.addEventListener("click", () => {
        const tab = link.dataset.tab as "insights" | "actions";
        this.state.switchTab(tab);
      });
    });

    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  async send(overrideText?: string): Promise<void> {
    const text = overrideText || this.inputEl.value.trim();
    if (!text) return;
    if (!overrideText) this.inputEl.value = "";

    this.state.addChatMessage({ role: "user", content: text });
    this.setLoading(true);

    try {
      const docText = await readFullDocument();
      const response = await agentChat({
        message: text,
        engagementId: this.state.engagementId,
        documentBody: docText,
        cursorSection: "",
      });

      const reply = response.reply || "";

      // Route response based on content classification
      const routedTo = this.routeResponse(text, reply);

      this.state.addChatMessage({ role: "assistant", content: reply, routedTo });
    } catch (err: any) {
      this.state.addChatMessage({ role: "assistant", content: `Error: ${err.message || "Unknown error"}` });
    }

    this.setLoading(false);
  }

  /** Determine if the response should be routed to another tab */
  private routeResponse(userMessage: string, response: string): "insights" | "actions" | undefined {
    const cmdType = classifyCommand(userMessage);

    if (cmdType === "REVIEW") {
      // Create insight card
      this.state.addInsight({
        type: "quality_issue",
        title: `Review: ${userMessage.substring(0, 50)}`,
        detail: response,
        proactive: false,
        actions: [{ label: "Dismiss", actionType: "dismiss" }],
      });
      return "insights";
    }

    if (cmdType === "WRITE" || cmdType === "EDIT" || cmdType === "INSERT_ARTIFACT") {
      // Create action card
      this.state.addAction({
        description: userMessage.substring(0, 80),
        targetHeading: "",
        kind: cmdType === "INSERT_ARTIFACT" ? "table" : cmdType === "EDIT" ? "replace" : "insert",
        content: response,
      });
      return "actions";
    }

    // EXPLAIN and REFERENCE stay in chat only
    return undefined;
  }

  private setLoading(loading: boolean): void {
    this.sendBtn.disabled = loading;
    this.inputEl.disabled = loading;
    this.sendBtn.textContent = loading ? "..." : "Send";
  }
}
