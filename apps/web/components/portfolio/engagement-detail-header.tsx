'use client';

import Link from 'next/link';
import { Pill } from '@/components/merris/pill';
import type { Engagement } from '@/lib/api';

function statusVariant(status: string): 'in-progress' | 'under-review' | 'draft' | 'completed' | 'default' {
  const s = status.toUpperCase();
  if (s.includes('IN PROGRESS')) return 'in-progress';
  if (s.includes('UNDER REVIEW') || s === 'REVIEW') return 'under-review';
  if (s === 'DRAFT') return 'draft';
  if (s === 'COMPLETED') return 'completed';
  return 'default';
}

export function EngagementDetailHeader({ engagement }: { engagement: Engagement }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <Link href="/portfolio" className="cursor-pointer text-merris-text-secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </Link>
      <h1 className="flex-1 font-display text-[18px] font-bold text-merris-text">{engagement.name}</h1>
      <Pill variant={statusVariant(engagement.status)} size="sm">{engagement.status}</Pill>
    </div>
  );
}
