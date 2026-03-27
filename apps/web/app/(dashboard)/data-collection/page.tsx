'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthStore } from '@/lib/store';
import { t } from '@/lib/i18n';

const OVERVIEW_DATA = [
  { metric: 'Total Metrics Required', value: 68 },
  { metric: 'Collected', value: 42 },
  { metric: 'Pending Review', value: 12 },
  { metric: 'Missing', value: 14 },
];

export default function DataCollectionPage() {
  const { locale } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{t(locale, 'dataCollection.title')}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Centralized view of all data collection across active engagements.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {OVERVIEW_DATA.map((item) => (
          <Card key={item.metric}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">{item.metric}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-zinc-100">{item.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Data Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Engagement</TableHead>
                <TableHead>Framework</TableHead>
                <TableHead>Pending Items</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-zinc-200">FY2025 Sustainability Report</TableCell>
                <TableCell><Badge variant="outline">GRI</Badge></TableCell>
                <TableCell className="text-zinc-400">8</TableCell>
                <TableCell><Badge variant="warning">In Progress</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-zinc-200">CDP Climate Response</TableCell>
                <TableCell><Badge variant="outline">CDP</Badge></TableCell>
                <TableCell className="text-zinc-400">14</TableCell>
                <TableCell><Badge variant="secondary">Not Started</Badge></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
