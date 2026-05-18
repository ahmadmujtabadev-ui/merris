'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { HilReview } from '@/lib/api';

const PRIMARY = '#0b5142';

// ── Context pill ────────────────────────────────────────────────
function ContextPill({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: '#f5f8f5', border: '1px solid #e0ebe0' }}>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />}
      <span className="font-mono text-[9px] font-bold uppercase tracking-wider" style={{ color: '#7a8c7a' }}>{label}</span>
      <span className="font-mono text-[10px] font-semibold" style={{ color: '#2d4a2d' }}>{value}</span>
    </div>
  );
}

// ── Severity badge ──────────────────────────────────────────────
function SeverityBadge({ severity }: { severity?: string }) {
  const s = (severity ?? 'medium').toLowerCase();
  const cfg =
    s === 'high'   ? { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444', label: 'HIGH'   } :
    s === 'low'    ? { bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e', label: 'LOW'    } :
                     { bg: '#fffbeb', color: '#b45309', dot: '#f59e0b', label: 'MEDIUM' };
  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wider"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ── Empty/loading states ────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: '#f5f8f5', border: '2px solid #d1e0d1' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
      </div>
      <p className="font-body text-[13px]" style={{ color: '#9aa0a6' }}>{message}</p>
    </div>
  );
}

// ── Review list item ────────────────────────────────────────────
function ReviewListItem({
  review,
  isSelected,
  onClick,
}: {
  review: HilReview;
  isSelected: boolean;
  onClick: () => void;
}) {
  const age = (() => {
    const ms = Date.now() - new Date(review.createdAt).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-colors"
      style={{
        background: isSelected ? '#f0f6f0' : 'transparent',
        borderLeft: isSelected ? `3px solid ${PRIMARY}` : '3px solid transparent',
      }}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[12.5px] font-semibold text-merris-text">
              {review.nodeLabel}
            </div>
            <div className="mt-0.5 truncate font-mono text-[9px]" style={{ color: '#9aa0a6' }}>
              {review.runContext?.engagementName ?? review.engagementId.slice(-8)}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[8px] font-bold uppercase"
              style={{
                background: review.status === 'pending'  ? '#fffbeb' :
                            review.status === 'approved' ? '#f0fdf4' : '#fef2f2',
                color:      review.status === 'pending'  ? '#b45309' :
                            review.status === 'approved' ? '#15803d' : '#dc2626',
              }}
            >
              {review.status}
            </span>
            <span className="font-mono text-[9px]" style={{ color: '#c4cac4' }}>{age}</span>
          </div>
        </div>
      </div>
      <div style={{ borderBottom: '1px solid #f0f0ed' }} />
    </button>
  );
}

// ── Main page ───────────────────────────────────────────────────
export function HilReviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedId = searchParams.get('reviewId');

  const [reviews, setReviews] = useState<HilReview[]>([]);
  const [selectedReview, setSelectedReview] = useState<HilReview | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchReviews = useCallback(async () => {
    try {
      const data = await api.listHilReviews({ status: statusFilter });
      setReviews(data.reviews);

      if (preselectedId && !selectedReview) {
        const match = data.reviews.find((r) => r.reviewId === preselectedId);
        if (match) setSelectedReview(match);
        else {
          // Fetch directly even if it doesn't match the filter
          const single = await api.getHilReview(preselectedId).catch(() => null);
          if (single) setSelectedReview(single);
        }
      }
    } catch {
      // silently fail; list just shows empty
    } finally {
      setLoading(false);
    }
  }, [statusFilter, preselectedId, selectedReview]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const handleSelect = (review: HilReview) => {
    setSelectedReview(review);
    setNotes('');
    router.replace(`/workflow-agents/human-in-loop?reviewId=${review.reviewId}`, { scroll: false });
  };

  const handleApprove = async () => {
    if (!selectedReview || deciding) return;
    setDeciding(true);
    try {
      await api.approveHilReview(selectedReview.reviewId, notes || undefined);
      showToast('Review approved — workflow will continue.', true);
      setSelectedReview((r) => r ? { ...r, status: 'approved' as const, reviewNotes: notes } : r);
      setReviews((rs) => rs.map((r) => r.reviewId === selectedReview.reviewId ? { ...r, status: 'approved' as const } : r));
    } catch {
      showToast('Failed to approve. Try again.', false);
    } finally {
      setDeciding(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReview || deciding) return;
    setDeciding(true);
    try {
      await api.rejectHilReview(selectedReview.reviewId, notes || undefined);
      showToast('Review rejected — workflow has been sent back.', false);
      setSelectedReview((r) => r ? { ...r, status: 'rejected' as const, reviewNotes: notes } : r);
      setReviews((rs) => rs.map((r) => r.reviewId === selectedReview.reviewId ? { ...r, status: 'rejected' as const } : r));
    } catch {
      showToast('Failed to reject. Try again.', false);
    } finally {
      setDeciding(false);
    }
  };

  const isPending = selectedReview?.status === 'pending';

  return (
    <div className="flex h-screen flex-col" style={{ paddingLeft: 210 }}>
      {/* ── Page header ──────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center gap-4 bg-white px-6 py-4"
        style={{ borderBottom: '1px solid #e8eae8', height: 60 }}
      >
        <Link
          href="/workflow-agents"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-merris-surface-low"
          style={{ border: '1px solid #e0e2e0' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </Link>

        <div>
          <div className="font-display text-[15px] font-bold leading-tight text-merris-text">
            Human-in-the-Loop Reviews
          </div>
          <div className="font-mono text-[9px]" style={{ color: '#9aa0a6' }}>
            WORKFLOW AGENTS · HUMAN APPROVAL
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {(['pending', 'approved', 'rejected'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setStatusFilter(s); setLoading(true); }}
              className="rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors"
              style={{
                background: statusFilter === s ? PRIMARY : '#f5f5f0',
                color:      statusFilter === s ? '#fff'   : '#9aa0a6',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body: two-panel ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: review list */}
        <div
          className="flex w-[300px] shrink-0 flex-col overflow-y-auto"
          style={{ borderRight: '1px solid #e8eae8', background: '#fafaf8' }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid #f0f0ed' }}
          >
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
              Reviews
            </span>
            <span className="font-mono text-[9px] font-bold" style={{ color: '#9aa0a6' }}>
              {reviews.length}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: PRIMARY + '40', borderTopColor: PRIMARY }} />
            </div>
          ) : reviews.length === 0 ? (
            <div className="px-4 py-10 text-center font-body text-[11px]" style={{ color: '#c4cac4' }}>
              No {statusFilter} reviews
            </div>
          ) : (
            reviews.map((r) => (
              <ReviewListItem
                key={r.reviewId}
                review={r}
                isSelected={selectedReview?.reviewId === r.reviewId}
                onClick={() => handleSelect(r)}
              />
            ))
          )}
        </div>

        {/* Right: review detail */}
        {!selectedReview ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState message="Select a review from the list" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="mx-auto w-full max-w-2xl px-8 py-8">

              {/* ── "Awaiting your review" card ───────────────── */}
              <div
                className="mb-6 overflow-hidden rounded-2xl"
                style={{ border: `1.5px solid ${PRIMARY}30`, background: '#f8fcf8' }}
              >
                {/* Card header */}
                <div
                  className="flex items-center gap-3 px-6 py-4"
                  style={{ background: PRIMARY, borderBottom: `1px solid ${PRIMARY}` }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                    </svg>
                  </div>
                  <div>
                    <div className="font-display text-[14px] font-bold text-white">
                      {selectedReview.status === 'pending' ? 'Awaiting your review' : `Review ${selectedReview.status}`}
                    </div>
                    <div className="font-mono text-[9px] text-white/60 uppercase tracking-wider">
                      {selectedReview.nodeLabel} · {selectedReview.reviewId}
                    </div>
                  </div>
                  <div className="ml-auto">
                    {selectedReview.status !== 'pending' ? (
                      <span
                        className="rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase"
                        style={{
                          background: selectedReview.status === 'approved' ? '#f0fdf4' : '#fef2f2',
                          color:      selectedReview.status === 'approved' ? '#15803d' : '#dc2626',
                        }}
                      >
                        {selectedReview.status}
                      </span>
                    ) : (
                      <SeverityBadge severity={selectedReview.runContext?.severity} />
                    )}
                  </div>
                </div>

                {/* RUN CONTEXT pills */}
                <div className="flex flex-wrap gap-2 px-6 py-4" style={{ borderBottom: `1px solid ${PRIMARY}15` }}>
                  <div className="mb-1 w-full font-mono text-[8px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                    Run Context
                  </div>
                  {selectedReview.runContext?.engagementName && (
                    <ContextPill label="Engagement" value={selectedReview.runContext?.engagementName} dot="#22c55e" />
                  )}
                  {selectedReview.runContext?.jurisdiction && (
                    <ContextPill label="Jurisdiction" value={selectedReview.runContext?.jurisdiction} />
                  )}
                  {selectedReview.runContext?.severity && (
                    <ContextPill label="Severity" value={selectedReview.runContext?.severity} />
                  )}
                  {selectedReview.runContext?.triggeredBy && (
                    <ContextPill label="Triggered by" value={selectedReview.runContext?.triggeredBy} />
                  )}
                  {selectedReview.runContext?.assignedTo && (
                    <ContextPill label="Assigned to" value={selectedReview.runContext?.assignedTo} />
                  )}
                  <ContextPill label="Execution" value={selectedReview.executionId.slice(-8)} />
                </div>

                {/* Agent output — INTERIM FINDING */}
                <div className="px-6 py-5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-[8px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                      Interim Finding
                    </span>
                    <div className="h-px flex-1" style={{ background: '#e8eae8' }} />
                    <span className="font-mono text-[8px]" style={{ color: '#c4cac4' }}>
                      {selectedReview.agentOutput.split(/\s+/).length} words
                    </span>
                  </div>
                  <div
                    className="max-h-64 overflow-y-auto rounded-xl p-4"
                    style={{ background: '#fff', border: '1px solid #e8eae8' }}
                  >
                    <p className="font-body text-[12.5px] leading-relaxed text-merris-text whitespace-pre-wrap">
                      {selectedReview.agentOutput || 'No agent output captured.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── YOUR DECISION ──────────────────────────────── */}
              {isPending ? (
                <div className="rounded-2xl bg-white p-6" style={{ border: '1.5px solid #e8eae8' }}>
                  <div className="mb-4">
                    <div className="mb-1.5 font-mono text-[8px] font-bold uppercase tracking-widest" style={{ color: '#9aa0a6' }}>
                      Your Decision
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Add a note for the agent — reasoning will be incorporated into the next step…"
                      className="w-full resize-none rounded-xl p-3.5 font-body text-[12.5px] leading-relaxed text-merris-text outline-none placeholder:text-gray-300"
                      style={{
                        border: '1.5px solid #e0e2e0',
                        background: '#fafaf8',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e0e2e0'; }}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={deciding}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-display text-[13px] font-semibold transition-colors disabled:opacity-50"
                      style={{ border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#dc2626' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                      Reject · send back
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={deciding}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-display text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ background: PRIMARY }}
                    >
                      {deciding ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                      )}
                      Approve · continue run
                    </button>
                  </div>
                </div>
              ) : (
                /* Decided state */
                <div
                  className="rounded-2xl p-5"
                  style={{
                    border: `1.5px solid ${selectedReview.status === 'approved' ? '#bbf7d0' : '#fecaca'}`,
                    background: selectedReview.status === 'approved' ? '#f0fdf4' : '#fef2f2',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: selectedReview.status === 'approved' ? '#16a34a' : '#dc2626' }}
                    >
                      {selectedReview.status === 'approved' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      )}
                    </div>
                    <div>
                      <div
                        className="font-display text-[13px] font-bold"
                        style={{ color: selectedReview.status === 'approved' ? '#15803d' : '#dc2626' }}
                      >
                        {selectedReview.status === 'approved' ? 'Approved — workflow continuing' : 'Rejected — workflow sent back'}
                      </div>
                      {selectedReview.reviewNotes && (
                        <p className="mt-0.5 font-body text-[11px]" style={{ color: '#5f6368' }}>
                          {selectedReview.reviewNotes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* ── Toast ────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 flex items-center gap-2.5 rounded-xl px-4 py-3 font-display text-[12px] font-semibold text-white shadow-lg transition-opacity"
          style={{ background: toast.ok ? '#15803d' : '#dc2626', zIndex: 200 }}
        >
          {toast.ok ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
