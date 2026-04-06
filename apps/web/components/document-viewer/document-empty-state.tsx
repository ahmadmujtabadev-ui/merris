'use client';

import Link from 'next/link';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';

export function DocumentEmptyState({ backHref, error }: { backHref: string; error?: string }) {
  return (
    <div className="p-6">
      <MerrisCard className="border-2 border-dashed border-merris-border-medium bg-transparent text-center shadow-none" style={{ padding: '48px 32px' }}>
        <div className="mb-3 text-[28px]">📄</div>
        <div className="mb-1 font-display text-[16px] font-bold text-merris-text">
          {error ?? 'Document not found'}
        </div>
        <p className="mb-4 font-body text-[12px] text-merris-text-secondary">
          {error
            ? 'The viewer could not load this document.'
            : 'This document may have been deleted or never finished processing.'}
        </p>
        <Link href={backHref}>
          <MerrisButton variant="primary">← Back to engagement</MerrisButton>
        </Link>
      </MerrisCard>
    </div>
  );
}
