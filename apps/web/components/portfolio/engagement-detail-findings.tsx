'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';

interface Finding {
  id: string;
  severity: 'CRITICAL' | 'IMPORTANT' | 'MINOR';
  ref: string;
  title: string;
  description: string;
}

function severityStyle(severity: string) {
  if (severity === 'CRITICAL')  return 'border-merris-error  text-merris-error';
  if (severity === 'IMPORTANT') return 'border-merris-warning text-merris-warning';
  return 'border-merris-border text-merris-text-secondary';
}

export function EngagementDetailFindings({ engagementId }: { engagementId: string }) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading]   = useState(true);
  const [seeded, setSeeded]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getEngagementFindings(engagementId)
      .then((res) => {
        if (cancelled) return;
        setFindings(res.findings);
        setSeeded(res.seeded);
      })
      .catch(() => { if (!cancelled) setFindings([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [engagementId]);

  return (
    <>
      <SectionLabel>Critical Findings</SectionLabel>

      {loading && (
        <MerrisCard className="mb-5 text-center" style={{ padding: '16px' }}>
          <p className="font-body text-[11px] text-merris-text-tertiary">Loading findings…</p>
        </MerrisCard>
      )}

      {!loading && findings.length === 0 && (
        <MerrisCard className="mb-5 text-center" style={{ padding: '24px' }}>
          <p className="font-body text-[12px] text-merris-text-tertiary">
            {seeded
              ? 'No findings — all data points are confirmed.'
              : 'No findings yet. Upload documents and run an AI review to generate findings.'}
          </p>
        </MerrisCard>
      )}

      {!loading && findings.length > 0 && (
        <div className="mb-5 space-y-2">
          {findings.map((f) => (
            <MerrisCard
              key={f.id}
              className={`border-l-[3px] ${severityStyle(f.severity)}`}
              style={{ padding: '12px 16px' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="font-display text-[12px] font-semibold text-merris-text">{f.title}</div>
                  <div className="mt-0.5 font-body text-[11px] text-merris-text-secondary">{f.description}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`font-body text-[9px] font-bold uppercase tracking-wider ${severityStyle(f.severity)}`}>
                    {f.severity}
                  </div>
                  <div className="font-body text-[9px] text-merris-text-tertiary">{f.ref}</div>
                </div>
              </div>
            </MerrisCard>
          ))}
        </div>
      )}
    </>
  );
}
