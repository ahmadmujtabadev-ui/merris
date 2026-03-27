'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { t } from '@/lib/i18n';

const DEMO_REPORTS = [
  { id: 'rpt-1', title: 'FY2025 GRI Sustainability Report', status: 'draft', type: 'sustainability_report', language: 'en' },
  { id: 'rpt-2', title: 'CMA ESG Annual Disclosure', status: 'in_review', type: 'esg_report', language: 'bilingual' },
];

export default function ReportsPage() {
  const { locale } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{t(locale, 'nav.reports')}</h1>
          <p className="mt-1 text-sm text-zinc-400">Generate and manage ESG reports.</p>
        </div>
        <Button>Generate Report</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DEMO_REPORTS.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{report.title}</CardTitle>
                <Badge variant={report.status === 'draft' ? 'secondary' : 'warning'}>
                  {report.status === 'draft' ? 'Draft' : 'In Review'}
                </Badge>
              </div>
              <CardDescription>
                {report.type.replace(/_/g, ' ')} &middot; {report.language}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                Open
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
