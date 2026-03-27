'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/lib/store';
import { t } from '@/lib/i18n';

const FRAMEWORKS = [
  { name: 'GRI Standards 2024', compliance: 78, status: 'on_track' as const },
  { name: 'SASB (IFRS S1/S2)', compliance: 52, status: 'at_risk' as const },
  { name: 'TCFD Recommendations', compliance: 65, status: 'on_track' as const },
  { name: 'CMA ESG Disclosure', compliance: 91, status: 'complete' as const },
  { name: 'CDP Climate', compliance: 34, status: 'at_risk' as const },
];

const STATUS_MAP = {
  on_track: { label: 'On Track', variant: 'default' as const },
  at_risk: { label: 'At Risk', variant: 'warning' as const },
  complete: { label: 'Complete', variant: 'default' as const },
};

export default function CompliancePage() {
  const { locale } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{t(locale, 'nav.compliance')}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Track compliance across all active regulatory and voluntary frameworks.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Overall Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-emerald-400">72%</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Active Frameworks</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-zinc-100">{FRAMEWORKS.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-amber-400">3</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Framework Compliance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {FRAMEWORKS.map((fw) => {
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
    </div>
  );
}
