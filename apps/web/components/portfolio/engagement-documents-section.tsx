'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';
import { api, type IngestedDocument } from '@/lib/api';

export function EngagementDocumentsSection({ engagementId }: { engagementId: string }) {
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listEngagementDocuments(engagementId)
      .then((res) => {
        if (cancelled) return;
        setDocuments(res.documents ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  return (
    <div className="mt-5">
      <SectionLabel>Documents</SectionLabel>
      {loading && (
        <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">Loading documents…</MerrisCard>
      )}
      {!loading && error && (
        <MerrisCard className="border-l-[3px] border-merris-error font-body text-[12px] text-merris-error">
          {error}
        </MerrisCard>
      )}
      {!loading && !error && documents.length === 0 && (
        <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">
          No documents uploaded yet. Use the Word add-in or the upload endpoint to add reports.
        </MerrisCard>
      )}
      {!loading && !error && documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((d) => (
            <Link key={d.id} href={`/portfolio/${engagementId}/documents/${d.id}`} className="block">
              <MerrisCard hover style={{ padding: '12px 16px' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[16px]">📄</span>
                  <div className="flex-1 font-display text-[13px] font-semibold text-merris-text">{d.filename}</div>
                  <span className="font-body text-[10px] uppercase text-merris-text-tertiary">{d.format}</span>
                </div>
              </MerrisCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
