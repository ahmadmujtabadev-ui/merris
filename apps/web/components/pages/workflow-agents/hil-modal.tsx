'use client';

import { useState } from 'react';

export interface HILContext {
  executionId: string;
  agentName: string;
  nodeLabel: string;
  /** Steps completed so far */
  completedSteps: number;
  totalSteps: number;
  /** The agent's draft output for review */
  agentOutput: string;
  /** Engagement / run info pips */
  engagementName?: string;
}

interface HILModalProps {
  context: HILContext;
  onApprove: (notes: string) => void;
  onReject: (notes: string) => void;
  onClose: () => void;
}

/**
 * Human-in-the-Loop review modal.
 * Shows the agent's draft output and asks the reviewer to approve or reject.
 * The backend pauses execution at a "human-in-loop" node until a decision is made.
 */
export function HILModal({ context, onApprove, onReject, onClose }: HILModalProps) {
  const [notes, setNotes] = useState('');
  const [deciding, setDeciding] = useState(false);

  const progressPct = Math.round((context.completedSteps / Math.max(context.totalSteps, 1)) * 100);

  const handleApprove = async () => {
    setDeciding(true);
    try { await Promise.resolve(onApprove(notes)); } finally { setDeciding(false); }
  };

  const handleReject = async () => {
    setDeciding(true);
    try { await Promise.resolve(onReject(notes)); } finally { setDeciding(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl">

        {/* Amber header */}
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                </div>
                <span className="font-display text-[14px] font-bold text-amber-900">Human Review Required</span>
              </div>
              <p className="mt-1 font-body text-[11px] text-amber-700">
                Agent <strong>{context.agentName}</strong> has paused at <strong>{context.nodeLabel}</strong> and needs your approval to continue.
              </p>
            </div>
            <button type="button" onClick={onClose} className="ml-3 text-amber-400 hover:text-amber-600">✕</button>
          </div>
        </div>

        {/* Run context pips */}
        <div className="flex items-center gap-4 border-b border-gray-100 bg-gray-50 px-6 py-2">
          {context.engagementName && (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono text-[9px] text-gray-500">{context.engagementName}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-gray-500">
              {context.completedSteps}/{context.totalSteps} steps
            </span>
          </div>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="font-mono text-[9px] font-semibold text-amber-600">{progressPct}%</span>
        </div>

        <div className="p-6">
          {/* Agent output card */}
          <div className="mb-4">
            <div className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-gray-400">Agent Output</div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-serif text-[13px] font-normal leading-relaxed text-gray-800 whitespace-pre-wrap">
                {context.agentOutput}
              </p>
            </div>
          </div>

          {/* Decision notes */}
          <div className="mb-5">
            <label className="mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-widest text-gray-400">
              Decision Notes <span className="font-body normal-case text-gray-300">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add context for your decision — the agent will incorporate this into the next step…"
              className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 font-body text-[12px] text-gray-800 outline-none placeholder:text-gray-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={deciding}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 py-2.5 font-display text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              Reject
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={deciding}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 font-display text-[13px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              Approve &amp; Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
