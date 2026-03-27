'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore, useEngagementStore } from '@/lib/store';
import { t } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

interface ReportListItem {
  id: string;
  title: string;
  type: string;
  status: 'draft' | 'in_review' | 'partner_approved' | 'client_approved' | 'final';
  language: string;
  frameworks: string[];
  updatedAt: string;
  sectionCount: number;
}

// ============================================================
// Demo Data
// ============================================================

const DEMO_REPORTS: ReportListItem[] = [
  {
    id: 'rpt-1',
    title: 'FY2025 GRI Sustainability Report',
    type: 'sustainability_report',
    status: 'draft',
    language: 'en',
    frameworks: ['GRI 2021'],
    updatedAt: '2026-03-25T10:30:00Z',
    sectionCount: 8,
  },
  {
    id: 'rpt-2',
    title: 'CMA ESG Annual Disclosure',
    type: 'esg_report',
    status: 'in_review',
    language: 'bilingual',
    frameworks: ['CMA ESG', 'GRI 2021'],
    updatedAt: '2026-03-24T14:15:00Z',
    sectionCount: 12,
  },
  {
    id: 'rpt-3',
    title: 'TCFD Climate Risk Assessment',
    type: 'tcfd_report',
    status: 'partner_approved',
    language: 'en',
    frameworks: ['TCFD'],
    updatedAt: '2026-03-20T09:00:00Z',
    sectionCount: 6,
  },
  {
    id: 'rpt-4',
    title: 'CDP Climate Change Response 2025',
    type: 'cdp_response',
    status: 'final',
    language: 'en',
    frameworks: ['CDP'],
    updatedAt: '2026-03-15T16:45:00Z',
    sectionCount: 15,
  },
];

// ============================================================
// Status Badge Styling
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; variant: 'secondary' | 'warning' | 'info' | 'default' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  in_review: { label: 'In Review', variant: 'warning' },
  partner_approved: { label: 'Partner Approved', variant: 'info' },
  client_approved: { label: 'Client Approved', variant: 'info' },
  final: { label: 'Final', variant: 'default' },
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  sustainability_report: 'Sustainability Report',
  esg_report: 'ESG Report',
  tcfd_report: 'TCFD Report',
  integrated_report: 'Integrated Report',
  cdp_response: 'CDP Response',
  custom: 'Custom Report',
};

// ============================================================
// SVG Icons
// ============================================================

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}

// ============================================================
// Create Report Dialog
// ============================================================

function CreateReportDialog() {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [reportType, setReportType] = React.useState('sustainability_report');
  const [language, setLanguage] = React.useState('en');
  const { engagements } = useEngagementStore();

  const handleCreate = () => {
    // In production, this would call the API
    setOpen(false);
    setTitle('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <PlusIcon className="h-4 w-4" />
          Create Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Report</DialogTitle>
          <DialogDescription>
            Set up a new ESG report for an engagement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Engagement selector */}
          <div className="space-y-2">
            <Label htmlFor="engagement">Engagement</Label>
            <select
              id="engagement"
              className="flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            >
              <option value="">Select engagement...</option>
              {engagements.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name}
                </option>
              ))}
              {engagements.length === 0 && (
                <option value="demo">Demo Engagement</option>
              )}
            </select>
          </div>

          {/* Report title */}
          <div className="space-y-2">
            <Label htmlFor="title">Report Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., FY2025 GRI Sustainability Report"
            />
          </div>

          {/* Report type */}
          <div className="space-y-2">
            <Label htmlFor="type">Report Type</Label>
            <select
              id="type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            >
              {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="bilingual">Bilingual (EN/AR)</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>
            Create Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Reports List Page
// ============================================================

export default function ReportsPage() {
  const { locale } = useAuthStore();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{t(locale, 'nav.reports')}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Generate, review, and export ESG reports across frameworks.
          </p>
        </div>
        <CreateReportDialog />
      </div>

      {/* Report List */}
      <div className="space-y-3">
        {DEMO_REPORTS.map((report) => {
          const statusConfig = STATUS_CONFIG[report.status] ?? STATUS_CONFIG['draft']!;
          return (
            <Card key={report.id} className="transition-colors hover:border-zinc-700">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-md bg-zinc-800 p-2">
                      <FileTextIcon className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        <Link
                          href={`/reports/${report.id}`}
                          className="text-zinc-100 hover:text-emerald-400 transition-colors"
                        >
                          {report.title}
                        </Link>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {REPORT_TYPE_LABELS[report.type] ?? report.type}{' '}
                        {'\u00B7'}{' '}
                        {report.language === 'bilingual'
                          ? 'EN/AR'
                          : report.language.toUpperCase()}{' '}
                        {'\u00B7'}{' '}
                        {report.sectionCount} sections
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={statusConfig.variant}>
                    {statusConfig.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {report.frameworks.map((fw) => (
                      <Badge key={fw} variant="outline" className="text-[10px]">
                        {fw}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">
                      Updated{' '}
                      {new Date(report.updatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                        title="Export as DOCX"
                      >
                        <DownloadIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/reports/${report.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
