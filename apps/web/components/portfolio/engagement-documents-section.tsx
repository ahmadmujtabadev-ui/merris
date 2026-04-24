'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { SectionLabel } from '@/components/merris/label';
import { api, type IngestedDocument } from '@/lib/api';

function statusBadge(status: string) {
  if (status === 'ingested')   return <span className="rounded-full bg-merris-primary-bg px-2 py-0.5 font-body text-[9px] font-semibold uppercase text-merris-primary">Ingested</span>;
  if (status === 'processing') return <span className="rounded-full bg-merris-warning-bg px-2 py-0.5 font-body text-[9px] font-semibold uppercase text-merris-warning">Processing…</span>;
  if (status === 'failed')     return <span className="rounded-full bg-merris-error-bg px-2 py-0.5 font-body text-[9px] font-semibold uppercase text-merris-error">Failed</span>;
  return <span className="rounded-full bg-merris-surface-high px-2 py-0.5 font-body text-[9px] font-semibold uppercase text-merris-text-tertiary">Queued</span>;
}

export function EngagementDocumentsSection({ engagementId }: { engagementId: string }) {
  const [documents, setDocuments]     = useState<IngestedDocument[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processing, setProcessing]   = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .listEngagementDocuments(engagementId)
      .then((res) => setDocuments(res.documents ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, [engagementId]);

  useEffect(() => { void reload(); }, [reload]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await api.uploadEngagementDocument(engagementId, file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await reload();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = async (docId: string) => {
    setProcessing((p) => ({ ...p, [docId]: true }));
    try {
      await api.processDocument(docId);
      await reload();
    } catch (err) {
      console.error('Process failed', err);
    } finally {
      setProcessing((p) => ({ ...p, [docId]: false }));
    }
  };

  return (
    <div className="mt-5">
      <div className="mb-2.5 flex items-center justify-between">
        <SectionLabel>Documents</SectionLabel>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.pptx,.txt,.md"
            onChange={handleFileSelected}
            className="hidden"
          />
          <MerrisButton
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : '+ Upload document'}
          </MerrisButton>
        </div>
      </div>

      {uploadError && (
        <MerrisCard className="mb-2 border-l-[3px] border-merris-error font-body text-[12px] text-merris-error">
          {uploadError}
        </MerrisCard>
      )}

      {loading && (
        <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">Loading documents…</MerrisCard>
      )}
      {!loading && error && (
        <MerrisCard className="border-l-[3px] border-merris-error font-body text-[12px] text-merris-error">{error}</MerrisCard>
      )}
      {!loading && !error && documents.length === 0 && (
        <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">No documents uploaded yet.</MerrisCard>
      )}

      {!loading && !error && documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((d) => (
            <MerrisCard key={d.id} style={{ padding: '12px 16px' }}>
              <div className="flex items-center gap-2">
                <span className="text-[16px]">📄</span>
                <Link href={`/portfolio/${engagementId}/documents/${d.id}`} className="flex-1">
                  <div className="font-display text-[13px] font-semibold text-merris-text hover:text-merris-primary">
                    {d.filename}
                  </div>
                </Link>
                <span className="font-body text-[10px] uppercase text-merris-text-tertiary">{d.format}</span>
                {statusBadge(d.status)}
                {(d.status === 'queued' || d.status === 'failed') && (
                  <button
                    onClick={() => handleProcess(d.id)}
                    disabled={processing[d.id]}
                    className="rounded-merris-sm bg-merris-primary px-3 py-1 font-body text-[10px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {processing[d.id] ? 'Processing…' : 'Process'}
                  </button>
                )}
              </div>
            </MerrisCard>
          ))}
        </div>
      )}
    </div>
  );
}
