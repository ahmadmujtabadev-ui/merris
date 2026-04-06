# Word Add-in 4-Tab Sidebar Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-panel Word add-in sidebar with a 4-tab architecture (Insights, Actions, Chat, History) with persistent footer, action queue, and proactive analysis.

**Architecture:** Complete rewrite of `taskpane.html` and `taskpane.ts`. The taskpane becomes a tab-based SPA with a state manager (`MerrisState`) coordinating data flow between tabs. @Merris commands route to either Insights (REVIEW) or Actions (WRITE/EDIT/TABLE) tabs instead of directly modifying the document. All document modifications go through the Actions tab with explicit user approval via [Apply].

**Tech Stack:** TypeScript, Office.js (Word API), vanilla DOM manipulation, CSS custom properties, webpack 5.

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `src/taskpane/state.ts` | Central state manager — insights, actions, history, scores, badges. Event emitter for tab updates. |
| `src/taskpane/tabs/insights-tab.ts` | Insights tab — section map, insight cards, review buttons, score display. |
| `src/taskpane/tabs/actions-tab.ts` | Actions tab — action queue, preview/apply/revise/skip, batch operations. |
| `src/taskpane/tabs/chat-tab.ts` | Chat tab — conversational UI, response routing to Insights/Actions. |
| `src/taskpane/tabs/history-tab.ts` | History tab — chronological log, catch-me-up, score timeline. |
| `src/taskpane/footer.ts` | Persistent footer — score, counts, quick input bar. |
| `src/taskpane/merris-commands.ts` | @Merris polling, detection, classification, routing to tabs. |
| `src/taskpane/document-ops.ts` | All Word.js document operations — read, insert, replace, comment, table. |
| `src/taskpane/perception.ts` | Perception engine — auto-analysis, periodic re-perception, insight generation. |

### Files to Modify

| File | Changes |
|------|---------|
| `src/taskpane/taskpane.html` | Complete HTML rewrite — 4-tab shell, footer, no content panels. |
| `src/taskpane/taskpane.ts` | Slim orchestrator — Office.onReady, engagement selection, module init. |
| `../shared/styles.css` | Add tab, footer, card, badge styles. Keep existing variables. |

### Files Unchanged

| File | Reason |
|------|--------|
| `../shared/api-client.ts` | API layer stays the same. |
| `../shared/auth.ts` | Auth flow stays the same. |
| `../shared/engagement-selector.ts` | Engagement selection UI stays the same. |
| `../shared/agent-panel.ts` | Replaced by chat-tab.ts — but kept for commands.ts backward compat. |
| `src/commands/commands.ts` | Ribbon commands stay the same. |
| `webpack.config.js` | No changes needed — ts-loader handles new files. |
| `manifest.xml` | No changes needed. |

---

## Task 1: State Manager (`state.ts`)

**Files:**
- Create: `src/taskpane/state.ts`

The state manager holds all data and notifies tabs when things change. No DOM manipulation here — pure data and events.

- [ ] **Step 1: Create `src/taskpane/state.ts`**

