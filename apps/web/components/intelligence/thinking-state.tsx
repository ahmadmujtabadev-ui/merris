'use client';

import clsx from 'clsx';
import { MerrisCard } from '@/components/merris/card';
import { useChatStore } from '@/lib/chat-store';
import { merrisTokens } from '@/lib/design-tokens';

export function ThinkingState() {
  const steps = useChatStore((s) => s.thinkingSteps);

  return (
    <MerrisCard className="px-5 py-[18px]">
      {steps.map((s) => (
        <div
          key={s.step}
          className={clsx('mb-3.5 flex gap-2.5', s.status === 'pending' && 'opacity-30')}
        >
          <div
            className={clsx(
              'mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full',
              s.status === 'done' && 'bg-merris-primary',
              s.status === 'active' && 'bg-merris-primary-bg animate-pulse-soft',
              s.status === 'pending' && 'bg-merris-surface-high',
              s.status === 'failed' && 'bg-merris-error-bg',
            )}
          >
            {s.status === 'done' && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
            {s.status === 'active' && <div className="h-1.5 w-1.5 rounded-full bg-merris-primary" />}
            {s.status === 'failed' && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.error} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <div
              className={clsx(
                'font-display text-[13px] font-semibold',
                s.status === 'active' && 'text-merris-primary',
                s.status === 'failed' && 'text-merris-error',
                s.status !== 'active' && s.status !== 'failed' && 'text-merris-text',
              )}
            >
              {s.step}
            </div>
            {s.detail && s.status !== 'failed' && (
              <div className="font-mono text-[11px] text-merris-text-tertiary">{s.detail}</div>
            )}
            {s.status === 'active' && <div className="text-[11px] text-merris-primary">⋯</div>}
            {s.sources && s.sources.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {s.sources.map((src) => (
                  <span
                    key={src}
                    className="rounded-merris-sm bg-merris-surface-low px-2 py-0.5 font-body text-[10px] text-merris-text-secondary"
                  >
                    {src}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </MerrisCard>
  );
}
