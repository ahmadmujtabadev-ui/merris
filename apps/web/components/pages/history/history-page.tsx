'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { Chip } from '@/components/merris/chip';
import { useHistoryStore } from '@/lib/store';
import { useChatStore } from '@/lib/chat-store';
import { useEngagementStore } from '@/lib/store';

function relativeTime(ts?: string): string {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export function HistoryPage() {
  const { entries, loading, fetchHistory } = useHistoryStore();
  const { setEngagementId } = useChatStore();
  const { engagements } = useEngagementStore();
  const router = useRouter();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function handleResume(entry: (typeof entries)[0]) {
    // Set engagement context then navigate to intelligence
    if (entry.engagementId) setEngagementId(entry.engagementId);
    router.push('/intelligence');
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center gap-2">
        <h1 className="font-display text-[24px] font-bold text-merris-text">History</h1>
        <Pill variant="completed" size="sm">Live</Pill>
        {loading && <span className="font-body text-[11px] text-merris-text-tertiary">Loading…</span>}
      </div>

      {entries.length === 0 && !loading && (
        <p className="font-body text-[13px] text-merris-text-secondary">
          No conversations yet. Ask a question in Intelligence to get started.
        </p>
      )}

      <div className="space-y-2.5">
        {entries.map((h) => {
          const engName = h.engagement
            ?? engagements.find((e) => e.id === h.engagementId)?.name
            ?? h.engagementId?.slice(-6);

          return (
            <MerrisCard
              key={h.id}
              hover
              style={{ padding: '13px 16px', cursor: 'pointer' }}
              onClick={() => handleResume(h)}
            >
              <div className="flex items-start justify-between">
                <div className="font-display text-[13px] font-semibold text-merris-text line-clamp-2">
                  {h.text}
                </div>
                <span className="ml-3 shrink-0 font-body text-[9px] text-merris-text-tertiary">
                  {h.time ?? relativeTime(h.timestamp)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {engName && <Chip>{engName}</Chip>}
                {h.confidence && (
                  <Pill variant={h.confidence === 'High' ? 'completed' : 'in-progress'} size="sm">
                    {h.confidence}
                  </Pill>
                )}
                {h.findings !== undefined && h.findings > 0 && (
                  <Pill variant="important" size="sm">{h.findings} findings</Pill>
                )}
                {h.toolsUsed && h.toolsUsed.length > 0 && (
                  <Pill variant="draft" size="sm">{h.toolsUsed.length} tools</Pill>
                )}
              </div>
            </MerrisCard>
          );
        })}
      </div>
    </div>
  );
}