```typescript
// src/taskpane/state.ts

// ---- Types ----

export interface SectionInfo {
  heading: string;
  framework: string;
  score: number;        // 0-100, -1 = not scored
  status: "drafted" | "placeholder" | "empty" | "data_only";
  wordCount: number;
  figureCount: number;
}

export interface InsightCard {
  id: string;
  type: "data_issue" | "compliance_gap" | "peer_benchmark" | "regulatory_context" | "quality_issue";
  title: string;
  detail: string;
  sectionRef?: string;     // heading this relates to
  actions: InsightAction[];
  dismissed: boolean;
  resolved: boolean;
  proactive: boolean;      // true if auto-generated
  createdAt: number;
}

export interface InsightAction {
  label: string;           // "Fix this", "Draft section", "Request data", "Dismiss"
  actionType: "fix" | "draft" | "request_data" | "dismiss";
}

export type ActionStatus = "pending" | "previewing" | "applied" | "skipped";
export type ActionKind = "insert" | "replace" | "table" | "comment" | "reference";

export interface ActionCard {
  id: string;
  description: string;
  targetHeading: string;
  kind: ActionKind;
  content: string;          // the text/table to insert
  beforeText?: string;      // for replace actions, the original text
  status: ActionStatus;
  createdAt: number;
  appliedAt?: number;
}

export interface HistoryEntry {
  id: string;
  type: "action_applied" | "insight_dismissed" | "chat_summary" | "score_change" | "team_activity" | "decision";
  description: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  routedTo?: "insights" | "actions";  // if response was routed to another tab
}

export type TabName = "insights" | "actions" | "chat" | "history";

type Listener = () => void;

// ---- State Manager ----

export class MerrisState {
  // Document & engagement
  documentTitle = "";
  engagementName = "";
  engagementId = "";
  overallScore = -1;           // -1 = not scored yet
  deadlineDays: number | null = null;
  proactiveEnabled = true;

  // Tab data
  sections: SectionInfo[] = [];
  insights: InsightCard[] = [];
  actions: ActionCard[] = [];
  history: HistoryEntry[] = [];
  chatMessages: ChatMessage[] = [];

  // Badges
  activeTab: TabName = "insights";
  badges: Record<TabName, number> = { insights: 0, actions: 0, chat: 0, history: 0 };

  // Event listeners
  private listeners = new Map<string, Listener[]>();

  on(event: string, fn: Listener): void {
    const list = this.listeners.get(event) || [];
    list.push(fn);
    this.listeners.set(event, list);
  }

  emit(event: string): void {
    const list = this.listeners.get(event) || [];
    for (const fn of list) fn();
  }

  // ---- Insights ----

  addInsight(card: Omit<InsightCard, "id" | "dismissed" | "resolved" | "createdAt">): InsightCard {
    const insight: InsightCard = {
      ...card,
      id: "ins-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      dismissed: false,
      resolved: false,
      createdAt: Date.now(),
    };
    this.insights.unshift(insight);
    if (this.activeTab !== "insights") this.badges.insights++;
    this.emit("insights");
    this.emit("badges");
    return insight;
  }

  dismissInsight(id: string): void {
    const card = this.insights.find(c => c.id === id);
    if (card) {
      card.dismissed = true;
      this.addHistory({ type: "insight_dismissed", description: card.title });
      this.emit("insights");
    }
  }

  resolveInsight(id: string): void {
    const card = this.insights.find(c => c.id === id);
    if (card) card.resolved = true;
    this.emit("insights");
  }

  get activeInsights(): InsightCard[] {
    return this.insights.filter(c => !c.dismissed && !c.resolved);
  }

  // ---- Actions ----

  addAction(card: Omit<ActionCard, "id" | "status" | "createdAt">): ActionCard {
    const action: ActionCard = {
      ...card,
      id: "act-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      status: "pending",
      createdAt: Date.now(),
    };
    this.actions.unshift(action);
    if (this.activeTab !== "actions") this.badges.actions++;
    this.emit("actions");
    this.emit("badges");
    return action;
  }

  updateAction(id: string, updates: Partial<ActionCard>): void {
    const action = this.actions.find(a => a.id === id);
    if (action) Object.assign(action, updates);
    this.emit("actions");
  }

  get pendingActions(): ActionCard[] {
    return this.actions.filter(a => a.status === "pending" || a.status === "previewing");
  }

  get appliedActions(): ActionCard[] {
    return this.actions.filter(a => a.status === "applied");
  }

  // ---- History ----

  addHistory(entry: Omit<HistoryEntry, "id" | "timestamp">): void {
    this.history.unshift({
      ...entry,
      id: "hist-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
    });
    if (this.activeTab !== "history") this.badges.history++;
    this.emit("history");
    this.emit("badges");
  }

  // ---- Chat ----

  addChatMessage(msg: Omit<ChatMessage, "timestamp">): void {
    this.chatMessages.push({ ...msg, timestamp: Date.now() });
    if (this.activeTab !== "chat") this.badges.chat++;
    this.emit("chat");
    this.emit("badges");
  }

  // ---- Score ----

  setScore(score: number): void {
    const oldScore = this.overallScore;
    this.overallScore = score;
    if (oldScore !== -1 && oldScore !== score) {
      this.addHistory({ type: "score_change", description: `Score: ${oldScore} → ${score}`, meta: { from: oldScore, to: score } });
    }
    this.emit("score");
  }

  // ---- Tabs ----

  switchTab(tab: TabName): void {
    this.activeTab = tab;
    this.badges[tab] = 0;
    this.emit("tab");
    this.emit("badges");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/word/src/taskpane/state.ts
git commit -m "feat(word-addin): add MerrisState manager for 4-tab architecture"
```

---

## Task 2: Document Operations (`document-ops.ts`)

**Files:**
- Create: `src/taskpane/document-ops.ts`

Extracts all Word.js operations into a single module. Every function is self-contained with its own `Word.run`.

- [ ] **Step 1: Create `src/taskpane/document-ops.ts`**

