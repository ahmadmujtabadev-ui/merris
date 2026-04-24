'use client';

import { Chip } from '@/components/merris/chip';
import { useChatStore } from '@/lib/chat-store';
import { JURISDICTIONS } from '@/lib/intelligence-constants';

export function JurisdictionChips() {
  const jurisdiction = useChatStore((s) => s.jurisdiction);
  const toggle = useChatStore((s) => s.toggleJurisdiction);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {JURISDICTIONS.map((j) => (
        <Chip key={j} active={jurisdiction.includes(j)} onClick={() => toggle(j)}>
          {j}
        </Chip>
      ))}
      <span className="px-1.5 py-1 font-body text-[11px] text-merris-text-tertiary">Sector ▾</span>
      <span className="px-1.5 py-1 font-body text-[11px] text-merris-text-tertiary">Vault ▾</span>
      <span className="px-1.5 py-1 font-body text-[11px] text-merris-text-tertiary">Entity ▾</span>
    </div>
  );
}
