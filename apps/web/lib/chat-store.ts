import { create } from 'zustand';

// ============================================================
// Chat Message Types (local mirrors to avoid runtime Zod)
// ============================================================

export interface ChatToolCall {
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ChatToolCall[];
}

export interface SuggestedAction {
  label: string;
  action: string;
  params?: Record<string, unknown>;
}

// ============================================================
// Chat Store
// ============================================================

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isOpen: boolean;
  engagementId: string | null;
  suggestedActions: SuggestedAction[];

  setEngagementId: (id: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setLoading: (loading: boolean) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setSuggestedActions: (actions: SuggestedAction[]) => void;
  clearMessages: () => void;
  sendMessage: (content: string) => Promise<void>;
}

let messageCounter = 0;
function generateId(): string {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isOpen: false,
  engagementId: null,
  suggestedActions: [],

  setEngagementId: (id) => set({ engagementId: id }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  setLoading: (loading) => set({ isLoading: loading }),

  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  setOpen: (open) => set({ isOpen: open }),

  setSuggestedActions: (actions) => set({ suggestedActions: actions }),

  clearMessages: () => set({ messages: [], suggestedActions: [] }),

  sendMessage: async (content: string) => {
    const { engagementId, messages } = get();

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      suggestedActions: [],
    }));

    try {
      // Build conversation history for the API
      const conversationHistory = messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const API_BASE =
        typeof window !== 'undefined'
          ? (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1')
          : 'http://localhost:3001/api/v1';

      // Load auth token from localStorage if needed
      let authToken: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('merris_auth');
          if (stored) {
            const parsed = JSON.parse(stored) as { token?: string };
            if (parsed.token) authToken = parsed.token;
          }
        } catch { /* ignore */ }
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_BASE}/agent/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          engagementId: engagementId ?? 'default',
          message: content,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const data = (await response.json()) as {
        response: string;
        toolCalls?: ChatToolCall[];
        suggestedActions?: SuggestedAction[];
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        suggestedActions: data.suggestedActions ?? [
          { label: 'Draft next section', action: 'draft_next' },
          { label: 'Run consistency check', action: 'check_consistency' },
          { label: 'Show data gaps', action: 'show_gaps' },
        ],
      }));
    } catch {
      // On error, add a fallback assistant message
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content:
          'I apologize, but I encountered an issue processing your request. Please try again.',
        timestamp: new Date(),
      };

      set((state) => ({
        messages: [...state.messages, errorMessage],
        isLoading: false,
      }));
    }
  },
}));
