'use client';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary';

interface MerrisButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
}

export function MerrisButton({
  variant = 'primary',
  icon,
  children,
  className,
  ...rest
}: MerrisButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-merris-sm font-display transition-opacity disabled:opacity-50',
        variant === 'primary'
          ? 'bg-merris-primary text-white font-semibold text-[13px] px-[18px] py-[9px] hover:opacity-95'
          : 'bg-merris-surface text-merris-text font-medium text-[12px] px-[14px] py-[7px] border border-merris-border-medium hover:bg-merris-surface-low',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}
