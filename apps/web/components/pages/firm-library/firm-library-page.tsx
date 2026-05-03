'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { api, type VaultDocument, type VaultSearchResult } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const CLASSIFICATION_COLORS: Record<string, string> = {
  methodology: 'info',
  sop: 'default',
  report: 'success',
  working_paper: 'warning',
  reference: 'default',
  email: 'default',
  unknown: 'default',
};

const STATUS_VARIANTS: Record<string, string> = {
  indexed: 'success',
  queued: 'default',
  parsing: 'warning',
  chunking: 'warning',
  embedding: 'warning',
  failed: 'critical',
};

export function FirmLibraryPage() {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VaultSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);
  const workspaceId = user?.orgId || '';

  const loadDocuments = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const res = await api.listVaultDocuments(workspaceId);
      setDocuments(res.documents);
      setTotal(res.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !workspaceId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await api.uploadVaultDocument(workspaceId, file);
      }
      await loadDocuments();
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !workspaceId) return;
    setSearching(true);
    try {
      const res = await api.searchVault(workspaceId, { query: searchQuery, limit: 10 });
      setSearchResults(res.results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!workspaceId) return;
    try {
      await api.deleteVaultDocument(workspaceId, docId);
      await loadDocuments();
    } catch {
      // silent
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-6">
      <h1 className="mb-1 font-display text-[24px] font-bold text-merris-text">Firm Vault</h1>
      <p className="mb-5 font-body text-[12px] text-merris-text-secondary">
        Your organisation&apos;s methodologies, working documents, SOPs, and reference materials.
        {total > 0 && ` ${total} documents indexed.`}
      </p>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Search vault documents..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!e.target.value.trim()) setSearchResults(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 rounded-md border border-merris-border-medium px-3 py-2 font-body text-[13px] text-merris-text placeholder:text-merris-text-tertiary focus:border-merris-primary focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !searchQuery.trim()}
          className="rounded-md bg-merris-primary px-4 py-2 font-display text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-[13px] font-semibold text-merris-text">
              Search Results ({searchResults.length})
            </span>
            <button
              onClick={() => { setSearchResults(null); setSearchQuery(''); }}
              className="font-body text-[11px] text-merris-primary hover:underline"
            >
              Clear
            </button>
          </div>
          {searchResults.length === 0 ? (
            <MerrisCard><p className="font-body text-[12px] text-merris-text-secondary">No results found.</p></MerrisCard>
          ) : (
            <div className="space-y-2">
              {searchResults.map((r) => (
                <MerrisCard key={r.chunkId}>
                  <div className="mb-1 flex items-center gap-2">
                    <Pill size="sm" variant="info">p.{r.page}</Pill>
                    {r.section && <span className="font-body text-[10px] text-merris-text-tertiary">{r.section}</span>}
                    <span className="ml-auto font-mono text-[10px] text-merris-text-tertiary">{(r.score * 100).toFixed(0)}%</span>
                  </div>
                  <p className="font-body text-[12px] text-merris-text leading-relaxed">{r.content.slice(0, 300)}{r.content.length > 300 ? '...' : ''}</p>
                </MerrisCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Zone */}
      <MerrisCard
        className="mb-5 cursor-pointer border-2 border-dashed border-merris-border-medium bg-transparent text-center shadow-none hover:border-merris-primary"
        style={{ padding: '32px' }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e: React.DragEvent) => e.preventDefault()}
        onDrop={(e: React.DragEvent) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.pptx,.csv,.txt,.md,.eml,.png,.jpg,.jpeg,.tiff"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        {uploading ? (
          <div className="font-display text-[14px] font-semibold text-merris-primary">Uploading...</div>
        ) : (
          <>
            <div className="mb-2.5 text-[28px] text-merris-text-tertiary">+</div>
            <div className="font-display text-[14px] font-semibold text-merris-text">
              Drop files here or click to upload
            </div>
            <div className="mt-1 font-body text-[11px] text-merris-text-tertiary">
              PDF, DOCX, XLSX, PPTX, CSV, images (Max 50MB)
            </div>
          </>
        )}
      </MerrisCard>

      {/* Document List */}
      {loading ? (
        <p className="font-body text-[12px] text-merris-text-secondary">Loading documents...</p>
      ) : documents.length === 0 ? (
        <MerrisCard>
          <p className="text-center font-body text-[12px] text-merris-text-secondary">
            No documents in your vault yet. Upload files to get started.
          </p>
        </MerrisCard>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <MerrisCard key={doc.id} hover>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-display text-[13px] font-semibold text-merris-text">{doc.filename}</span>
                    <Pill size="sm" variant={CLASSIFICATION_COLORS[doc.classification] as any || 'default'}>
                      {doc.classification}
                    </Pill>
                    <Pill size="sm" variant={STATUS_VARIANTS[doc.status] as any || 'default'}>
                      {doc.status}
                    </Pill>
                  </div>
                  <div className="flex gap-4 font-body text-[11px] text-merris-text-tertiary">
                    <span>{doc.format.toUpperCase()}</span>
                    <span>{formatSize(doc.size)}</span>
                    {doc.pageCount && <span>{doc.pageCount} pages</span>}
                    {doc.chunkCount > 0 && <span>{doc.chunkCount} chunks</span>}
                    <span>v{doc.version}</span>
                    <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                  className="ml-4 rounded px-2 py-1 font-body text-[11px] text-merris-text-tertiary hover:bg-red-50 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </MerrisCard>
          ))}
        </div>
      )}
    </div>
  );
}