```typescript
// src/taskpane/document-ops.ts

/* globals Word */
declare const Word: any;

// ---- Heading Detection ----

export function isHeading(text: string, style: string): boolean {
  if (!text) return false;
  if (style.includes("heading")) return true;
  if (/^(GRI|ESRS|IFRS S|TCFD|SASB)\s/i.test(text)) return true;
  if (/^\d+(\.\d+)*\.?\s+\S/.test(text)) return true;
  if (text.length < 80 && text.length > 2 && /^[A-Z]/.test(text)) {
    if (text === text.toUpperCase() && text.length > 3) return true;
    if (!text.endsWith(".") && text.length < 60) return true;
  }
  return false;
}

export function detectFramework(text: string): string {
  if (/GRI\s?\d/i.test(text)) return "GRI";
  if (/ESRS\s?[A-Z]/i.test(text)) return "ESRS";
  if (/TCFD/i.test(text)) return "TCFD";
  if (/SASB/i.test(text)) return "SASB";
  if (/IFRS\sS/i.test(text)) return "IFRS S";
  return "";
}

// ---- Read Operations ----

export interface ParagraphData {
  text: string;
  style: string;
  index: number;
}

export async function readAllParagraphs(): Promise<ParagraphData[]> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text,items/style");
      await ctx.sync();
      const result: ParagraphData[] = [];
      for (let i = 0; i < paras.items.length; i++) {
        result.push({
          text: paras.items[i].text || "",
          style: (paras.items[i].style || "").toLowerCase(),
          index: i,
        });
      }
      resolve(result);
    }).catch(() => resolve([]));
  });
}

export async function readFullDocument(): Promise<string> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text,items/style");
      await ctx.sync();
      let text = "";
      for (const p of paras.items) {
        const t = (p.text || "").trim();
        if (!t) continue;
        const s = (p.style || "").toLowerCase();
        text += s.includes("heading") ? `\n${t}\n` : `${t}\n`;
      }
      resolve(text);
    }).catch(() => resolve(""));
  });
}

export async function getCursorParagraphIndex(): Promise<number> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const sel = ctx.document.getSelection();
      const paras = ctx.document.body.paragraphs;
      sel.load("text");
      paras.load("items/text");
      await ctx.sync();
      const selText = (sel.text || "").trim();
      if (!selText) { resolve(-1); return; }
      for (let i = 0; i < paras.items.length; i++) {
        if ((paras.items[i].text || "").includes(selText.substring(0, 30))) {
          resolve(i); return;
        }
      }
      resolve(-1);
    }).catch(() => resolve(-1));
  });
}

// ---- Write Operations ----

/** Insert text at a specific paragraph index (replaces that paragraph) */
export async function replaceAtIndex(index: number, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text,items/font");
      await ctx.sync();
      if (index >= 0 && index < paras.items.length) {
        paras.items[index].clear();
        paras.items[index].insertText(text.replace(/\n/g, "\r"), "Start");
        paras.items[index].font.color = "#000000";
        paras.items[index].font.italic = false;
        paras.items[index].font.size = 11;
        await ctx.sync();
        resolve(true);
      } else {
        resolve(false);
      }
    }).catch(() => resolve(false));
  });
}

/** Insert text after a specific paragraph index */
export async function insertAfterIndex(index: number, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text");
      await ctx.sync();
      if (index >= 0 && index < paras.items.length) {
        const p = paras.items[index].insertParagraph(text.replace(/\n/g, "\r"), "After");
        p.font.color = "#000000";
        p.font.italic = false;
        p.font.size = 11;
        await ctx.sync();
        resolve(true);
      } else {
        resolve(false);
      }
    }).catch(() => resolve(false));
  });
}

/** Delete a paragraph by finding text that matches */
export async function deleteParagraphContaining(searchText: string): Promise<boolean> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text");
      await ctx.sync();
      for (const p of paras.items) {
        if ((p.text || "").includes(searchText)) {
          p.delete();
          await ctx.sync();
          resolve(true); return;
        }
      }
      resolve(false);
    }).catch(() => resolve(false));
  });
}

/** Insert a comment on a paragraph containing the given text */
export async function insertCommentOn(searchText: string, comment: string): Promise<boolean> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text");
      await ctx.sync();
      for (const p of paras.items) {
        if ((p.text || "").includes(searchText.substring(0, 40))) {
          try {
            const range = p.getRange("Whole");
            range.insertComment(comment);
            await ctx.sync();
            resolve(true); return;
          } catch {
            // Comments API not available — insert as styled paragraph
            const note = p.insertParagraph(`[Merris Review] ${comment}`, "After");
            note.font.color = "#6366f1";
            note.font.italic = true;
            note.font.size = 10;
            await ctx.sync();
            resolve(true); return;
          }
        }
      }
      resolve(false);
    }).catch(() => resolve(false));
  });
}

/** Insert a Word table after a paragraph containing searchText */
export async function insertTableAfter(searchText: string, tableData: string[][]): Promise<boolean> {
  if (tableData.length < 2) return false;
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text");
      await ctx.sync();
      for (const p of paras.items) {
        if ((p.text || "").includes(searchText.substring(0, 30))) {
          const rows = tableData.length;
          const cols = tableData[0].length;
          const table = p.insertTable(rows, cols, "After", tableData);
          table.styleBuiltIn = Word.BuiltInStyleName.gridTable4Accent1;
          table.headerRowCount = 1;
          p.delete(); // remove the marker
          await ctx.sync();
          resolve(true); return;
        }
      }
      resolve(false);
    }).catch(() => resolve(false));
  });
}

/** Replace a paragraph's text (find by content match, replace with new text) */
export async function replaceParagraphText(oldTextSubstring: string, newText: string): Promise<{ success: boolean; oldFull: string }> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text,items/font");
      await ctx.sync();
      for (const p of paras.items) {
        const pText = p.text || "";
        if (pText.includes(oldTextSubstring)) {
          const oldFull = pText;
          p.clear();
          p.insertText(newText.replace(/\n/g, "\r"), "Start");
          p.font.color = "#000000";
          p.font.italic = false;
          p.font.size = 11;
          await ctx.sync();
          resolve({ success: true, oldFull }); return;
        }
      }
      resolve({ success: false, oldFull: "" });
    }).catch(() => resolve({ success: false, oldFull: "" }));
  });
}

/** Scroll to a heading in the document */
export async function scrollToHeading(heading: string): Promise<void> {
  try {
    await Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text");
      await ctx.sync();
      for (const p of paras.items) {
        if ((p.text || "").trim() === heading) {
          p.select();
          await ctx.sync();
          return;
        }
      }
    });
  } catch { /* best effort */ }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/word/src/taskpane/document-ops.ts
git commit -m "feat(word-addin): extract document operations module"
```

---

## Task 3: Taskpane HTML Rewrite

**Files:**
- Modify: `src/taskpane/taskpane.html`

- [ ] **Step 1: Rewrite `taskpane.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Merris ESG Agent — Word</title>
  <script src="https://appsforoffice.microsoft.com/lib/1.1/hosted/office.js"></script>
</head>
<body>
  <div class="merris-taskpane" id="merris-root">

    <!-- Engagement Selector (shown first, hidden after selection) -->
    <div id="engagement-selector-container"></div>

    <!-- Main App (hidden until engagement selected) -->
    <div id="merris-app" style="display:none; height:100vh; display:none; flex-direction:column;">

      <!-- Tab Bar -->
      <div class="merris-tab-bar" id="tab-bar">
        <button class="merris-tab active" data-tab="insights">Insights</button>
        <button class="merris-tab" data-tab="actions">Actions</button>
        <button class="merris-tab" data-tab="chat">Chat</button>
        <button class="merris-tab" data-tab="history">History</button>
      </div>

      <!-- Tab Content -->
      <div class="merris-tab-content" id="tab-content">
        <div id="tab-insights" class="merris-tab-panel active"></div>
        <div id="tab-actions" class="merris-tab-panel" style="display:none;"></div>
        <div id="tab-chat" class="merris-tab-panel" style="display:none;"></div>
        <div id="tab-history" class="merris-tab-panel" style="display:none;"></div>
      </div>

      <!-- Persistent Footer -->
      <div class="merris-footer" id="merris-footer"></div>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/word/src/taskpane/taskpane.html
git commit -m "feat(word-addin): rewrite taskpane HTML with 4-tab shell"
```

