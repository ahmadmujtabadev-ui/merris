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
  sectionRef?: string;
  actions: InsightAction[];
  dismissed: boolean;
  resolved: boolean;
  proactive: boolean;
  createdAt: number;
}

export interface InsightAction {
  label: string;
  actionType: "fix" | "draft" | "request_data" | "dismiss";
}

export type ActionStatus = "pending" | "previewing" | "applied" | "skipped";
export type ActionKind = "insert" | "replace" | "table" | "comment" | "reference";

export interface ActionCard {
  id: string;
  description: string;
  targetHeading: string;
  kind: ActionKind;
  content: string;
  beforeText?: string;
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
  routedTo?: "insights" | "actions";
}

export type TabName = "insights" | "actions" | "chat" | "history";

type Listener = () => void;

// ---- State Manager ----

export class MerrisState {
  documentTitle = "";
  engagementName = "";
  engagementId = "";
  overallScore = -1;
  deadlineDays: number | null = null;
  proactiveEnabled = true;

  sections: SectionInfo[] = [];
  insights: InsightCard[] = [];
  actions: ActionCard[] = [];
  history: HistoryEntry[] = [];
  chatMessages: ChatMessage[] = [];

  activeTab: TabName = "insights";
  badges: Record<TabName, number> = { insights: 0, actions: 0, chat: 0, history: 0 };

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

  addChatMessage(msg: Omit<ChatMessage, "timestamp">): void {
    this.chatMessages.push({ ...msg, timestamp: Date.now() });
    if (this.activeTab !== "chat") this.badges.chat++;
    this.emit("chat");
    this.emit("badges");
  }

  setScore(score: number): void {
    const oldScore = this.overallScore;
    this.overallScore = score;
    if (oldScore !== -1 && oldScore !== score) {
      this.addHistory({ type: "score_change", description: `Score: ${oldScore} → ${score}`, meta: { from: oldScore, to: score } });
    }
    this.emit("score");
  }

  switchTab(tab: TabName): void {
    this.activeTab = tab;
    this.badges[tab] = 0;
    this.emit("tab");
    this.emit("badges");
  }
}
