'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType, ChatToolCall } from '@/lib/chat-store';

// ============================================================
// Tool Call Icons and Labels
// ============================================================

const TOOL_DISPLAY: Record<string, { icon: string; label: string }> = {
  search_documents: { icon: '\uD83D\uDD0D', label: 'Searching documents' },
  get_data_point: { icon: '\uD83D\uDCCA', label: 'Retrieving data' },
  check_consistency: { icon: '\uD83D\uDCCB', label: 'Running consistency check' },
  draft_disclosure: { icon: '\u270D\uFE0F', label: 'Drafting content' },
  calculate: { icon: '\uD83D\uDCCA', label: 'Calculating' },
  benchmark: { icon: '\uD83D\uDCCA', label: 'Benchmarking' },
  get_emission_factor: { icon: '\uD83C\uDF0D', label: 'Looking up emission factors' },
  generate_chart: { icon: '\uD83D\uDCC8', label: 'Generating chart' },
  gap_analysis: { icon: '\uD83D\uDCCB', label: 'Analyzing gaps' },
  regulatory_check: { icon: '\u2696\uFE0F', label: 'Checking regulations' },
};

function getToolDisplay(name: string) {
  return TOOL_DISPLAY[name] ?? { icon: '\u2699\uFE0F', label: name.replace(/_/g, ' ') };
}

// ============================================================
// Tool Call Block
// ============================================================

function ToolCallBlock({ toolCall }: { toolCall: ChatToolCall }) {
  const [expanded, setExpanded] = React.useState(false);
  const display = getToolDisplay(toolCall.name);

  return (
    <div className="my-2 rounded-md border border-zinc-700/50 bg-zinc-800/50">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-400 hover:text-zinc-300"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{display.icon}</span>
        <span className="font-medium">{display.label}</span>
        <span className="ml-auto text-zinc-500">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded && (
        <div className="border-t border-zinc-700/50 px-3 py-2">
          <pre className="overflow-x-auto text-xs text-zinc-500">
            {JSON.stringify(toolCall.output ?? toolCall.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Simple Markdown Renderer
// ============================================================

function renderMarkdown(content: string): string {
  let html = content
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code class="rounded bg-zinc-800 px-1 py-0.5 text-xs text-emerald-400">$1</code>')
    // Line breaks
    .replace(/\n/g, '<br />');

  return html;
}

// ============================================================
// Chat Message Component
// ============================================================

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="my-2 text-center text-xs text-zinc-500">
        {message.content}
      </div>
    );
  }

  return (
    <div
      className={cn('mb-3 flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-emerald-600/20 text-emerald-100'
            : 'bg-zinc-800 text-zinc-200',
        )}
      >
        {/* Tool call indicators */}
        {message.toolCalls?.map((tc, idx) => (
          <ToolCallBlock key={`${tc.name}-${idx}`} toolCall={tc} />
        ))}

        {/* Message content */}
        <div
          className="prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />

        {/* Timestamp */}
        <div
          className={cn(
            'mt-1 text-[10px]',
            isUser ? 'text-emerald-400/50' : 'text-zinc-500',
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Loading Indicator
// ============================================================

export function ChatLoadingIndicator() {
  return (
    <div className="mb-3 flex justify-start">
      <div className="rounded-lg bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" />
        </div>
      </div>
    </div>
  );
}
