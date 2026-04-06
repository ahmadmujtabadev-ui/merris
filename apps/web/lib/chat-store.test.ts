import { describe, it, expect, vi } from 'vitest';
import type { StreamEvent } from '@merris/shared';
import { handleEvent } from './chat-store';
import type { ThinkingStepState, ChatPhase, EvaluationState, ChatMessage } from './chat-store';
import type { CitationItem } from '@merris/shared';
import { THINKING_PHASES } from './intelligence-constants';

interface MockChatState {
  jurisdiction: string[];
  knowledgeSources: string[];
  engagementId: string;
  phase: ChatPhase;
  question: string;
  thinkingSteps: ThinkingStepState[];
  tokenText: string;
  citations: CitationItem[];
  evaluation: EvaluationState | null;
  errorMessage: string | null;
  messages: ChatMessage[];
}

function makeState(partial: Partial<MockChatState> = {}): MockChatState {
  return {
    jurisdiction: ['Qatar'],
    knowledgeSources: ['K1', 'K7'],
    engagementId: 'eng-1',
    phase: 'thinking',
    question: 'What are our Scope 1 emissions?',
    thinkingSteps: THINKING_PHASES.map((step) => ({ step, status: 'pending' as const })),
    tokenText: '',
    citations: [],
    evaluation: null,
    errorMessage: null,
    messages: [],
    ...partial,
  };
}

function makeReducerEnv(initial: MockChatState) {
  let state = initial;
  const set = vi.fn((updater: any) => {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) };
    } else {
      state = { ...state, ...updater };
    }
  });
  const get = vi.fn(() => state);
  return { set, get, getState: () => state };
}

describe('chat-store handleEvent', () => {
  it('marks the matching phase as active on thinking_step active', () => {
    const env = makeReducerEnv(makeState());
    const event: StreamEvent = { type: 'thinking_step', step: 'Searching context', status: 'active' };
    handleEvent(event, env.set as any, env.get as any);
    const step = env.getState().thinkingSteps.find((s) => s.step === 'Searching context');
    expect(step?.status).toBe('active');
  });

  it('marks the matching phase as done on thinking_step done', () => {
    const env = makeReducerEnv(makeState());
    handleEvent({ type: 'thinking_step', step: 'Assessing query', status: 'active' }, env.set as any, env.get as any);
    handleEvent({ type: 'thinking_step', step: 'Assessing query', status: 'done', detail: 'advisory question' }, env.set as any, env.get as any);
    const step = env.getState().thinkingSteps.find((s) => s.step === 'Assessing query');
    expect(step?.status).toBe('done');
    expect(step?.detail).toBe('advisory question');
  });

  it('marks the phase as failed when thinking_step done has detail "failed"', () => {
    const env = makeReducerEnv(makeState());
    handleEvent({ type: 'thinking_step', step: 'Analyzing', status: 'done', detail: 'failed' }, env.set as any, env.get as any);
    const step = env.getState().thinkingSteps.find((s) => s.step === 'Analyzing');
    expect(step?.status).toBe('failed');
  });

  it('attaches sources to Retrieving intelligence on thinking_sources', () => {
    const env = makeReducerEnv(makeState());
    handleEvent({ type: 'thinking_sources', sources: ['K1', 'K7'] }, env.set as any, env.get as any);
    const step = env.getState().thinkingSteps.find((s) => s.step === 'Retrieving intelligence');
    expect(step?.sources).toEqual(['K1', 'K7']);
  });

  it('writes the token text on token event', () => {
    const env = makeReducerEnv(makeState());
    handleEvent({ type: 'token', text: 'Hello, world.' }, env.set as any, env.get as any);
    expect(env.getState().tokenText).toBe('Hello, world.');
  });

  it('writes citations on sources event', () => {
    const env = makeReducerEnv(makeState());
    const cite: CitationItem = {
      id: 'c1',
      title: 'IEA 2023',
      source: 'IEA',
      year: 2023,
      domain: 'K2',
      excerpt: '',
      verified: true,
    };
    handleEvent({ type: 'sources', citations: [cite] }, env.set as any, env.get as any);
    expect(env.getState().citations).toEqual([cite]);
  });

  it('writes evaluation on evaluation event', () => {
    const env = makeReducerEnv(makeState());
    handleEvent({ type: 'evaluation', score: 87, confidence: 'high', decision: 'PASS' }, env.set as any, env.get as any);
    expect(env.getState().evaluation).toEqual({ score: 87, confidence: 'high', decision: 'PASS' });
  });

  it('sets errorMessage on error event', () => {
    const env = makeReducerEnv(makeState());
    handleEvent({ type: 'error', message: 'boom' }, env.set as any, env.get as any);
    expect(env.getState().errorMessage).toBe('boom');
  });

  it('pushes a completed message to messages on done with token text and no error', () => {
    const env = makeReducerEnv(
      makeState({
        question: 'What about water?',
        tokenText: 'Water risk is high.',
        citations: [],
        evaluation: { score: 80, confidence: 'high', decision: 'PASS' },
      }),
    );
    handleEvent({ type: 'done' }, env.set as any, env.get as any);
    const messages = env.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.question).toBe('What about water?');
    expect(messages[0]?.answer).toBe('Water risk is high.');
    expect(env.getState().phase).toBe('response');
  });

  it('does NOT push a message on done if errorMessage is set', () => {
    const env = makeReducerEnv(
      makeState({
        errorMessage: 'oops',
        tokenText: '',
      }),
    );
    handleEvent({ type: 'done' }, env.set as any, env.get as any);
    expect(env.getState().messages).toHaveLength(0);
    expect(env.getState().phase).toBe('response');
  });
});