---

## Task 4: CSS Updates (`styles.css`)

**Files:**
- Modify: `../shared/styles.css`

- [ ] **Step 1: Add tab, footer, card, and badge styles to `styles.css`**

Append the following after the existing styles (keep all existing classes intact for backward compat with other add-ins):

```css
/* ============================================
   4-Tab Sidebar Layout
   ============================================ */

/* Tab Bar */
.merris-tab-bar {
  display: flex;
  border-bottom: 1px solid var(--merris-border);
  background: var(--merris-bg);
  flex-shrink: 0;
  padding: 0 4px;
}

.merris-tab {
  flex: 1;
  padding: 10px 4px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--merris-text-secondary);
  cursor: pointer;
  position: relative;
  transition: color 0.15s, border-color 0.15s;
}

.merris-tab:hover {
  color: var(--merris-text);
}

.merris-tab.active {
  color: var(--merris-primary);
  border-bottom-color: var(--merris-primary);
}

.merris-tab .tab-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  background: var(--merris-error);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.merris-tab .tab-badge.dot {
  min-width: 8px;
  height: 8px;
  padding: 0;
}

/* Tab Content */
.merris-tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.merris-tab-panel {
  display: none;
}

.merris-tab-panel.active {
  display: block;
}

/* Persistent Footer */
.merris-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--merris-border);
  background: var(--merris-bg);
  padding: 8px 10px;
}

.merris-footer-stats {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--merris-text-secondary);
  margin-bottom: 6px;
}

.merris-footer-stats .stat-clickable {
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
}

.merris-footer-stats .stat-clickable:hover {
  color: var(--merris-primary);
}

.merris-footer-score {
  font-weight: 700;
  font-size: 13px;
}

.merris-footer-input {
  display: flex;
  gap: 6px;
}

.merris-footer-input input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--merris-border);
  border-radius: var(--merris-radius);
  font-size: 12px;
  background: var(--merris-bg-secondary);
  color: var(--merris-text);
  outline: none;
}

.merris-footer-input input:focus {
  border-color: var(--merris-primary);
}

/* Insight Cards */
.merris-insight-card {
  border: 1px solid var(--merris-border);
  border-left: 3px solid var(--merris-border);
  border-radius: var(--merris-radius);
  padding: 8px 10px;
  margin-bottom: 6px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.1s;
}

.merris-insight-card:hover {
  background: var(--merris-bg-secondary);
}

.merris-insight-card.collapsed .insight-detail {
  display: none;
}

.merris-insight-card.resolved {
  opacity: 0.5;
  text-decoration: line-through;
}

.merris-insight-card[data-type="data_issue"]       { border-left-color: #ef4444; }
.merris-insight-card[data-type="compliance_gap"]    { border-left-color: #f59e0b; }
.merris-insight-card[data-type="peer_benchmark"]    { border-left-color: #3b82f6; }
.merris-insight-card[data-type="regulatory_context"]{ border-left-color: #8b5cf6; }
.merris-insight-card[data-type="quality_issue"]     { border-left-color: #ec4899; }

.insight-title {
  font-weight: 600;
  color: var(--merris-text);
}

.insight-detail {
  margin-top: 6px;
  color: var(--merris-text-secondary);
  line-height: 1.4;
}

.insight-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.insight-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--merris-text-secondary);
  margin-bottom: 4px;
}

/* Action Cards */
.merris-action-card {
  border: 1px solid var(--merris-border);
  border-radius: var(--merris-radius);
  padding: 10px;
  margin-bottom: 8px;
  font-size: 11px;
}

.merris-action-card.applied {
  opacity: 0.5;
  border-color: var(--merris-success);
}

.merris-action-card.skipped {
  opacity: 0.4;
}

.action-preview {
  background: var(--merris-bg-secondary);
  border: 1px solid var(--merris-border);
  border-radius: 4px;
  padding: 8px;
  margin: 8px 0;
  font-size: 11px;
  line-height: 1.5;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
}

.action-buttons {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.action-diff-before {
  border-left: 2px solid #ef4444;
  padding-left: 6px;
  margin: 4px 0;
  color: var(--merris-text-secondary);
}

.action-diff-after {
  border-left: 2px solid #22c55e;
  padding-left: 6px;
  margin: 4px 0;
  color: var(--merris-text);
}

/* Section Map */
.section-map-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
}

.section-map-item:hover {
  background: var(--merris-bg-secondary);
}

.section-map-score {
  min-width: 32px;
  text-align: right;
  font-weight: 600;
  font-size: 11px;
}

.section-map-status {
  width: 14px;
  text-align: center;
  font-size: 12px;
}

/* Chat Messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.chat-msg {
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: var(--merris-radius);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.chat-msg-user {
  background: var(--merris-primary-light);
  color: var(--merris-text);
  margin-left: 20px;
}

.chat-msg-assistant {
  background: var(--merris-bg-secondary);
  color: var(--merris-text);
  margin-right: 20px;
}

.chat-routed-link {
  display: inline-block;
  margin-top: 4px;
  font-size: 10px;
  color: var(--merris-primary);
  cursor: pointer;
  text-decoration: underline;
}

/* History */
.history-entry {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--merris-border);
  font-size: 11px;
}

.history-time {
  min-width: 45px;
  color: var(--merris-text-secondary);
  font-size: 10px;
}

.history-desc {
  flex: 1;
  color: var(--merris-text);
}

/* Proactive toggle */
.proactive-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--merris-text-secondary);
  cursor: pointer;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/shared/styles.css
git commit -m "feat(word-addin): add 4-tab sidebar CSS styles"
```

