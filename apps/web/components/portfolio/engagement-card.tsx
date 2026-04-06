'use client';

import Link from 'next/link';
import { MerrisCard } from '@/components/merris/card';
import { Pill } from '@/components/merris/pill';
import { Chip } from '@/components/merris/chip';
import { ScoreRing } from '@/components/merris/score-ring';
import type { Engagement } from '@/lib/api';

function statusVariant(status: string): 'in-progress' | 'under-review' | 'draft' | 'completed' | 'default' {
  const s = status.toUpperCase();
  if (s.includes('IN PROGRESS') || s === 'DRAFTING' || s === 'DATA_COLLECTION') return 'in-progress';
  if (s.includes('UNDER REVIEW') || s === 'REVIEW' || s === 'ASSURANCE') return 'under-review';
  if (s === 'DRAFT' || s === 'SETUP') return 'draft';
  if (s === 'COMPLETED') return 'completed';
  return 'default';
}

function formatDeadline(deadline?: string | null): string {
  if (!deadline) return '—';
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return deadline;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeSince(createdAt?: string): string {
  if (!createdAt) return '';
  const ms = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function EngagementCard({ engagement }: { engagement: Engagement }) {
  const completeness = typeof engagement.completeness === 'number' ? engagement.completeness : 0;
  const variant = statusVariant(engagement.status);

  return (
    <Link href={`/portfolio/${engagement.id}`} className="block">
      <MerrisCard hover>
        <div className="mb-2.5 flex items-start justify-between">
          <Pill variant={variant} size="sm">{engagement.status}</Pill>
          <ScoreRing score={completeness} size={40} />
        </div>
        <div className="mb-1.5 font-display text-[15px] font-semibold leading-snug text-merris-text">
          {engagement.name}
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {(engagement.frameworks ?? []).map((f) => (
            <Chip key={f}>{f}</Chip>
          ))}
        </div>
        <div className="flex justify-between font-body text-[10px] text-merris-text-tertiary">
          <span>Due: {formatDeadline(engagement.deadline)}</span>
          <span>{timeSince((engagement as { createdAt?: string }).createdAt)}</span>
        </div>
      </MerrisCard>
    </Link>
  );
}
