'use client';

import { useEffect } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { Chip } from '@/components/merris/chip';
import { Pill } from '@/components/merris/pill';
import { useEngagementStore, useComplianceStore } from '@/lib/store';

function statusColor(status: string): string {
  if (status === 'Complete') return 'text-merris-success';
  if (status === 'Gap') return 'text-merris-error';
  return 'text-merris-warning';
}

function coverageColor(coverage: string): string {
  const n = parseInt(coverage, 10);
  if (n > 60) return 'text-merris-primary';
  if (n > 30) return 'text-merris-warning';
  return 'text-merris-error';
}

const FW_DISPLAY: Record<string, string> = {
  UNCLASSIFIED: 'Unclassified', GRI: 'GRI', TCFD: 'TCFD', ISSB: 'ISSB', CSRD: 'CSRD',
  SASB: 'SASB', IFRS: 'IFRS', CDP: 'CDP', TNFD: 'TNFD', SFDR: 'SFDR', ESRS: 'ESRS',
  PARIS: 'Paris Agreement', REGULATION: 'EU Regulation', EU: 'EU Taxonomy',
  SEC: 'SEC', ISO: 'ISO', UN: 'UN Framework', SDG: 'SDGs',
};

function cleanFrameworkRef(ref: string): string {
  const upper = ref.toUpperCase();
  if (FW_DISPLAY[upper]) return FW_DISPLAY[upper];
  const firstWord = upper.split(/[\s\-]/)[0];
  if (firstWord && FW_DISPLAY[firstWord]) return `${FW_DISPLAY[firstWord]} ${ref.split(/[\s\-]/)[1] ?? ''}`.trim();
  return ref.length > 22 ? ref.slice(0, 20) + '…' : ref;
}

export function CompliancePage() {
  const currentEngagement = useEngagementStore((s) => s.currentEngagement);
  const { frameworks, disclosureMatrix, loading, fetchCompliance } = useComplianceStore();

  useEffect(() => {
    if (currentEngagement?.id) fetchCompliance(currentEngagement.id);
  }, [currentEngagement?.id, fetchCompliance]);

  const isLive = frameworks.length > 0;
  const hasEngagement = Boolean(currentEngagement?.id);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center gap-2">
        <h1 className="font-display text-[24px] font-bold text-merris-text">Compliance Tracker</h1>
        {isLive ? (
          <Pill variant="completed" size="sm">Live</Pill>
        ) : (
          <Pill variant="draft" size="sm">No data yet</Pill>
        )}
        {loading && <span className="font-body text-[11px] text-merris-text-tertiary">Loading…</span>}
      </div>

      {!hasEngagement && (
        <MerrisCard className="mb-5 text-center" style={{ padding: '32px' }}>
          <p className="font-body text-[13px] text-merris-text-secondary">
            Select an engagement from the top bar to see compliance data.
          </p>
        </MerrisCard>
      )}

      {hasEngagement && !loading && !isLive && (
        <MerrisCard className="mb-5 text-center" style={{ padding: '32px' }}>
          <p className="font-display text-[15px] font-semibold text-merris-text">No compliance data yet</p>
          <p className="mt-1 font-body text-[12px] text-merris-text-secondary">
            Upload documents in Portfolio and click <strong>Process</strong> to extract data points.
            Compliance percentages will appear here automatically.
          </p>
        </MerrisCard>
      )}

      {isLive && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {frameworks.map((f) => (
              <MerrisCard key={f.code}>
                <div className="mb-2 font-body text-[9px] font-semibold tracking-wider text-merris-primary">{f.code}</div>
                <div className="font-display text-[26px] font-bold text-merris-text">{f.percent}%</div>
                <div className="my-2 h-[3px] rounded-full bg-merris-surface-low">
                  <div
                    className={`h-full rounded-full ${f.percent > 60 ? 'bg-merris-primary' : 'bg-merris-warning'}`}
                    style={{ width: `${f.percent}%` }}
                  />
                </div>
              </MerrisCard>
            ))}
          </div>

          <MerrisCard>
            <div className="mb-3.5 font-display text-[15px] font-semibold text-merris-text">Disclosure Matrix</div>
            {disclosureMatrix.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 items-center gap-2 border-t border-merris-border py-2.5 font-display text-[12px] md:grid-cols-[2fr_1fr_1fr_1fr]"
              >
                <span className="font-medium text-merris-text">{row.requirement}</span>
                <Chip>{cleanFrameworkRef(row.framework)}</Chip>
                <span className={`font-semibold text-[11px] ${statusColor(row.status)}`}>{row.status}</span>
                <span className={`font-semibold ${coverageColor(row.coverage)}`}>{row.coverage}</span>
              </div>
            ))}
          </MerrisCard>
        </>
      )}
    </div>
  );
}
