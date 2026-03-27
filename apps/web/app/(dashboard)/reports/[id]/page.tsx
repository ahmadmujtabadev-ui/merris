'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChatMessage, ChatLoadingIndicator } from '@/components/chat-message';
import { useChatStore } from '@/lib/chat-store';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface ReportSection {
  id: string;
  title: string;
  frameworkRef?: string;
  content?: string;
  status: 'pending' | 'drafted' | 'reviewed' | 'approved';
  reviewComments: Array<{
    userId: string;
    content: string;
    timestamp: string;
    resolved: boolean;
  }>;
}

// ============================================================
// Demo Data
// ============================================================

const DEMO_REPORT = {
  id: 'rpt-1',
  title: 'FY2025 GRI Sustainability Report',
  type: 'sustainability_report' as const,
  status: 'draft' as const,
  language: 'en' as const,
  frameworks: ['GRI 2021'],
};

const DEMO_SECTIONS: ReportSection[] = [
  {
    id: 'sec-1',
    title: 'General Disclosures',
    frameworkRef: 'GRI 2: General Disclosures 2021',
    content: 'The organization has reported in accordance with the GRI Standards for the period January 1, 2025 to December 31, 2025. This report covers all entities included in the consolidated financial statements.',
    status: 'drafted',
    reviewComments: [
      { userId: 'u1', content: 'Add reporting boundary details.', timestamp: '2026-03-24T10:00:00Z', resolved: false },
    ],
  },
  {
    id: 'sec-2',
    title: 'Governance',
    frameworkRef: 'GRI 2-9 to 2-21',
    content: 'The Board of Directors maintains oversight of ESG strategy and performance. The Sustainability Committee, chaired by an independent director, meets quarterly to review progress against targets.',
    status: 'reviewed',
    reviewComments: [],
  },
  {
    id: 'sec-3',
    title: 'Environmental: Energy',
    frameworkRef: 'GRI 302: Energy 2016',
    content: undefined,
    status: 'pending',
    reviewComments: [],
  },
  {
    id: 'sec-4',
    title: 'Environmental: Emissions',
    frameworkRef: 'GRI 305: Emissions 2016',
    content: undefined,
    status: 'pending',
    reviewComments: [],
  },
  {
    id: 'sec-5',
    title: 'Social: Employment',
    frameworkRef: 'GRI 401: Employment 2016',
    content: 'Total workforce as of December 31, 2025 was 2,450 employees across 3 operating facilities. Employee turnover rate was 8.2%, down from 11.5% in FY2024.',
    status: 'drafted',
    reviewComments: [],
  },
  {
    id: 'sec-6',
    title: 'Social: Health and Safety',
    frameworkRef: 'GRI 403: Occupational Health and Safety 2018',
    content: undefined,
    status: 'pending',
    reviewComments: [],
  },
];

// ============================================================
// Status Config
// ============================================================

const SECTION_STATUS: Record<string, { label: string; variant: 'secondary' | 'warning' | 'info' | 'default' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  drafted: { label: 'Drafted', variant: 'warning' },
  reviewed: { label: 'Reviewed', variant: 'info' },
  approved: { label: 'Approved', variant: 'default' },
};

// ============================================================
// SVG Icons
// ============================================================

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

// ============================================================
// Section Editor Component
// ============================================================

