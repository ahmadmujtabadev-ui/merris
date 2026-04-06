import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConversationMessage } from './conversation-message';
import type { ChatMessage } from '@/lib/chat-store';

const baseMessage: ChatMessage = {
  id: 'm-1',
  question: 'What are our Scope 1 emissions for FY24?',
  answer: 'Scope 1 emissions for FY24 were 12,400 tCO2e.',
  citations: [
    {
      id: 'c1',
      title: 'IEA Emission Factors 2023',
      source: 'IEA',
      year: 2023,
      domain: 'K2',
      excerpt: '',
      verified: true,
    },
  ],
  evaluation: { score: 87, confidence: 'high', decision: 'PASS' },
  timestamp: Date.now(),
};

describe('ConversationMessage', () => {
  it('renders the question and answer text', () => {
    render(<ConversationMessage message={baseMessage} />);
    expect(screen.getByText(baseMessage.question)).toBeInTheDocument();
    expect(screen.getByText(baseMessage.answer)).toBeInTheDocument();
  });

  it('shows the confidence pill', () => {
    render(<ConversationMessage message={baseMessage} />);
    expect(screen.getByText(/high Confidence/i)).toBeInTheDocument();
  });

  it('shows the source count', () => {
    render(<ConversationMessage message={baseMessage} />);
    expect(screen.getByText(/1 source cited/)).toBeInTheDocument();
  });

  it('renders the citation title from CitationsList', () => {
    render(<ConversationMessage message={baseMessage} />);
    expect(screen.getByText('IEA Emission Factors 2023')).toBeInTheDocument();
  });

  it('omits the confidence pill when evaluation is null', () => {
    render(<ConversationMessage message={{ ...baseMessage, evaluation: null }} />);
    expect(screen.queryByText(/Confidence/i)).not.toBeInTheDocument();
  });
});
