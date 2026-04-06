'use client';
import type { ReactNode } from 'react';
import clsx from 'clsx';

interface ChipProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function Chip({ children, active = false, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-body transition-colors',
        active
          ? 'bg-merris-primary text-white font-semibold'
          : 'bg-merris-surface-low text-merris-text-secondary border border-merris-border hover:border-merris-border-medium',
      )}
    >
      {children}
    </button>
  );
}
