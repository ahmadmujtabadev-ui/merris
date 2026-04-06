import type { ReactNode } from 'react';
import clsx from 'clsx';

interface PillProps {
  children: ReactNode;
  variant?: 'default' | 'in-progress' | 'under-review' | 'draft' | 'completed' | 'critical' | 'important' | 'minor';
  size?: 'sm' | 'md';
}

const VARIANTS: Record<NonNullable<PillProps['variant']>, string> = {
  'default':       'text-merris-primary bg-merris-primary-bg',
  'in-progress':   'text-merris-primary bg-merris-primary-bg',
  'under-review':  'text-amber-700 bg-merris-warning-bg',
  'draft':         'text-merris-text-tertiary bg-merris-surface-high',
  'completed':     'text-merris-success bg-merris-success-bg',
  'critical':      'text-merris-error bg-merris-error-bg',
  'important':     'text-merris-warning bg-merris-warning-bg',
  'minor':         'text-merris-text-tertiary bg-merris-surface-high',
};

export function Pill({ children, variant = 'default', size = 'md' }: PillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-body font-semibold uppercase tracking-wider whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-[3px] text-[11px]',
        VARIANTS[variant],
      )}
    >
      {children}
    </span>
  );
}
