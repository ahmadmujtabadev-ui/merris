'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore, useEngagementStore } from '@/lib/store';
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';

interface FrameworkCompliance {
  name: string;
  compliance: number;
  status: 'on_track' | 'at_risk' | 'complete';
}

interface CompletenessResponse {
  overall: number;
  byFramework: { framework: string; completed: number; total: number }[];
}

const STATUS_MAP = {
  on_track: { label: 'On Track', variant: 'default' as const },
  at_risk: { label: 'At Risk', variant: 'warning' as const },
  complete: { label: 'Complete', variant: 'default' as const },
};

function deriveStatus(compliance: number): 'on_track' | 'at_risk' | 'complete' {
  if (compliance >= 90) return 'complete';
  if (compliance >= 50) return 'on_track';
  return 'at_risk';
}

export default function CompliancePage() {
  const { locale } = useAuthStore();
  const { engagements } = useEngagementStore();
  const [frameworks, setFrameworks] = useState<FrameworkCompliance[]>([]);
  const [overallCompliance, setOverallCompliance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCompliance() {
      // Ensure token is loaded
      if (!api.getToken() && typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('merris_auth');
          if (stored) {
            const parsed = JSON.parse(stored) as { token?: string };
            if (parsed.token) api.setToken(parsed.token);
          }
        } catch { /* ignore */ }
      }

      try {
        let allFrameworks: FrameworkCompliance[] = [];
        let totalCompliance = 0;

        if (engagements.length > 0) {
          // Fetch completeness for each engagement and aggregate
          const results = await Promise.allSettled(
            engagements.map((eng) =>
              api.get<CompletenessResponse>(`/engagements/${eng.id}/completeness`)
            )
          );

          for (const result of results) {
            if (result.status === 'fulfilled' && result.value?.byFramework) {
              for (const fw of result.value.byFramework) {
                const compliance = fw.total > 0 ? Math.round((fw.completed / fw.total) * 100) : 0;
                const existing = allFrameworks.find((f) => f.name === fw.framework);
                if (existing) {
                  existing.compliance = Math.round((existing.compliance + compliance) / 2);
                  existing.status = deriveStatus(existing.compliance);
                } else {
                  allFrameworks.push({
                    name: fw.framework,
                    compliance,
                    status: deriveStatus(compliance),
                  });
                }
              }
            }
          }

          if (allFrameworks.length > 0) {
            totalCompliance = Math.round(
              allFrameworks.reduce((sum, fw) => sum + fw.compliance, 0) / allFrameworks.length
            );
          }
        }

        if (!cancelled) {
          setFrameworks(allFrameworks);
          setOverallCompliance(totalCompliance);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load compliance data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchCompliance();
    return () => { cancelled = true; };
  }, [engagements]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{t(locale, 'nav.compliance')}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Track compliance across all active regulatory and voluntary frameworks.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-1/3" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : frameworks.length === 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">Overall Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold text-zinc-500">--</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">Active Frameworks</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold text-zinc-100">0</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">Upcoming Deadlines</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold text-zinc-500">--</span>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-zinc-400">
                {error
                  ? 'No compliance data available yet. Create an engagement to start tracking.'
                  : 'No compliance data available. Create an engagement and upload documents to begin.'}
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">Overall Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold text-emerald-400">{overallCompliance}%</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">Active Frameworks</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold text-zinc-100">{frameworks.length}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">At Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold text-amber-400">
                  {frameworks.filter((fw) => fw.status === 'at_risk').length}
                </span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Framework Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {frameworks.map((fw) => {
                const status = STATUS_MAP[fw.status];
                return (
                  <div key={fw.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-200">{fw.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-400">{fw.compliance}%</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </div>
                    <Progress
                      value={fw.compliance}
                      indicatorClassName={fw.compliance < 50 ? 'bg-amber-500' : undefined}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
