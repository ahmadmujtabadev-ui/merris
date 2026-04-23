import { create } from 'zustand';
import type { StreamEvent, CitationItem } from '@merris/shared';
import { THINKING_PHASES } from './intelligence-constants';
import { api } from './api';
// Lazy import to avoid circular dependency — read auth token at call time
function getAuthUser() {
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('merris_auth') : null;
    if (stored) return JSON.parse(stored)?.user ?? null;
  } catch { /* ignore */ }
  return null;
}

export type ChatPhase = 'home' | 'thinking' | 'response';

export interface ThinkingStepState {
  step: (typeof THINKING_PHASES)[number];
  status: 'pending' | 'active' | 'done' | 'failed';
  detail?: string;
  sources?: string[];
}

export interface EvaluationState {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  decision?: 'PASS' | 'FIX' | 'REJECT' | 'BLOCK';
}

export interface ChatMessage {
  id: string;
  question: string;
  answer: string;
  citations: CitationItem[];
  evaluation: EvaluationState | null;
  timestamp: number;
}

interface ChatState {
  // input/context
  jurisdiction: string[];          // active codes
  knowledgeSources: string[];      // active K-codes (e.g., ['K1','K7'])
  engagementId: string;            // selected engagement; placeholder for now

  // current run
  phase: ChatPhase;
  question: string;                // the most recent submitted question
  thinkingSteps: ThinkingStepState[];
  tokenText: string;
  citations: CitationItem[];
  evaluation: EvaluationState | null;
  errorMessage: string | null;

  // conversation history
  messages: ChatMessage[];

  // actions
  toggleJurisdiction: (j: string) => void;
  toggleKnowledgeSource: (k: string) => void;
  setEngagementId: (id: string) => void;
  startQuery: (question: string) => Promise<void>;
  reset: () => void;
  clearConversation: () => void;
}

const initialThinkingSteps = (): ThinkingStepState[] =>
  THINKING_PHASES.map((step) => ({ step, status: 'pending' }));

export const useChatStore = create<ChatState>((set, get) => ({
  jurisdiction: ['Qatar'],
  knowledgeSources: ['K1', 'K7'],
  engagementId: '000000000000000000000000', // placeholder ObjectId; real one comes from engagement selector

  phase: 'home',
  question: '',
  thinkingSteps: initialThinkingSteps(),
  tokenText: '',
  citations: [],
  evaluation: null,
  errorMessage: null,

  messages: [],

  toggleJurisdiction: (j) =>
    set((s) => ({
      jurisdiction: s.jurisdiction.includes(j)
        ? s.jurisdiction.filter((x) => x !== j)
        : [...s.jurisdiction, j],
    })),

  toggleKnowledgeSource: (k) =>
    set((s) => ({
      knowledgeSources: s.knowledgeSources.includes(k)
        ? s.knowledgeSources.filter((x) => x !== k)
        : [...s.knowledgeSources, k],
    })),

  setEngagementId: (id) => set({ engagementId: id }),

  startQuery: async (question) => {
    set({
      phase: 'thinking',
      question,
      thinkingSteps: initialThinkingSteps(),
      tokenText: '',
      citations: [],
      evaluation: null,
      errorMessage: null,
    });

    const { engagementId, jurisdiction, knowledgeSources, messages } = get();
    const authUser = getAuthUser();

    try {
      const res = await api.chat({
        engagementId,
        message: question,
        jurisdiction: jurisdiction.join(','),
        knowledgeSources,
        ...(authUser?.id ? { userId: authUser.id } : {}),
        conversationHistory: messages.flatMap((m) => [
          { role: 'user' as const, content: m.question },
          { role: 'assistant' as const, content: m.answer },
        ]),
      });

      // Synthesise stream events from the JSON response
      if (res.evaluation) {
        handleEvent({
          type: 'evaluation',
          score: res.evaluation.score,
          confidence: (res.confidence ?? 'medium') as 'high' | 'medium' | 'low',
          decision: res.evaluation.decision as 'PASS' | 'FIX' | 'REJECT' | 'BLOCK',
        } as StreamEvent, set, get);
      }
      if (res.citations?.length) {
        handleEvent({ type: 'sources', citations: res.citations } as unknown as StreamEvent, set, get);
      }
      handleEvent({ type: 'token', text: res.response } as StreamEvent, set, get);
      handleEvent({ type: 'done' } as StreamEvent, set, get);
    } catch (err) {
      set({
        phase: 'response',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  },

  reset: () =>
    set({
      phase: 'home',
      question: '',
      thinkingSteps: initialThinkingSteps(),
      tokenText: '',
      citations: [],
      evaluation: null,
      errorMessage: null,
    }),

  clearConversation: () =>
    set({
      phase: 'home',
      question: '',
      thinkingSteps: initialThinkingSteps(),
      tokenText: '',
      citations: [],
      evaluation: null,
      errorMessage: null,
      messages: [],
    }),
}));

// ----- Pure event reducer -----
// Extracted into a function so it can be unit-tested independently when
// the web app gains test infrastructure.
export function handleEvent(
  event: StreamEvent,
  set: (partial: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>)) => void,
  _get: () => ChatState,
) {
  switch (event.type) {
    case 'thinking_step': {
      set((s) => ({
        thinkingSteps: s.thinkingSteps.map((step) =>
          step.step === event.step
            ? {
                ...step,
                status: event.status === 'done'
                  ? (event.detail === 'failed' ? 'failed' : 'done')
                  : 'active',
                detail: event.detail ?? step.detail,
              }
            : step,
        ),
      }));
      break;
    }
    case 'thinking_sources': {
      set((s) => ({
        thinkingSteps: s.thinkingSteps.map((step) =>
          step.step === 'Retrieving intelligence'
            ? { ...step, sources: event.sources }
            : step,
        ),
      }));
      break;
    }
    case 'token': {
      set({ tokenText: event.text });
      break;
    }
    case 'sources': {
      set({ citations: event.citations });
      break;
    }
    case 'evaluation': {
      set({
        evaluation: {
          score: event.score,
          confidence: event.confidence,
          decision: event.decision,
        },
      });
      break;
    }
    case 'error': {
      set({ errorMessage: event.message });
      break;
    }
    case 'done': {
      set((s) => {
        // Push the completed exchange into the messages array IF the run was successful
        // (not error, has a token). Block decisions still get pushed because they're a
        // valid response, just one with the BLOCK decision.
        if (s.errorMessage === null && s.tokenText.length > 0) {
          const newMessage: ChatMessage = {
            id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            question: s.question,
            answer: s.tokenText,
            citations: s.citations,
            evaluation: s.evaluation,
            timestamp: Date.now(),
          };
          return { phase: 'response', messages: [...s.messages, newMessage] };
        }
        return { phase: 'response' };
      });
      break;
    }
  }
}
