/**
 * Shared ESG Agent chat panel for Merris Office Add-ins.
 * Embeds an inline AI assistant into any add-in taskpane.
 */

import { agentChat, AgentChatResponse } from "./api-client";

interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DocumentContext {
  documentBody: string;
  cursorSection: string;
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
  private getDocumentContext?: () => Promise<DocumentContext | null>;

  constructor(options: {
    parentElement: HTMLElement;
    context?: Record<string, unknown>;
    onAction?: (action: { type: string; payload: Record<string, unknown> }) => void;
    getDocumentContext?: () => Promise<DocumentContext | null>;
  }) {
    this.context = options.context || {};
    this.onAction = options.onAction;
    this.getDocumentContext = options.getDocumentContext;

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

  async send(overrideText?: string): Promise<void> {
    const text = overrideText || this.inputEl.value.trim();
    if (!text) return;

    if (!overrideText) this.inputEl.value = "";
    this.addMessage({ role: "user", content: text });
    this.setLoading(true);

    try {
      // Read document context if available
      let documentBody: string | undefined;
      let cursorSection: string | undefined;

      if (this.getDocumentContext) {
        try {
          const docCtx = await this.getDocumentContext();
          if (docCtx) {
            documentBody = docCtx.documentBody;
            cursorSection = docCtx.cursorSection;
          }
        } catch {
          // Non-critical — send without document context
        }
      }

      const response: AgentChatResponse = await agentChat({
        message: text,
        context: this.context,
        session_id: this.sessionId,
        documentBody,
        cursorSection,
      });

      this.sessionId = response.session_id;
      this.addMessage({ role: "assistant", content: response.reply });

      if (response.actions && this.onAction) {
        for (const action of response.actions) {
          this.onAction(action);
        }
      }

      // Auto-detect draft content: if user asked to "draft" and response is substantial,
      // offer to insert into document
      const isDraftRequest = /\b(draft|write|generate|create)\b.*\b(section|disclosure|content)\b/i.test(text);
      if (isDraftRequest && response.reply && response.reply.length > 200 && this.onAction) {
        // Add an insert button to the message
        const lastMsg = this.messagesEl.lastElementChild;
        if (lastMsg) {
          const insertBtn = document.createElement("button");
          insertBtn.className = "merris-btn merris-btn-primary";
          insertBtn.style.cssText = "margin-top:8px;font-size:11px;padding:4px 10px;";
          insertBtn.textContent = "Insert into document";
          insertBtn.addEventListener("click", () => {
            if (this.onAction) {
              // Uses reliable Word.js pattern: paragraph.clear() + insertText with \r
              this.onAction({ type: "insert_content", payload: { text: response.reply } });
            }
            insertBtn.textContent = "Inserted";
            insertBtn.disabled = true;
          });
          lastMsg.appendChild(insertBtn);
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

  /** Add a message to the chat panel (public for @Merris EXPLAIN commands) */
  addMessage(roleOrMsg: string | AgentMessage, content?: string): void {
    const msg: AgentMessage = typeof roleOrMsg === "string"
      ? { role: roleOrMsg as "user" | "assistant", content: content || "" }
      : roleOrMsg;
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
