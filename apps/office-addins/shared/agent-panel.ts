/**
 * Shared ESG Agent chat panel for Merris Office Add-ins.
 * Embeds an inline AI assistant into any add-in taskpane.
 */

import { agentChat, AgentChatResponse } from "./api-client";

interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export class AgentPanel {
  private container: HTMLElement;
  private messagesEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private sendBtn: HTMLButtonElement;
  private messages: AgentMessage[] = [];
  private sessionId: string | undefined;
  private context: Record<string, unknown>;
  private onAction?: (action: { type: string; payload: Record<string, unknown> }) => void;

  constructor(options: {
    parentElement: HTMLElement;
    context?: Record<string, unknown>;
    onAction?: (action: { type: string; payload: Record<string, unknown> }) => void;
  }) {
    this.context = options.context || {};
    this.onAction = options.onAction;

    this.container = document.createElement("div");
    this.container.className = "merris-agent-panel";
    this.container.innerHTML = `
      <h2>ESG Agent</h2>
      <div class="merris-agent-messages"></div>
      <div class="merris-agent-input">
        <input type="text" class="merris-input" placeholder="Ask the ESG Agent..." />
        <button class="merris-btn merris-btn-primary">Send</button>
      </div>
    `;

    this.messagesEl = this.container.querySelector(".merris-agent-messages")!;
    this.inputEl = this.container.querySelector("input")!;
    this.sendBtn = this.container.querySelector("button")!;

    this.sendBtn.addEventListener("click", () => this.send());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.send();
    });

    options.parentElement.appendChild(this.container);
  }

  updateContext(ctx: Record<string, unknown>): void {
    this.context = { ...this.context, ...ctx };
  }

  private async send(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.inputEl.value = "";
    this.addMessage({ role: "user", content: text });
    this.setLoading(true);

    try {
      const response: AgentChatResponse = await agentChat({
        message: text,
        context: this.context,
        session_id: this.sessionId,
      });

      this.sessionId = response.session_id;
      this.addMessage({ role: "assistant", content: response.reply });

      if (response.actions && this.onAction) {
        for (const action of response.actions) {
          this.onAction(action);
        }
      }
    } catch (err: any) {
      this.addMessage({
        role: "assistant",
        content: `Error: ${err.message || "Failed to reach ESG Agent"}`,
      });
    } finally {
      this.setLoading(false);
    }
  }

  private addMessage(msg: AgentMessage): void {
    this.messages.push(msg);
    const el = document.createElement("div");
    el.className = `merris-agent-msg merris-agent-msg-${msg.role === "user" ? "user" : "bot"}`;
    el.textContent = msg.content;
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private setLoading(loading: boolean): void {
    this.sendBtn.disabled = loading;
    this.inputEl.disabled = loading;
    if (loading) {
      this.sendBtn.innerHTML = '<span class="merris-spinner"></span>';
    } else {
      this.sendBtn.textContent = "Send";
    }
  }
}
