'use client';

import { useEffect, useState } from 'react';
import { api, type Engagement } from '@/lib/api';
import { MerrisCard } from '@/components/merris/card';
import { EngagementDetailHeader } from './engagement-detail-header';
import { EngagementDetailReadiness } from './engagement-detail-readiness';
import { EngagementDetailFrameworks } from './engagement-detail-frameworks';
import { EngagementDetailFindings } from './engagement-detail-findings';
import { EngagementDetailSidebar } from './engagement-detail-sidebar';
import { EngagementDocumentsSection } from './engagement-documents-section';

export function EngagementDetail({ engagementId }: { engagementId: string }) {
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getEngagement(engagementId)
      .then((res) => {
        if (cancelled) return;
        setEngagement(res.engagement);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load engagement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  if (loading) {
    return (
      <div className="p-6">
        <MerrisCard className="text-center font-body text-[12px] text-merris-text-tertiary">
          Loading engagement…
        </MerrisCard>
      </div>
    );
  }
  if (error || !engagement) {
    return (
      <div className="p-6">
        <MerrisCard className="border-l-[3px] border-merris-error font-body text-[12px] text-merris-error">
          {error ?? 'Engagement not found.'}
        </MerrisCard>
      </div>
    );
  }

  const completeness = typeof engagement.completeness === 'number' ? engagement.completeness : 0;

  return (
    <div className="p-6">
      <EngagementDetailHeader engagement={engagement} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <EngagementDetailReadiness score={completeness} />
          <EngagementDetailFrameworks frameworks={engagement.frameworks ?? []} />
          <EngagementDetailFindings />
          <EngagementDocumentsSection engagementId={engagement.id} />
        </div>
        <div>
          <EngagementDetailSidebar />
        </div>
      </div>
    </div>
  );
}
