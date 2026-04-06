'use client';
import type { ReactNode, HTMLAttributes } from 'react';
import clsx from 'clsx';

interface MerrisCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  children: ReactNode;
}

export function MerrisCard({ hover = false, className, children, ...rest }: MerrisCardProps) {
  return (
    <div
      {...rest}
      className={clsx(
        'bg-merris-surface rounded-merris shadow-merris p-[22px]',
        hover && 'transition-shadow hover:shadow-merris-hover',
        rest.onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  );
}
