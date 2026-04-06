'use client';

import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { merrisTokens } from '@/lib/design-tokens';
import { LIBRARY_CATEGORIES } from './firm-library-data';

export function FirmLibraryPage() {
  return (
    <div className="p-6">
      <h1 className="mb-1 font-display text-[24px] font-bold text-merris-text">Firm Library</h1>
      <p className="mb-5 font-body text-[12px] text-merris-text-secondary">
        Your organisation's templates, methodologies, and reference documents.
      </p>

      <div className="mb-5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {LIBRARY_CATEGORIES.map((c) => (
          <MerrisCard key={c.name} hover>
            <div className="mb-2.5 flex items-start justify-between">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={merrisTokens.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <Pill size="sm">{c.count} docs</Pill>
            </div>
            <div className="mb-2 font-display text-[14px] font-semibold uppercase text-merris-text">{c.name}</div>
            {c.items.map((it) => (
              <div key={it} className="py-0.5 font-body text-[11px] text-merris-text-secondary">📄 {it}</div>
            ))}
          </MerrisCard>
        ))}
      </div>

      <MerrisCard
        className="border-2 border-dashed border-merris-border-medium bg-transparent text-center shadow-none"
        style={{ padding: '32px' }}
      >
        <div className="mb-2.5 text-[28px] text-merris-text-tertiary">⬆</div>
        <div className="font-display text-[14px] font-semibold text-merris-text">
          Drop files here or click to upload
        </div>
        <div className="mt-1 font-body text-[11px] text-merris-text-tertiary">
          PDF, DOCX, XLSX (Max 50MB)
        </div>
      </MerrisCard>

      <MerrisCard className="mt-4 bg-merris-primary" style={{ padding: '16px 20px' }}>
        <div className="mb-1.5 font-display text-[14px] font-semibold text-white">Sync Shared Drive</div>
        <div className="font-body text-[11px] text-white/80">
          Connect Google Drive or SharePoint to auto-sync.
        </div>
      </MerrisCard>
    </div>
  );
}