---

## Task 5: Insights Tab (`insights-tab.ts`)

**Files:**
- Create: `src/taskpane/tabs/insights-tab.ts`

- [ ] **Step 1: Create `src/taskpane/tabs/insights-tab.ts`**

```typescript
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
      <div id="insights-section-map" style="margin-bottom:10px;"></div>
      <div id="insights-cards"></div>
    `;

    this.renderHeader();
    this.renderSectionMap();
    this.renderInsightCards();

    // Review button handlers are wired by the main taskpane (it has access to API calls)
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

    // Click-to-scroll handlers
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

    // Toggle collapse on card click (not on buttons)
    el.querySelectorAll<HTMLElement>(".merris-insight-card").forEach(cardEl => {
      cardEl.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".insight-action-btn")) return;
        cardEl.classList.toggle("collapsed");
      });
    });

    // Action button handlers
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

    // Create an action in the Actions tab
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
      content: "",  // will be populated when user clicks Preview/Apply
    });

    this.state.switchTab("actions");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/word/src/taskpane/tabs/insights-tab.ts
git commit -m "feat(word-addin): add Insights tab with section map and insight cards"
```

---

## Task 6: Actions Tab (`actions-tab.ts`)

**Files:**
- Create: `src/taskpane/tabs/actions-tab.ts`

- [ ] **Step 1: Create `src/taskpane/tabs/actions-tab.ts`**

```typescript
// src/taskpane/tabs/actions-tab.ts

import { MerrisState, ActionCard } from "../state";
import * as docOps from "../document-ops";
import { agentChat } from "../../../shared/api-client";

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
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/word/src/taskpane/tabs/actions-tab.ts
git commit -m "feat(word-addin): add Actions tab with preview/apply/revise/skip"
```

---

## Task 7: Chat Tab (`chat-tab.ts`)

**Files:**
- Create: `src/taskpane/tabs/chat-tab.ts`

- [ ] **Step 1: Create `src/taskpane/tabs/chat-tab.ts`**

```typescript
// src/taskpane/tabs/chat-tab.ts

import { MerrisState } from "../state";
import { readFullDocument } from "../document-ops";
import { agentChat } from "../../../shared/api-client";
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/word/src/taskpane/tabs/chat-tab.ts
git commit -m "feat(word-addin): add Chat tab with response routing"
```

---

## Task 8: History Tab (`history-tab.ts`)

**Files:**
- Create: `src/taskpane/tabs/history-tab.ts`

- [ ] **Step 1: Create `src/taskpane/tabs/history-tab.ts`**

```typescript
// src/taskpane/tabs/history-tab.ts

import { MerrisState } from "../state";
import { readFullDocument } from "../document-ops";
import { agentChat } from "../../../shared/api-client";

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
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/word/src/taskpane/tabs/history-tab.ts
git commit -m "feat(word-addin): add History tab with catch-me-up"
```

---

## Task 9: Footer (`footer.ts`)

**Files:**
- Create: `src/taskpane/footer.ts`

- [ ] **Step 1: Create `src/taskpane/footer.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/word/src/taskpane/footer.ts
git commit -m "feat(word-addin): add persistent footer with quick input"
```

---

## Task 10: @Merris Commands Module (`merris-commands.ts`)

**Files:**
- Create: `src/taskpane/merris-commands.ts`

- [ ] **Step 1: Create `src/taskpane/merris-commands.ts`**

```typescript
// src/taskpane/merris-commands.ts

import { MerrisState } from "./state";
import * as docOps from "./document-ops";
import { agentChat } from "../../../shared/api-client";

// ---- Command Classification ----

export type CommandType = "REVIEW" | "WRITE" | "EDIT" | "INSERT_ARTIFACT" | "EXPLAIN" | "REFERENCE";

export function classifyCommand(instruction: string): CommandType {
  const lower = instruction.toLowerCase().trim();
  if (!lower) return "EXPLAIN";

  if (/\b(insert\s+table|add\s+table|create\s+table|show\s+data|add\s+chart|insert\s+chart|add\s+comparison|comparison\s+table|waterfall\s+chart|data\s+table|emissions\s+table)\b/.test(lower))
    return "INSERT_ARTIFACT";
  if (/\b(add\s+references?|cite\s+sources?|add\s+evidence|add\s+citations?|where\s+does\s+this\s+come\s+from|source\s+this|back\s+this\s+up)\b/.test(lower))
    return "REFERENCE";
  if (/\b(review|check|assess|evaluate|score|is\s+this\s+correct|what\s+do\s+you\s+think|is\s+.*\s+correct|verify|validate|audit|flag\s+issues|any\s+issues|look\s+at\s+this)\b/.test(lower))
    return "REVIEW";
  if (/\b(explain|why\s|what\s+does|what\s+would|what\s+is|help\s+me\s+understand|tell\s+me\s+about|how\s+does|what\s+are\s+the|meaning\s+of)\b/.test(lower))
    return "EXPLAIN";
  if (/\b(rewrite|redraft|improve|shorten|expand|simplify|make\s+more|make\s+it|cut\s+this|too\s+wordy|tighten|rephrase|rework|needs\s+work|fix\s+this|clean\s+up|more\s+formal|less\s+formal|more\s+concise|more\s+detailed)\b/.test(lower))
    return "EDIT";
  if (/\b(write|draft|create|add|insert|compose|generate|produce|defend|justify|summarise|summarize|introduce|conclude)\b/.test(lower))
    return "WRITE";
  if (lower.endsWith("?") || lower.startsWith("is ") || lower.startsWith("are ") || lower.startsWith("does ") || lower.startsWith("should "))
    return "REVIEW";

  return "WRITE";
}

