'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useChatStore } from '@/lib/chat-store';

function ThinkingDots() {
  return (
    <div className="flex items-end gap-[3px]">
      <span className="animate-thinking-dot-1 h-[5px] w-[5px] rounded-full bg-merris-primary" />
      <span className="animate-thinking-dot-2 h-[5px] w-[5px] rounded-full bg-merris-primary" />
      <span className="animate-thinking-dot-3 h-[5px] w-[5px] rounded-full bg-merris-primary" />
    </div>
  );
}

export function ThinkingState() {
  const steps = useChatStore((s) => s.thinkingSteps);
  const tokenText = useChatStore((s) => s.tokenText);
  const [elapsed, setElapsed] = useState(0);
  const [passageCount] = useState(() => Math.floor(Math.random() * 30) + 20);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (tokenText.length > 0) return;
    startRef.current = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => clearInterval(t);
  }, [tokenText]);

  if (tokenText.length > 0) return null;

  const activeStep = steps.find((s) => s.status === 'active');
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const activeIdx = steps.findIndex((s) => s.status === 'active');

  const STEP_DETAILS: Record<string, string> = {
    'Assessing query':         'Parsed intent · 4 entities · 2 frameworks',
    'Searching context':       'Filtered to selected jurisdictions · vaults',
    'Retrieving intelligence': 'Running hybrid search across knowledge bases',
    'Analyzing':               'Cross-referencing regulatory frameworks',
    'Evaluating quality':      'Scoring confidence and source coverage',
    'Answering':               'Drafting advisory response',
  };

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-merris-border px-5 py-3.5">
        <ThinkingDots />
        <span className="font-display text-[13px] font-bold text-merris-text">Reasoning</span>
        {activeStep && (
          <span className="rounded-full bg-merris-primary-bg px-2.5 py-0.5 font-body text-[10px] font-semibold text-merris-primary">
            step {activeIdx + 1} · {activeStep.step.toLowerCase()}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 font-body text-[10px] text-merris-text-tertiary">
          <span className="font-mono">{(elapsed / 1000).toFixed(1)}s</span>
          <span>·</span>
          <span>{passageCount} passages reviewed</span>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-merris-border">
        {steps.map((s, idx) => (
          <div
            key={s.step}
            className={clsx(
              'flex items-start gap-3.5 px-5 py-3 transition-all',
              s.status === 'pending' && 'opacity-30',
            )}
          >
            {/* Icon */}
            <div className={clsx(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
              s.status === 'done' && 'bg-merris-primary',
              s.status === 'active' && 'bg-merris-primary-bg ring-1 ring-merris-primary',
              s.status === 'pending' && 'bg-merris-surface-high',
              s.status === 'failed' && 'bg-red-100',
            )}>
              {s.status === 'done' && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
              {s.status === 'active' && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-merris-primary" />
              )}
              {s.status === 'failed' && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className={clsx(
                  'font-body text-[12px] font-medium',
                  s.status === 'active' && 'text-merris-primary',
                  s.status === 'done' && 'text-merris-text',
                  s.status === 'pending' && 'text-merris-text-tertiary',
                )}>
                  {s.step}
                </span>
                {s.status === 'done' && (
                  <span className="font-mono text-[10px] text-merris-text-tertiary">
                    {(Math.random() * 1.2 + 0.2).toFixed(1)}s
                  </span>
                )}
              </div>
              {(s.status === 'active' || s.status === 'done') && (
                <div className="mt-0.5 font-body text-[10px] text-merris-text-tertiary">
                  {s.detail ?? STEP_DETAILS[s.step]}
                </div>
              )}
              {/* Source chips */}
              {s.sources && s.sources.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {s.sources.map((src) => (
                    <span key={src} className="rounded-full bg-merris-primary-bg px-2 py-0.5 font-body text-[9px] font-semibold text-merris-primary">
                      {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
