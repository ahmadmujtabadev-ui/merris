'use client';

import { useState, useEffect } from 'react';
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
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';

const STATUS_VARIANTS: Record<EngagementStatus, { label: string; variant: 'default' | 'secondary' | 'warning' | 'info' | 'destructive' }> = {
  setup: { label: 'Setup', variant: 'secondary' },
  data_collection: { label: 'Data Collection', variant: 'info' },
  drafting: { label: 'Drafting', variant: 'warning' },
  review: { label: 'Review', variant: 'warning' },
  assurance: { label: 'Assurance', variant: 'info' },
  completed: { label: 'Completed', variant: 'default' },
};

export default function EngagementsPage() {
  const { locale } = useAuthStore();
  const { engagements, setEngagements } = useEngagementStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEngagements() {
      try {
        // Ensure token is loaded from localStorage
        if (!api.getToken()) {
          const stored = typeof window !== 'undefined' ? localStorage.getItem('merris_auth') : null;
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as { token?: string };
              if (parsed.token) api.setToken(parsed.token);
            } catch { /* ignore */ }
          }
        }

        const data = await api.get<EngagementSummary[]>('/engagements');
        if (!cancelled) {
          setEngagements(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          // API may not exist yet -- show empty state
          setError(err instanceof Error ? err.message : 'Failed to load engagements');
          setEngagements([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchEngagements();
    return () => { cancelled = true; };
  }, [setEngagements]);

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
      ) : error && engagements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-zinc-400">No engagements yet. Create your first engagement to get started.</p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              {t(locale, 'engagements.createNew')}
            </Button>
          </CardContent>
        </Card>
      ) : engagements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-zinc-400">{t(locale, 'engagements.noEngagements')}</p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              {t(locale, 'engagements.createNew')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {engagements.map((eng) => {
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