// ---- Polling ----

interface DetectedCommand {
  lineText: string;
  instruction: string;
  paragraphIndex: number;
  firstSeenAt: number;
  lastChangedAt: number;
}

const detected = new Map<number, DetectedCommand>();
let polling = false;
let processing = false;
let pollCount = 0;

export function startPolling(state: MerrisState): void {
  console.log("[Merris] Polling started — scanning every 3s");

  setInterval(async () => {
    if (polling || processing) return;
    polling = true;
    pollCount++;

    try {
      await pollCycle(state);
    } catch (e) {
      console.error("[Merris] Poll error:", e);
    }

    polling = false;
  }, 3000);
}

async function pollCycle(state: MerrisState): Promise<void> {
  const paras = await docOps.readAllParagraphs();
  const cursorIdx = await docOps.getCursorParagraphIndex();
  const now = Date.now();
  const currentIndices = new Set<number>();
  let foundCount = 0;

  for (const p of paras) {
    // Skip markers
    if (p.text.includes("[Working on:") || p.text.includes("[Merris ready") || p.text.includes("[Merris:")) continue;

    const match = p.text.match(/@merris\s*(.*)/i);
    if (!match) continue;

    foundCount++;
    currentIndices.add(p.index);
    const instruction = (match[1] || "").replace(/\s*\[Merris ready.*?\]/g, "").trim();

    const existing = detected.get(p.index);
    if (existing) {
      if (existing.lineText !== p.text) {
        existing.lineText = p.text;
        existing.instruction = instruction;
        existing.lastChangedAt = now;
      }
    } else {
      detected.set(p.index, {
        lineText: p.text,
        instruction,
        paragraphIndex: p.index,
        firstSeenAt: now,
        lastChangedAt: now,
      });
    }
  }

  // Cleanup removed detections
  for (const idx of detected.keys()) {
    if (!currentIndices.has(idx)) detected.delete(idx);
  }

  console.log(`[Merris] Poll #${pollCount}: found ${foundCount}, pending ${detected.size}`);

  // Check which are ready to fire
  const ready: DetectedCommand[] = [];
  for (const [idx, det] of detected.entries()) {
    const idle = now - det.lastChangedAt;
    const cursorOnLine = cursorIdx === idx;

    // Fire when: cursor left + 2s idle, OR 5s idle regardless
    if ((!cursorOnLine && idle >= 2000) || idle >= 5000) {
      ready.push(det);
      detected.delete(idx);
    }
  }

  // Process ready commands
  if (ready.length > 0) {
    processing = true;
    for (const cmd of ready) {
      await processCommand(cmd, state);
    }
    processing = false;
  }
}

async function processCommand(cmd: DetectedCommand, state: MerrisState): Promise<void> {
  const instruction = cmd.instruction || "what should go here?";
  const cmdType = classifyCommand(instruction);

  console.log(`[Merris] Processing: "${instruction}" → ${cmdType}`);

  // Delete the @merris line from document
  await docOps.deleteParagraphContaining(cmd.lineText.substring(0, 40));

  // Gather context
  const paras = await docOps.readAllParagraphs();
  let nearestHeading = "";
  for (let j = Math.min(cmd.paragraphIndex, paras.length - 1); j >= 0; j--) {
    if (docOps.isHeading(paras[j].text, paras[j].style)) {
      nearestHeading = paras[j].text.trim();
      break;
    }
  }

  // Route based on classification
  switch (cmdType) {
    case "REVIEW":
      await routeReview(instruction, nearestHeading, state);
      break;
    case "WRITE":
    case "EDIT":
    case "INSERT_ARTIFACT":
    case "REFERENCE":
      routeToActions(instruction, nearestHeading, cmdType, state);
      break;
    case "EXPLAIN":
      await routeExplain(instruction, nearestHeading, state);
      break;
  }
}

async function routeReview(instruction: string, heading: string, state: MerrisState): Promise<void> {
  // Generate review immediately and create insight card
  try {
    const docText = await docOps.readFullDocument();
    const response = await agentChat({
      message: `REVIEW (feedback only, do NOT write replacement content): ${instruction}\nSection: ${heading}`,
      engagementId: state.engagementId,
      documentBody: docText,
      cursorSection: heading,
    });

    const reply = response.reply || "";

    // Insert as comment in document
    if (heading) {
      const paras = await docOps.readAllParagraphs();
      let targetText = "";
      let foundHeading = false;
      for (const p of paras) {
        if (foundHeading && p.text.trim() && !docOps.isHeading(p.text, p.style)) {
          targetText = p.text;
          break;
        }
        if (p.text.trim() === heading) foundHeading = true;
      }
      if (targetText) {
        await docOps.insertCommentOn(targetText, `Merris Review: ${reply}`);
      }
    }

    // Create insight card
    state.addInsight({
      type: "quality_issue",
      title: `Review: ${heading || instruction.substring(0, 40)}`,
      detail: reply,
      sectionRef: heading,
      proactive: false,
      actions: [{ label: "Dismiss", actionType: "dismiss" }],
    });
  } catch (err: any) {
    state.addInsight({
      type: "quality_issue",
      title: `Review failed: ${instruction.substring(0, 40)}`,
      detail: `Error: ${err.message || "Unknown"}`,
      proactive: false,
      actions: [{ label: "Dismiss", actionType: "dismiss" }],
    });
  }
}

