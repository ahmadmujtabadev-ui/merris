'use client';

import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { Chip } from '@/components/merris/chip';
import { HISTORY, type HistoryEntry } from './history-data';

function confidenceVariant(c?: HistoryEntry['confidence']): 'completed' | 'in-progress' | 'draft' {
  if (c === 'High') return 'completed';
  if (c === 'Medium') return 'in-progress';
  return 'draft';
}

export function HistoryPage() {
  return (
    <div className="p-6">
      <h1 className="mb-5 font-display text-[24px] font-bold text-merris-text">History</h1>
      <div className="space-y-2.5">
        {HISTORY.map((h) => (
          <MerrisCard key={h.id} hover style={{ padding: '13px 16px', cursor: 'pointer' }}>
            <div className="flex items-start justify-between">
              <div className="font-display text-[13px] font-semibold text-merris-text">{h.text}</div>
              <span className="ml-3 font-body text-[9px] text-merris-text-tertiary">{h.time}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Chip>{h.engagement}</Chip>
              {h.confidence && (
                <Pill variant={confidenceVariant(h.confidence)} size="sm">
                  {h.confidence}
                </Pill>
              )}
              {h.findings !== undefined && h.findings > 0 && (
                <Pill variant="important" size="sm">
                  {h.findings} findings
                </Pill>
              )}
            </div>
          </MerrisCard>
        ))}
      </div>
    </div>
  );
}
