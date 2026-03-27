'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CompletionDonut } from '@/components/completion-donut';
import { useAuthStore, useEngagementStore, type EngagementSummary, type EngagementStatus } from '@/lib/store';
import { t } from '@/lib/i18n';

const STATUS_VARIANTS: Record<EngagementStatus, { label: string; variant: 'default' | 'secondary' | 'warning' | 'info' | 'destructive' }> = {
  setup: { label: 'Setup', variant: 'secondary' },
  data_collection: { label: 'Data Collection', variant: 'info' },
  drafting: { label: 'Drafting', variant: 'warning' },
  review: { label: 'Review', variant: 'warning' },
  assurance: { label: 'Assurance', variant: 'info' },
  completed: { label: 'Completed', variant: 'default' },
};

// Demo data for rendering
const DEMO_ENGAGEMENTS: EngagementSummary[] = [
  {
    id: 'eng-001',
    name: 'FY2025 Sustainability Report',
    clientOrgId: 'client-001',
    frameworks: ['GRI', 'SASB', 'TCFD'],
    deadline: '2026-06-30',
    status: 'data_collection',
    completeness: 42,
  },
  {
    id: 'eng-002',
    name: 'CDP Climate Response',
    clientOrgId: 'client-002',
    frameworks: ['CDP', 'TCFD'],
    deadline: '2026-07-31',
    status: 'setup',
    completeness: 12,
  },
  {
    id: 'eng-003',
    name: 'CMA ESG Disclosure',
    frameworks: ['CMA-ESG'],
    deadline: '2026-03-31',
    status: 'review',
    completeness: 87,
  },
];

export default function EngagementsPage() {
  const { locale } = useAuthStore();
  const { engagements } = useEngagementStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading] = useState(false);

  // Use demo data if store is empty (no API connected yet)
  const displayEngagements = engagements.length > 0 ? engagements : DEMO_ENGAGEMENTS;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{t(locale, 'engagements.title')}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage your ESG engagements and track progress across frameworks.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>{t(locale, 'engagements.createNew')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t(locale, 'engagements.createNew')}</DialogTitle>
              <DialogDescription>
                Create a new ESG engagement to start collecting data and generating reports.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t(locale, 'engagements.name')}</Label>
                <Input placeholder="FY2025 Sustainability Report" />
              </div>
              <div className="space-y-2">
                <Label>{t(locale, 'engagements.client')}</Label>
                <Input placeholder="Client organization" />
              </div>
              <div className="space-y-2">
                <Label>{t(locale, 'engagements.deadline')}</Label>
                <Input type="date" />
              </div>
              <div className="space-y-2">
                <Label>{t(locale, 'engagements.frameworks')}</Label>
                <Input placeholder="GRI, SASB, TCFD" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t(locale, 'common.cancel')}
              </Button>
              <Button onClick={() => setDialogOpen(false)}>{t(locale, 'common.create')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Engagement cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-16 w-16 rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : displayEngagements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-zinc-400">{t(locale, 'engagements.noEngagements')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayEngagements.map((eng) => {
            const statusInfo = STATUS_VARIANTS[eng.status];
            return (
              <Link key={eng.id} href={`/engagements/${eng.id}`}>
                <Card className="cursor-pointer transition-colors hover:border-zinc-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{eng.name}</CardTitle>
                      <CompletionDonut value={eng.completeness ?? 0} size={48} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {eng.clientOrgId && (
                      <p className="text-sm text-zinc-400">Client: {eng.clientOrgId}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {eng.frameworks.map((fw) => (
                        <Badge key={fw} variant="outline" className="text-xs">
                          {fw}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500">
                      Deadline: {new Date(eng.deadline).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
