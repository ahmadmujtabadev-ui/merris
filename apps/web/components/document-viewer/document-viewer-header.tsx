'use client';

import Link from 'next/link';
import { Pill } from '@/components/merris/pill';

type Mode = 'edit' | 'review' | 'export';

interface Props {
  documentName: string;
  version?: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  backHref: string;
  pendingChanges: number;
}

const MODES: Array<{ key: Mode; label: string }> = [
  { key: 'edit',   label: 'Edit' },
  { key: 'review', label: 'Review' },
  { key: 'export', label: 'Export' },
];

export function DocumentViewerHeader({
  documentName,
  version,
  mode,
  onModeChange,
  backHref,
  pendingChanges,
}: Props) {
  return (
    <header className="mb-5 flex items-center gap-3">
      <Link href={backHref} className="text-merris-text-secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </Link>
      <div className="flex flex-1 items-baseline gap-2">
        <h1 className="font-display text-[18px] font-bold text-merris-text">{documentName}</h1>
        {version && (
          <Pill variant="draft" size="sm">{version}</Pill>
        )}
      </div>
      <div className="inline-flex rounded-merris-sm bg-merris-surface-low p-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onModeChange(m.key)}
            className={
              mode === m.key
                ? 'rounded-[6px] bg-merris-primary px-3 py-1 font-display text-[12px] font-semibold text-white'
                : 'px-3 py-1 font-display text-[12px] text-merris-text-secondary'
            }
          >
            {m.label}
          </button>
        ))}
      </div>
      {pendingChanges > 0 && (
        <Pill variant="important" size="sm">
          {pendingChanges} pending
        </Pill>
      )}
    </header>
  );
}
