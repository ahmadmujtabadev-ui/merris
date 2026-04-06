'use client';

import { useState, useEffect, useCallback } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { api, type Engagement } from '@/lib/api';
import { useEngagementStore } from '@/lib/store';
import { EngagementCard } from './engagement-card';
import { NewEngagementModal } from './new-engagement-modal';
import { EngagementEmptyState } from './engagement-empty-state';

export function PortfolioGrid() {
  const engagements = useEngagementStore((s) => s.engagements);
  const setEngagements = useEngagementStore((s) => s.setEngagements);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listEngagements();
      setEngagements(res.engagements as unknown as Parameters<typeof setEngagements>[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load engagements');
    } finally {
      setLoading(false);
    }
  }, [setEngagements]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="mb-1 font-display text-[24px] font-bold text-merris-text">Engagements</h1>
          <p className="font-body text-[12px] text-merris-text-secondary">
            Active ESG verification and reporting cycles
          </p>
        </div>
        <MerrisButton variant="primary" onClick={() => setModalOpen(true)}>+ New Engagement</MerrisButton>
      </div>

      {loading && (
        <MerrisCard className="text-center font-body text-[12px] text-merris-text-tertiary">
          Loading engagements…
        </MerrisCard>
      )}

      {!loading && error && (
        <MerrisCard className="border-l-[3px] border-merris-error font-body text-[12px] text-merris-error">
          {error}
        </MerrisCard>
      )}

      {!loading && !error && engagements.length === 0 && (
        <EngagementEmptyState onCreate={() => setModalOpen(true)} />
      )}

      {!loading && !error && engagements.length > 0 && (
        <div className="mb-7 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(engagements as unknown as Engagement[]).map((e) => (
            <EngagementCard key={e.id} engagement={e} />
          ))}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex flex-col items-center justify-center rounded-merris border-2 border-dashed border-merris-border-medium bg-transparent p-6 transition-colors hover:bg-merris-surface-low"
          >
            <div className="text-2xl text-merris-text-tertiary">+</div>
            <div className="mt-2 font-display text-[12px] font-semibold text-merris-text">Start New</div>
          </button>
        </div>
      )}

      <NewEngagementModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => void reload()}
      />
    </div>
  );
}
