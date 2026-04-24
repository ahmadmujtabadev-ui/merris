'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';

type DPStatus = 'auto_extracted' | 'user_confirmed' | 'user_edited' | 'estimated' | 'missing';

interface DataPoint {
  _id: string;
  frameworkRef: string;
  metricName: string;
  value: number | string;
  unit: string;
  period: { year: number; quarter?: number };
  status: DPStatus;
  confidence: 'high' | 'medium' | 'low';
}

function statusBadge(status: DPStatus) {
  const base = 'inline-block rounded-full px-2 py-0.5 font-body text-[9px] font-semibold uppercase';
  if (status === 'user_confirmed' || status === 'user_edited')
    return <span className={`${base} bg-merris-success-bg text-merris-success`}>Confirmed</span>;
  if (status === 'estimated')
    return <span className={`${base} bg-merris-primary-bg text-merris-primary`}>Estimated</span>;
  if (status === 'auto_extracted')
    return <span className={`${base} bg-merris-warning-bg text-merris-warning`}>Pending review</span>;
  return <span className={`${base} bg-merris-surface-high text-merris-text-tertiary`}>Missing</span>;
}

function confidenceDot(confidence: string) {
  if (confidence === 'high') return <span className="text-merris-success">●</span>;
  if (confidence === 'medium') return <span className="text-merris-warning">●</span>;
  return <span className="text-merris-error">●</span>;
}

interface Props {
  engagementId: string;
  onConfirmed?: () => void;
}

export function EngagementDataPoints({ engagementId, onConfirmed }: Props) {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<Record<string, boolean>>({});
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all');

  const reload = useCallback(() => {
    setLoading(true);
    api.listDataPoints(engagementId)
      .then((res) => setDataPoints(res.dataPoints))
      .catch(() => setDataPoints([]))
      .finally(() => setLoading(false));
  }, [engagementId]);

  useEffect(() => { reload(); }, [reload]);

  async function confirm(id: string) {
    setConfirming((p) => ({ ...p, [id]: true }));
    try {
      await api.confirmDataPoint(id);
      setDataPoints((prev) =>
        prev.map((dp) => dp._id === id ? { ...dp, status: 'user_confirmed' } : dp)
      );
      onConfirmed?.();
    } catch { /* silent */ }
    finally { setConfirming((p) => ({ ...p, [id]: false })); }
  }

  async function confirmAll() {
    const pending = dataPoints.filter((dp) => dp.status === 'auto_extracted');
    if (pending.length === 0) return;
    setConfirmingAll(true);
    try {
      await Promise.all(pending.map((dp) => api.confirmDataPoint(dp._id)));
      setDataPoints((prev) =>
        prev.map((dp) => dp.status === 'auto_extracted' ? { ...dp, status: 'user_confirmed' } : dp)
      );
      onConfirmed?.();
    } catch { /* silent */ }
    finally { setConfirmingAll(false); }
  }

  const pendingCount = dataPoints.filter((d) => d.status === 'auto_extracted').length;
  const confirmedCount = dataPoints.filter(
    (d) => d.status === 'user_confirmed' || d.status === 'user_edited' || d.status === 'estimated'
  ).length;

  const visible = dataPoints.filter((dp) => {
    if (filter === 'pending') return dp.status === 'auto_extracted';
    if (filter === 'confirmed') return dp.status === 'user_confirmed' || dp.status === 'user_edited' || dp.status === 'estimated';
    return true;
  });

  // Group by framework prefix
  const grouped: Record<string, DataPoint[]> = {};
  for (const dp of visible) {
    const fw = dp.frameworkRef.split('-')[0] ?? dp.frameworkRef;
    if (!grouped[fw]) grouped[fw] = [];
    grouped[fw]!.push(dp);
  }

  if (!loading && dataPoints.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="mb-2.5 flex items-center justify-between">
        <SectionLabel>
          Data Points
          {!loading && (
            <span className="ml-2 font-body text-[10px] font-normal text-merris-text-tertiary">
              {confirmedCount}/{dataPoints.length} confirmed
            </span>
          )}
        </SectionLabel>
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <div className="flex rounded-merris-sm bg-merris-surface-low p-0.5 text-[10px]">
            {(['all', 'pending', 'confirmed'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={filter === f
                  ? 'rounded-[4px] bg-merris-primary px-2.5 py-1 font-display font-semibold text-white capitalize'
                  : 'px-2.5 py-1 font-display text-merris-text-secondary capitalize'}
              >
                {f === 'pending' ? `Pending (${pendingCount})` : f === 'confirmed' ? `Confirmed (${confirmedCount})` : 'All'}
              </button>
            ))}
          </div>
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={confirmAll}
              disabled={confirmingAll}
              className="rounded-merris-sm bg-merris-primary px-3 py-1.5 font-body text-[10px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {confirmingAll ? 'Confirming…' : `Confirm all (${pendingCount})`}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">Loading data points…</MerrisCard>
      ) : visible.length === 0 ? (
        <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">
          {filter === 'pending' ? 'All data points confirmed.' : 'No data points found.'}
        </MerrisCard>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([fw, points]) => (
            <MerrisCard key={fw} style={{ padding: '12px 16px' }}>
              <div className="mb-2 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-primary">
                {fw}
              </div>
              <div className="space-y-0">
                {points.map((dp, i) => (
                  <div
                    key={dp._id}
                    className={`flex items-center gap-3 py-2 ${i > 0 ? 'border-t border-merris-border' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-[12px] font-semibold text-merris-text truncate">
                        {dp.metricName}
                      </div>
                      <div className="font-body text-[11px] text-merris-text-secondary">
                        {confidenceDot(dp.confidence)}{' '}
                        <span className="font-semibold text-merris-text">{dp.value}</span>{' '}
                        {dp.unit}{' '}
                        <span className="text-merris-text-tertiary">· {dp.period.year}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {statusBadge(dp.status)}
                      {dp.status === 'auto_extracted' && (
                        <button
                          type="button"
                          onClick={() => confirm(dp._id)}
                          disabled={confirming[dp._id]}
                          className="rounded-merris-sm bg-merris-primary px-2.5 py-1 font-body text-[10px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {confirming[dp._id] ? '…' : '✓ Confirm'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </MerrisCard>
          ))}
        </div>
      )}
    </div>
  );
}
