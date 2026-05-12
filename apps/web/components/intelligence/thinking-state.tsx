'use client';

import clsx from 'clsx';
import { useChatStore } from '@/lib/chat-store';

function ThinkingDots() {
  return (
    <div className="flex items-end gap-[3px] pb-[1px]">
      <span className="animate-thinking-dot-1 h-[5px] w-[5px] rounded-full bg-merris-primary" />
      <span className="animate-thinking-dot-2 h-[5px] w-[5px] rounded-full bg-merris-primary" />
      <span className="animate-thinking-dot-3 h-[5px] w-[5px] rounded-full bg-merris-primary" />
    </div>
  );
}

export function ThinkingState() {
  const steps = useChatStore((s) => s.thinkingSteps);
  const tokenText = useChatStore((s) => s.tokenText);

  // Collapse once streaming begins — AdvisoryResponse takes over
  if (tokenText.length > 0) return null;

  const activeStep = steps.find((s) => s.status === 'active');

  return (
    <div className="overflow-hidden rounded-merris border border-merris-border bg-merris-surface shadow-merris">
      {/* ── Animated header ── */}
      <div className="flex items-center gap-2.5 border-b border-merris-border bg-merris-surface px-4 py-3">
        <ThinkingDots />
        <span className="font-display text-[12px] font-semibold text-merris-primary">
          {activeStep?.step ?? 'Processing'}
        </span>
        {activeStep?.detail && (
          <span className="ml-auto max-w-[200px] truncate font-mono text-[10px] text-merris-text-tertiary">
            {activeStep.detail}
          </span>
        )}
      </div>

      {/* ── Step list ── */}
      <div className="px-4 py-3.5 space-y-[9px]">
        {steps.map((s) => (
          <div
            key={s.step}
            className={clsx(
              'flex items-center gap-2.5 transition-all duration-300',
              s.status === 'pending' && 'opacity-20',
            )}
          >
            {/* Status dot / icon */}
            <div
              className={clsx(
                'flex h-[16px] w-[16px] flex-shrink-0 items-center justify-center rounded-full',
                s.status === 'done' && 'bg-merris-primary',
                s.status === 'active' && 'bg-merris-primary-bg',
                s.status === 'pending' && 'bg-merris-surface-high',
                s.status === 'failed' && 'bg-merris-error-bg',
              )}
            >
              {s.status === 'done' && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
              {s.status === 'active' && (
                <span className="h-[5px] w-[5px] rounded-full bg-merris-primary animate-pulse-soft" />
              )}
              {s.status === 'failed' && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              )}
            </div>

            {/* Step label */}
            <span
              className={clsx(
                'font-body text-[12px] leading-none',
                s.status === 'active' && 'font-medium text-merris-primary',
                s.status === 'done' && 'text-merris-text-secondary',
                s.status === 'pending' && 'text-merris-text-tertiary',
                s.status === 'failed' && 'text-merris-error',
              )}
            >
              {s.step}
            </span>

            {/* Source chips */}
            {s.sources && s.sources.length > 0 && (
              <div className="ml-1 flex flex-wrap gap-1">
                {s.sources.map((src) => (
                  <span
                    key={src}
                    className="rounded-full bg-merris-primary-bg px-2 py-0.5 font-body text-[9px] font-semibold text-merris-primary"
                  >
                    {src}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
