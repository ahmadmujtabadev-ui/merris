// Discriminated union of every event type the assistant chat stream can emit.
// The frontend ThinkingState consumes this; the backend agent.stream emits it.

export type ThinkingStepName =
  | 'Assessing query'
  | 'Searching context'
  | 'Retrieving intelligence'
  | 'Analyzing'
  | 'Evaluating quality'
  | 'Answering';

export type ThinkingStepStatus = 'active' | 'done';

export interface ThinkingStepEvent {
  type: 'thinking_step';
  step: ThinkingStepName;
  status: ThinkingStepStatus;
  detail?: string;
}

export interface ThinkingSourcesEvent {
  type: 'thinking_sources';
  sources: string[]; // e.g., ['K1', 'K3', 'K7']
}

export interface TokenEvent {
  type: 'token';
  text: string;
}

export interface EvaluationEvent {
  type: 'evaluation';
  score: number;
  confidence: 'high' | 'medium' | 'low';
  decision?: 'PASS' | 'FIX' | 'REJECT' | 'BLOCK';
}

export interface CitationItem {
  id: string;
  title: string;
  source: string;
  year: number;
  url?: string;
  domain: string;
  excerpt: string;
  verified: boolean;
}

export interface SourcesEvent {
  type: 'sources';
  citations: CitationItem[];
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export interface DoneEvent {
  type: 'done';
}

export type StreamEvent =
  | ThinkingStepEvent
  | ThinkingSourcesEvent
  | TokenEvent
  | EvaluationEvent
  | SourcesEvent
  | ErrorEvent
  | DoneEvent;
