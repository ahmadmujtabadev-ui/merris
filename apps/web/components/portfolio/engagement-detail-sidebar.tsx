'use client';

import { useState } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { SectionLabel } from '@/components/merris/label';
import { api } from '@/lib/api';

interface Props {
  engagementId: string;
  engagementName: string;
}

type TerminalStatus = 'idle' | 'running' | 'done' | 'error';

function downloadBlob(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function EngagementDetailSidebar({ engagementId, engagementName }: Props) {
  const [reviewStatus, setReviewStatus] = useState<TerminalStatus>('idle');
  const [reviewMessage, setReviewMessage] = useState('');

  async function runFullReview() {
    setReviewStatus('running');
    setReviewMessage('');
    try {
      const { documents } = await api.listEngagementDocuments(engagementId);
      const unprocessed = documents.filter((d) => d.status === 'queued' || d.status === 'failed');

      if (unprocessed.length === 0) {
        setReviewMessage('All documents already processed.');
        setReviewStatus('done');
        return;
      }

      let processed = 0;
      for (const doc of unprocessed) {
        setReviewMessage(`Processing ${processed + 1}/${unprocessed.length}…`);
        await api.processDocument(doc.id);
        processed++;
      }

      setReviewMessage(`Review complete — ${processed} document${processed !== 1 ? 's' : ''} processed.`);
      setReviewStatus('done');
    } catch {
      setReviewMessage('Review failed. Please try again.');
      setReviewStatus('error');
    }
  }

  async function generateReport() {
    try {
      const [engRes, findingsRes, complianceRes, docsRes] = await Promise.all([
        api.getEngagement(engagementId),
        api.getEngagementFindings(engagementId),
        api.getEngagementFrameworkCompliance(engagementId),
        api.listEngagementDocuments(engagementId),
      ]);

      const eng = engRes.engagement;
      const lines: string[] = [
        `MERRIS ESG ENGAGEMENT REPORT`,
        `Generated: ${new Date().toLocaleString()}`,
        ``,
        `Engagement: ${eng.name}`,
        `Status: ${eng.status ?? 'DRAFT'}`,
        `Frameworks: ${(eng.frameworks ?? []).join(', ') || 'None'}`,
        `Deadline: ${eng.deadline ?? 'Not set'}`,
        `Report Readiness: ${eng.completeness ?? 0}%`,
        ``,
        `── DOCUMENTS (${docsRes.documents.length}) ──`,
        ...docsRes.documents.map((d) => `  • ${d.filename} [${d.status.toUpperCase()}]`),
        ``,
        `── FRAMEWORK COMPLIANCE ──`,
        ...complianceRes.compliance.map((c) => `  ${c.code}: ${c.percent}%`),
        ``,
        `── FINDINGS (${findingsRes.findings.length}) ──`,
        ...findingsRes.findings.map(
          (f) => `  [${f.severity}] ${f.ref} — ${f.title}\n    ${f.description}`
        ),
      ];

      const slug = engagementName.toLowerCase().replace(/\s+/g, '-');
      downloadBlob(`merris-report-${slug}.txt`, lines.join('\n'));
    } catch {
      // silent
    }
  }

  async function exportFindings() {
    try {
      const { findings } = await api.getEngagementFindings(engagementId);
      const rows = [
        ['Severity', 'Ref', 'Title', 'Description'],
        ...findings.map((f) => [f.severity, f.ref, f.title, f.description.replace(/,/g, ';')]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
      const slug = engagementName.toLowerCase().replace(/\s+/g, '-');
      downloadBlob(`merris-findings-${slug}.csv`, csv, 'text/csv');
    } catch {
      // silent
    }
  }

  const TERMINAL_ACTIONS = [
    {
      label: 'Run Full Review',
      icon: '⚡',
      onClick: runFullReview,
      loading: reviewStatus === 'running',
    },
    {
      label: 'Generate Report',
      icon: '📄',
      onClick: generateReport,
      loading: false,
    },
    {
      label: 'Export Findings',
      icon: '⬇️',
      onClick: exportFindings,
      loading: false,
    },
  ];

  return (
    <>
      <MerrisCard className="mb-3.5">
        <SectionLabel>Workflow Terminal</SectionLabel>
        {TERMINAL_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            disabled={a.loading || reviewStatus === 'running'}
            className="flex w-full items-center justify-between border-t border-merris-border py-2.5 text-left first:border-t-0 hover:opacity-80 disabled:opacity-40 disabled:cursor-wait"
          >
            <span className="flex items-center gap-2 font-display text-[12px] font-medium text-merris-text">
              <span>{a.loading ? '⏳' : a.icon}</span>
              {a.loading ? `${a.label}…` : a.label}
            </span>
            <span className="text-merris-text-tertiary">›</span>
          </button>
        ))}

        {reviewMessage && (
          <p className={`mt-2 font-body text-[10px] ${reviewStatus === 'error' ? 'text-merris-error' : 'text-merris-primary'}`}>
            {reviewMessage}
          </p>
        )}
      </MerrisCard>

      <MerrisCard>
        <SectionLabel>Team</SectionLabel>
        <p className="py-2 font-body text-[11px] text-merris-text-tertiary">
          No team members yet. Invite colleagues via Settings.
        </p>
      </MerrisCard>
    </>
  );
}
