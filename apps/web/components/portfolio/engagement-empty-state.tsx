'use client';

import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';

export function EngagementEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <MerrisCard className="border-2 border-dashed border-merris-border-medium bg-transparent text-center shadow-none" style={{ padding: '48px 32px' }}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-merris-surface-low text-2xl">
        📁
      </div>
      <div className="mb-1 font-display text-[16px] font-bold text-merris-text">No engagements yet</div>
      <p className="mb-4 font-body text-[12px] text-merris-text-secondary">
        Create your first engagement to start ingesting data, drafting disclosures, and running reviews.
      </p>
      <MerrisButton variant="primary" onClick={onCreate}>+ New Engagement</MerrisButton>
    </MerrisCard>
  );
}
