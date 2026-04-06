import type { ReactNode } from 'react';

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-merris-primary mb-3.5">
      {children}
    </div>
  );
}
