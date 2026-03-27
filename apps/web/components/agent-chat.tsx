'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/lib/chat-store';
import { useEngagementStore } from '@/lib/store';
import { ChatMessage, ChatLoadingIndicator } from '@/components/chat-message';
import { Button } from '@/components/ui/button';

// ============================================================
// SVG Icons (avoiding lucide-react import issues)
// ============================================================

function MessageCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function MinimizeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
    </svg>
  );
}

// ============================================================
// Agent Chat Widget (Floating)
// ============================================================

export function AgentChat() {
  const {
    messages,
    isLoading,
    isOpen,
    suggestedActions,
    toggleOpen,
    setOpen,
    sendMessage,
    setEngagementId,
  } = useChatStore();

  const { currentEngagement, engagements } = useEngagementStore();
  const [inputValue, setInputValue] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Sync engagement context
  React.useEffect(() => {
    if (currentEngagement) {
      setEngagementId(currentEngagement.id);
    }
  }, [currentEngagement, setEngagementId]);

  // Auto-scroll on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    setInputValue('');
    void sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedAction = (action: { label: string; action: string }) => {
    void sendMessage(action.label);
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
        aria-label="Open AI assistant"
      >
        <span className="text-xl" role="img" aria-label="leaf">
          {'\uD83C\uDF3F'}
        </span>
      </button>
    );
  }

  // Expanded chat panel
  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[600px] w-[400px] flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" role="img" aria-label="leaf">
            {'\uD83C\uDF3F'}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Merris AI Assistant</h3>
            <p className="text-[10px] text-zinc-500">
              {currentEngagement
                ? currentEngagement.name
                : 'Select an engagement for context'}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Minimize"
          >
            <MinimizeIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Engagement selector (if no engagement selected) */}
      {!currentEngagement && engagements.length > 0 && (
        <div className="border-b border-zinc-800 px-4 py-2">
          <select
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
            onChange={(e) => {
              const eng = engagements.find((en) => en.id === e.target.value);
              if (eng) {
                useEngagementStore.getState().setCurrentEngagement(eng);
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Select engagement for context...
            </option>
            {engagements.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <span className="mb-2 block text-3xl">{'\uD83C\uDF3F'}</span>
              <p className="text-sm text-zinc-400">
                Hi! I am the Merris AI assistant.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Ask me about ESG data, reports, or compliance.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isLoading && <ChatLoadingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested actions */}
      {suggestedActions.length > 0 && !isLoading && (
        <div className="flex gap-1.5 overflow-x-auto border-t border-zinc-800 px-4 py-2 scrollbar-thin">
          {suggestedActions.map((action) => (
            <button
              key={action.action}
              type="button"
              className="shrink-0 rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-emerald-600 hover:text-emerald-400"
              onClick={() => handleSuggestedAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about ESG data, reports..."
            rows={1}
            className="flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="h-9 w-9 shrink-0 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