function SectionEditor({
  section,
  isExpanded,
  onToggle,
}: {
  section: ReportSection;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusConfig = SECTION_STATUS[section.status] ?? SECTION_STATUS['pending']!;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      {/* Section header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/30"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDownIcon className="h-3.5 w-3.5 text-zinc-500" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5 text-zinc-500" />
          )}
          <div>
            <span className="text-sm font-medium text-zinc-200">
              {section.title}
            </span>
            {section.frameworkRef && (
              <span className="ml-2 text-xs text-zinc-500">
                {section.frameworkRef}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {section.reviewComments.filter((c) => !c.resolved).length > 0 && (
            <span className="text-[10px] text-amber-400">
              {section.reviewComments.filter((c) => !c.resolved).length} comment(s)
            </span>
          )}
          <Badge variant={statusConfig.variant} className="text-[10px]">
            {statusConfig.label}
          </Badge>
        </div>
      </button>

      {/* Section content */}
      {isExpanded && (
        <div className="border-t border-zinc-800 px-4 py-4">
          {section.content ? (
            <div className="space-y-3">
              <div className="rounded-md border border-zinc-700/50 bg-zinc-800/30 p-4">
                <p className="text-sm leading-relaxed text-zinc-300">
                  {section.content}
                </p>
              </div>

              {/* Accept / Reject controls for drafted content */}
              {section.status === 'drafted' && (
                <div className="flex items-center gap-2">
                  <Button size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500">
                    <CheckIcon className="h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-red-400 hover:bg-red-600/10 hover:text-red-300">
                    <XMarkIcon className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                  <span className="text-xs text-zinc-500">
                    AI-drafted content awaiting review
                  </span>
                </div>
              )}

              {/* Review comments */}
              {section.reviewComments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-zinc-400">Review Comments</h4>
                  {section.reviewComments.map((comment, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'rounded-md border px-3 py-2 text-xs',
                        comment.resolved
                          ? 'border-zinc-800 bg-zinc-800/20 text-zinc-500 line-through'
                          : 'border-amber-600/20 bg-amber-600/5 text-amber-300',
                      )}
                    >
                      {comment.content}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-zinc-700 bg-zinc-800/20 p-6 text-center">
              <p className="text-sm text-zinc-500">
                No content yet. Use the AI assistant to draft this section.
              </p>
              <Button variant="outline" size="sm" className="mt-3">
                Draft with AI
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Report Editor Chat Panel
// ============================================================

function ReportChatPanel() {
  const { messages, isLoading, suggestedActions, sendMessage } = useChatStore();
  const [inputValue, setInputValue] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-200">AI Assistant</h3>
        <p className="text-[10px] text-zinc-500">
          Ask me to draft sections, check data, or review content.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <span className="mb-2 block text-2xl">{'\uD83C\uDF3F'}</span>
              <p className="text-xs text-zinc-400">
                I can help draft report sections, verify data consistency, and suggest improvements.
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
        <div className="flex gap-1 overflow-x-auto border-t border-zinc-800 px-3 py-2 scrollbar-thin">
          {suggestedActions.map((action) => (
            <button
              key={action.action}
              type="button"
              className="shrink-0 rounded-full border border-zinc-700 bg-zinc-800/50 px-2.5 py-1 text-[10px] text-zinc-300 transition-colors hover:border-emerald-600 hover:text-emerald-400"
              onClick={() => void sendMessage(action.label)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-zinc-800 px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Draft a section, check data..."
            rows={2}
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

// ============================================================
// Report Editor Page
// ============================================================

export default function ReportEditorPage() {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(['sec-1']),
  );
  const [languageToggle, setLanguageToggle] = React.useState<'en' | 'ar'>('en');

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const completedCount = DEMO_SECTIONS.filter(
    (s) => s.status === 'approved' || s.status === 'reviewed',
  ).length;
  const draftedCount = DEMO_SECTIONS.filter((s) => s.status === 'drafted').length;

  return (
    <div className="space-y-4">
      {/* Top toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">
              {DEMO_REPORT.title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-[10px]">
                {DEMO_REPORT.status === 'draft' ? 'Draft' : DEMO_REPORT.status}
              </Badge>
              <span className="text-xs text-zinc-500">
                {completedCount}/{DEMO_SECTIONS.length} sections complete{' '}
                {'\u00B7'} {draftedCount} drafted
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            type="button"
            onClick={() => setLanguageToggle(languageToggle === 'en' ? 'ar' : 'en')}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            {languageToggle === 'en' ? 'EN' : 'AR'}
          </button>
          {/* Export buttons */}
          <Button variant="outline" size="sm" className="gap-1.5">
            <DownloadIcon className="h-3.5 w-3.5" />
            DOCX
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <DownloadIcon className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </div>

      <Separator />

      {/* Split layout */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Left panel: Report content (60%) */}
        <div className="w-[60%] overflow-y-auto space-y-2 pr-2 scrollbar-thin">
          {DEMO_SECTIONS.map((section) => (
            <SectionEditor
              key={section.id}
              section={section}
              isExpanded={expandedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>

        {/* Right panel: Agent chat (40%) */}
        <div className="w-[40%] rounded-lg border border-zinc-800 bg-zinc-900/60">
          <ReportChatPanel />
        </div>
      </div>
    </div>
  );
}