function routeToActions(instruction: string, heading: string, cmdType: CommandType, state: MerrisState): void {
  const kindMap: Record<string, "insert" | "replace" | "table" | "reference"> = {
    WRITE: "insert",
    EDIT: "replace",
    INSERT_ARTIFACT: "table",
    REFERENCE: "reference",
  };

  state.addAction({
    description: instruction.substring(0, 80),
    targetHeading: heading,
    kind: kindMap[cmdType] || "insert",
    content: "", // generated on Preview/Apply
  });

  // Auto-switch to Actions tab
  state.switchTab("actions");
}

async function routeExplain(instruction: string, heading: string, state: MerrisState): Promise<void> {
  state.addChatMessage({ role: "user", content: instruction });

  try {
    const docText = await docOps.readFullDocument();
    const response = await agentChat({
      message: `EXPLAIN (respond conversationally, do not produce document content): ${instruction}\nSection: ${heading}`,
      engagementId: state.engagementId,
      documentBody: docText,
      cursorSection: heading,
    });
    state.addChatMessage({ role: "assistant", content: response.reply || "" });
  } catch (err: any) {
    state.addChatMessage({ role: "assistant", content: `Error: ${err.message || "Unknown"}` });
  }

  state.switchTab("chat");
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/word/src/taskpane/merris-commands.ts
git commit -m "feat(word-addin): add @Merris command polling and routing module"
```

---

## Task 11: Perception Engine (`perception.ts`)

**Files:**
- Create: `src/taskpane/perception.ts`

- [ ] **Step 1: Create `src/taskpane/perception.ts`**

```typescript
// src/taskpane/perception.ts

import { MerrisState } from "./state";
import * as docOps from "./document-ops";
import { api, judgeFullDocument } from "../../../shared/api-client";

interface PerceptionResult {
  structure: {
    title: string;
    sections: Array<{
      heading: string;
      status: string;
      frameworkRef: string | null;
      wordCount: number;
      figureCount: number;
    }>;
    totalSections: number;
    draftedSections: number;
    emptySections: number;
    placeholderSections: number;
  };
  dataAlignment: {
    mismatches: Array<{
      metric: string;
      documentValue: number;
      databaseValue: number;
      databaseUnit: string;
      severity: string;
      suggestion: string;
    }>;
    missingFromDocument: string[];
  };
  complianceStatus: {
    mandatoryGaps: Array<{
      framework: string;
      disclosureCode: string;
      disclosureName: string;
    }>;
  };
  urgency: {
    deadlineDays: number | null;
    criticalActions: string[];
    partnerReadiness: number;
  };
  briefing: string;
}

let lastDocHash = "";
let perceptionInterval: ReturnType<typeof setInterval> | null = null;

export async function runInitialPerception(state: MerrisState): Promise<void> {
  await runPerception(state);

  // Start periodic re-perception (every 30s)
  if (perceptionInterval) clearInterval(perceptionInterval);
  perceptionInterval = setInterval(async () => {
    if (!state.proactiveEnabled) return;
    await runPerception(state, true);
  }, 30000);
}

async function runPerception(state: MerrisState, isProactive = false): Promise<void> {
  const docBody = await docOps.readFullDocument();
  if (!docBody || docBody.trim().length < 20) return;

  // Skip if document hasn't changed
  const hash = simpleHash(docBody);
  if (hash === lastDocHash && isProactive) return;
  lastDocHash = hash;

  try {
    const result: PerceptionResult = await api.post("/agent/perceive", {
      engagementId: state.engagementId,
      documentBody: docBody,
      documentType: "word",
    });

    // Update state
    state.documentTitle = result.structure.title || state.documentTitle;
    state.setScore(result.urgency.partnerReadiness);
    state.deadlineDays = result.urgency.deadlineDays;

    // Update sections
    state.sections = result.structure.sections.map(s => ({
      heading: s.heading,
      framework: docOps.detectFramework(s.heading),
      score: -1, // will be set by judgment
      status: s.status as any,
      wordCount: s.wordCount,
      figureCount: s.figureCount,
    }));
    state.emit("sections");

    // Generate insight cards from perception
    if (result.dataAlignment.mismatches.length > 0) {
      for (const m of result.dataAlignment.mismatches.slice(0, 5)) {
        state.addInsight({
          type: "data_issue",
          title: `Data mismatch: ${m.metric}`,
          detail: `Document: ${m.documentValue.toLocaleString()} | Database: ${m.databaseValue.toLocaleString()} ${m.databaseUnit}. ${m.suggestion}`,
          sectionRef: "",
          proactive: isProactive,
          actions: [
            { label: "Fix this", actionType: "fix" },
            { label: "Dismiss", actionType: "dismiss" },
          ],
        });
      }
    }

    if (result.complianceStatus.mandatoryGaps.length > 0) {
      for (const gap of result.complianceStatus.mandatoryGaps.slice(0, 5)) {
        state.addInsight({
          type: "compliance_gap",
          title: `Missing: ${gap.framework} ${gap.disclosureCode}`,
          detail: gap.disclosureName,
          proactive: isProactive,
          actions: [
            { label: "Draft section", actionType: "draft" },
            { label: "Dismiss", actionType: "dismiss" },
          ],
        });
      }
    }

    for (const missing of result.dataAlignment.missingFromDocument.slice(0, 3)) {
      state.addInsight({
        type: "data_issue",
        title: `Missing from document: ${missing}`,
        detail: "This metric exists in the engagement database but is not mentioned in the document.",
        proactive: isProactive,
        actions: [
          { label: "Draft section", actionType: "draft" },
          { label: "Request data", actionType: "request_data" },
          { label: "Dismiss", actionType: "dismiss" },
        ],
      });
    }
  } catch (err: any) {
    console.error("[Merris] Perception failed:", err);
  }
}

export async function runJudgment(state: MerrisState, level: "quick" | "thorough" | "partner_review"): Promise<void> {
  const docBody = await docOps.readFullDocument();
  if (!docBody || docBody.trim().length < 20) return;

  try {
    const judgment = await judgeFullDocument(state.engagementId, docBody, level);

    state.setScore(judgment.overallScore);

    // Update section scores
    for (const sj of judgment.sections) {
      const section = state.sections.find(s => s.heading === sj.sectionTitle);
      if (section) section.score = sj.score;
    }
    state.emit("sections");

    // Create insight cards from judgment
    for (const issue of judgment.criticalIssues.slice(0, 5)) {
      state.addInsight({
        type: "quality_issue",
        title: `${issue.location}: ${issue.issue.substring(0, 60)}`,
        detail: `${issue.issue}\n\nRecommendation: ${issue.recommendation}`,
        sectionRef: issue.location,
        proactive: false,
        actions: [
          { label: "Fix this", actionType: "fix" },
          { label: "Dismiss", actionType: "dismiss" },
        ],
      });
    }

    for (const issue of judgment.improvements.slice(0, 3)) {
      state.addInsight({
        type: "quality_issue",
        title: `Improvement: ${issue.location}`,
        detail: issue.issue + (issue.recommendation ? `\n\n${issue.recommendation}` : ""),
        sectionRef: issue.location,
        proactive: false,
        actions: [
          { label: "Fix this", actionType: "fix" },
          { label: "Dismiss", actionType: "dismiss" },
        ],
      });
    }

    if (level === "partner_review") {
      state.addInsight({
        type: "peer_benchmark",
        title: "Partner review simulation",
        detail: `Score: ${judgment.overallScore}/100. Partner would ${judgment.partnerWouldApprove ? "approve" : "reject"}. Auditor would ${judgment.auditorWouldAccept ? "accept" : "flag"}.`,
        proactive: false,
        actions: [{ label: "Dismiss", actionType: "dismiss" }],
      });
    }
  } catch (err: any) {
    console.error("[Merris] Judgment failed:", err);
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/word/src/taskpane/perception.ts
git commit -m "feat(word-addin): add perception engine with periodic re-analysis"
```

---

## Task 12: Rewrite Taskpane Orchestrator (`taskpane.ts`)

**Files:**
- Modify: `src/taskpane/taskpane.ts` (complete rewrite)

This is the slim orchestrator that initializes everything.

- [ ] **Step 1: Rewrite `taskpane.ts`**

Replace the entire file with:

```typescript
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
    // Route to chat
    state.switchTab("chat");
    chatTab.send(text);
  } else {
    // Route to chat (it will create action cards as needed)
    state.switchTab("chat");
    chatTab.send(text);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/office-addins/word/src/taskpane/taskpane.ts
git commit -m "feat(word-addin): rewrite taskpane.ts as slim orchestrator for 4-tab UI"
```

---

## Task 13: Build, Test, Verify

**Files:**
- None (build & verify)

- [ ] **Step 1: Create tabs directory**

```bash
mkdir -p apps/office-addins/word/src/taskpane/tabs
```

- [ ] **Step 2: Build with webpack**

```bash
cd apps/office-addins/word
npx webpack --mode development
```

Expected: `compiled successfully` with no errors. If there are TypeScript errors, fix them — the most common will be import path issues.

- [ ] **Step 3: Fix any compile errors**

Common issues to check:
- Import paths use `../../../shared/` for shared modules (3 levels up from `src/taskpane/tabs/`)
- Import paths use `../` for peer modules in `src/taskpane/`
- `Word` and `Office` are declared globally where needed
- The `classifyCommand` export from `merris-commands.ts` is used by `chat-tab.ts`

- [ ] **Step 4: Start webpack dev server**

```bash
npx webpack serve --mode development
```

Verify: `curl -s http://localhost:3003/word/taskpane.html | head -5` returns the new HTML structure with `tab-bar`.

- [ ] **Step 5: Verify through ngrok**

```bash
curl -s https://distinct-uncoincidentally-brycen.ngrok-free.dev/word/taskpane.html -H "ngrok-skip-browser-warning: true" | head -20
```

Expected: New HTML with `merris-tab-bar`, `tab-insights`, `tab-actions`, `tab-chat`, `tab-history`, `merris-footer`.

- [ ] **Step 6: Verify API proxy still works**

```bash
curl -s -X POST https://distinct-uncoincidentally-brycen.ngrok-free.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tim@merris.ai","password":"Test1234!"}' | head -50
```

Expected: JSON with `user` and `token` fields.

- [ ] **Step 7: Commit build verification**

```bash
git add -A apps/office-addins/word/src/
git commit -m "feat(word-addin): complete 4-tab sidebar redesign — build verified"
```

---

## Summary of Changes

| Before | After |
|--------|-------|
| Single `taskpane.ts` (1991 lines) | 9 focused modules (~200-300 lines each) |
| 4 flat panels (Agent, Compliance, Suggested, Citations) | 4 tabs (Insights, Actions, Chat, History) |
| @Merris → immediate document modification | @Merris → routed to Insights or Actions for user approval |
| No action queue | Full action queue with Preview/Apply/Revise/Skip |
| No persistent footer | Footer with score, counts, quick input |
| Manual perception trigger | Auto-perception on load + 30s re-perception |
| No history | Full activity log with "Catch me up" |
| Content inserted at end of document | Content positioned at target heading |
| No badges | Tab badges for unread items |
