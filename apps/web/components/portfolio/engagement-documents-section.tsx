'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { SectionLabel } from '@/components/merris/label';
import { api, type IngestedDocument } from '@/lib/api';

export function EngagementDocumentsSection({ engagementId }: { engagementId: string }) {
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .listEngagementDocuments(engagementId)
      .then((res) => {
        setDocuments(res.documents ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [engagementId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await api.uploadEngagementDocument(engagementId, file);
      // Reset the input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
      await reload();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
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
        <MerrisCard className="border-l-[3px] border-merris-error font-body text-[12px] text-merris-error">
          {error}
        </MerrisCard>
      )}
      {!loading && !error && documents.length === 0 && (
        <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">
          No documents uploaded yet.
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
