'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CompletionDonut } from '@/components/completion-donut';
import { FileUpload } from '@/components/file-upload';
import { useAuthStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ----- Demo data -----

type DataPointStatus = 'auto_extracted' | 'user_confirmed' | 'user_edited' | 'estimated' | 'missing';
type Confidence = 'high' | 'medium' | 'low';
type DocStatus = 'queued' | 'processing' | 'ingested' | 'failed';

interface DemoDataPoint {
  id: string;
  metricName: string;
  frameworkRef: string;
  value: string | number;
  unit: string;
  confidence: Confidence;
  status: DataPointStatus;
}

interface DemoDocument {
  id: string;
  filename: string;
  format: string;
  size: number;
  status: DocStatus;
  uploadedAt: string;
}

interface GapItem {
  id: string;
  metricName: string;
  frameworkRef: string;
  assignee: string;
  deadline: string;
}

interface FrameworkProgress {
  framework: string;
  completed: number;
  total: number;
}

interface TopicProgress {
  topic: string;
  completed: number;
  total: number;
}

const DEMO_DATA_POINTS: DemoDataPoint[] = [
  { id: 'dp-1', metricName: 'Scope 1 GHG Emissions', frameworkRef: 'GRI 305-1', value: 12450, unit: 'tCO2e', confidence: 'high', status: 'user_confirmed' },
  { id: 'dp-2', metricName: 'Scope 2 GHG Emissions (Location)', frameworkRef: 'GRI 305-2', value: 8320, unit: 'tCO2e', confidence: 'medium', status: 'auto_extracted' },
  { id: 'dp-3', metricName: 'Total Energy Consumption', frameworkRef: 'GRI 302-1', value: 245000, unit: 'GJ', confidence: 'high', status: 'user_edited' },
  { id: 'dp-4', metricName: 'Water Withdrawal', frameworkRef: 'GRI 303-3', value: '', unit: 'ML', confidence: 'low', status: 'missing' },
  { id: 'dp-5', metricName: 'Waste Generated', frameworkRef: 'GRI 306-3', value: 1250, unit: 'tonnes', confidence: 'medium', status: 'estimated' },
  { id: 'dp-6', metricName: 'Employee Count', frameworkRef: 'GRI 2-7', value: 3400, unit: 'FTE', confidence: 'high', status: 'user_confirmed' },
  { id: 'dp-7', metricName: 'LTIFR', frameworkRef: 'GRI 403-9', value: 1.2, unit: 'per million hours', confidence: 'high', status: 'auto_extracted' },
  { id: 'dp-8', metricName: 'Board Independence %', frameworkRef: 'SASB IF-EU-140a.3', value: '', unit: '%', confidence: 'low', status: 'missing' },
];

const DEMO_DOCUMENTS: DemoDocument[] = [
  { id: 'doc-1', filename: 'Annual-Report-FY2025.pdf', format: 'pdf', size: 4500000, status: 'ingested', uploadedAt: '2026-02-15' },
  { id: 'doc-2', filename: 'Energy-Data-Q4.xlsx', format: 'xlsx', size: 850000, status: 'ingested', uploadedAt: '2026-02-18' },
  { id: 'doc-3', filename: 'Sustainability-Policy.docx', format: 'docx', size: 320000, status: 'processing', uploadedAt: '2026-03-01' },
  { id: 'doc-4', filename: 'Waste-Management-Report.pdf', format: 'pdf', size: 2100000, status: 'queued', uploadedAt: '2026-03-10' },
];

const DEMO_GAPS: GapItem[] = [
  { id: 'gap-1', metricName: 'Water Withdrawal', frameworkRef: 'GRI 303-3', assignee: 'Sarah K.', deadline: '2026-04-15' },
  { id: 'gap-2', metricName: 'Board Independence %', frameworkRef: 'SASB IF-EU-140a.3', assignee: 'Omar H.', deadline: '2026-04-10' },
  { id: 'gap-3', metricName: 'Scope 3 Cat 1 Emissions', frameworkRef: 'GRI 305-3', assignee: 'Noor A.', deadline: '2026-04-20' },
  { id: 'gap-4', metricName: 'Anti-corruption Training %', frameworkRef: 'GRI 205-2', assignee: 'Unassigned', deadline: '2026-04-25' },
];

const DEMO_FRAMEWORK_PROGRESS: FrameworkProgress[] = [
  { framework: 'GRI', completed: 28, total: 42 },
  { framework: 'SASB', completed: 8, total: 15 },
  { framework: 'TCFD', completed: 6, total: 11 },
];

const DEMO_TOPIC_PROGRESS: TopicProgress[] = [
  { topic: 'Climate & Energy', completed: 12, total: 16 },
  { topic: 'Water & Waste', completed: 4, total: 10 },
  { topic: 'Social & Labor', completed: 8, total: 12 },
  { topic: 'Governance', completed: 5, total: 9 },
  { topic: 'Supply Chain', completed: 2, total: 8 },
];

const CONFIDENCE_DIST = [
  { name: 'High', value: 18, fill: '#10b981' },
  { name: 'Medium', value: 12, fill: '#f59e0b' },
  { name: 'Low', value: 8, fill: '#ef4444' },
];

const ACTIVITY_FEED = [
  { time: '2 hours ago', text: 'Sarah K. uploaded Energy-Data-Q4.xlsx' },
  { time: '5 hours ago', text: 'AI extracted 12 data points from Annual-Report-FY2025.pdf' },
  { time: '1 day ago', text: 'Omar H. confirmed Scope 1 GHG Emissions value' },
  { time: '2 days ago', text: 'New gap identified: Anti-corruption Training %' },
];

// ----- Helpers -----

const STATUS_COLOR: Record<DataPointStatus, string> = {
  user_confirmed: 'text-emerald-400',
  auto_extracted: 'text-blue-400',
  user_edited: 'text-emerald-400',
  estimated: 'text-amber-400',
  missing: 'text-red-400',
};

const STATUS_BG: Record<DataPointStatus, string> = {
  user_confirmed: 'bg-emerald-600/10',
  auto_extracted: 'bg-blue-600/10',
  user_edited: 'bg-emerald-600/10',
  estimated: 'bg-amber-600/10',
  missing: 'bg-red-600/10',
};

const STATUS_LABEL: Record<DataPointStatus, string> = {
  user_confirmed: 'Confirmed',
  auto_extracted: 'Auto-extracted',
  user_edited: 'Edited',
  estimated: 'Estimated',
  missing: 'Missing',
};

const DOC_STATUS_BADGE: Record<DocStatus, { variant: 'default' | 'secondary' | 'warning' | 'info' | 'destructive'; label: string }> = {
  queued: { variant: 'secondary', label: 'Queued' },
  processing: { variant: 'info', label: 'Processing' },
  ingested: { variant: 'default', label: 'Ingested' },
  failed: { variant: 'destructive', label: 'Failed' },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ----- Main Component -----

export default function EngagementDetailPage() {
  const params = useParams();
  const engagementId = params.id as string;
  const { locale } = useAuthStore();
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dataPoints, setDataPoints] = useState(DEMO_DATA_POINTS);

  const totalCompleteness = Math.round(
    (DEMO_FRAMEWORK_PROGRESS.reduce((acc, fp) => acc + fp.completed, 0) /
      DEMO_FRAMEWORK_PROGRESS.reduce((acc, fp) => acc + fp.total, 0)) *
      100,
  );

  const handleCellEdit = (dpId: string, currentValue: string | number) => {
    setEditingCell(dpId);
    setEditValue(String(currentValue));
  };

  const handleCellSave = (dpId: string) => {
    setDataPoints((prev) =>
      prev.map((dp) =>
        dp.id === dpId
          ? { ...dp, value: isNaN(Number(editValue)) ? editValue : Number(editValue), status: 'user_edited' as const }
          : dp,
      ),
    );
    setEditingCell(null);
  };

  const handleConfirm = (dpId: string) => {
    setDataPoints((prev) =>
      prev.map((dp) => (dp.id === dpId ? { ...dp, status: 'user_confirmed' as const } : dp)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">FY2025 Sustainability Report</h1>
        <p className="mt-1 text-sm text-zinc-400">Engagement ID: {engagementId}</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">{t(locale, 'documents.title')}</TabsTrigger>
          <TabsTrigger value="data">{t(locale, 'dataCollection.title')}</TabsTrigger>
          <TabsTrigger value="gaps">{t(locale, 'gapRegister.title')}</TabsTrigger>
          <TabsTrigger value="completeness">{t(locale, 'completeness.title')}</TabsTrigger>
        </TabsList>

        {/* ========== Overview Tab ========== */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">Overall Completeness</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <CompletionDonut value={totalCompleteness} size={56} />
                <span className="text-2xl font-bold text-zinc-100">{totalCompleteness}%</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">Data Points</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-zinc-100">{dataPoints.length}</span>
                <span className="ms-2 text-sm text-zinc-500">collected</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-zinc-100">{DEMO_DOCUMENTS.length}</span>
                <span className="ms-2 text-sm text-zinc-500">uploaded</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">Open Gaps</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-red-400">{DEMO_GAPS.length}</span>
                <span className="ms-2 text-sm text-zinc-500">items</span>
              </CardContent>
            </Card>
          </div>

          {/* Activity feed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ACTIVITY_FEED.map((item, idx) => (
                  <div key={idx} className="flex gap-3 text-sm">
                    <span className="shrink-0 text-zinc-500">{item.time}</span>
                    <span className="text-zinc-300">{item.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== Documents Tab ========== */}
        <TabsContent value="documents" className="space-y-6">
          <FileUpload engagementId={engagementId} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t(locale, 'documents.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>{t(locale, 'documents.size')}</TableHead>
                    <TableHead>{t(locale, 'documents.status')}</TableHead>
                    <TableHead>{t(locale, 'documents.uploaded')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DEMO_DOCUMENTS.map((doc) => {
                    const badge = DOC_STATUS_BADGE[doc.status];
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium text-zinc-200">{doc.filename}</TableCell>
                        <TableCell className="uppercase text-zinc-400">{doc.format}</TableCell>
                        <TableCell className="text-zinc-400">{formatBytes(doc.size)}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== Data Collection Tab ========== */}
        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(locale, 'dataCollection.metric')}</TableHead>
                    <TableHead>{t(locale, 'dataCollection.framework')}</TableHead>
                    <TableHead>{t(locale, 'dataCollection.value')}</TableHead>
                    <TableHead>{t(locale, 'dataCollection.unit')}</TableHead>
                    <TableHead>{t(locale, 'dataCollection.confidence')}</TableHead>
                    <TableHead>{t(locale, 'dataCollection.status')}</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataPoints.map((dp) => (
                    <TableRow key={dp.id} className={STATUS_BG[dp.status]}>
                      <TableCell className="font-medium text-zinc-200">{dp.metricName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {dp.frameworkRef}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {editingCell === dp.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-7 w-28"
                              onKeyDown={(e) => e.key === 'Enter' && handleCellSave(dp.id)}
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleCellSave(dp.id)}>
                              Save
                            </Button>
                          </div>
                        ) : (
                          <button
                            className={cn(
                              'rounded px-1 text-start hover:bg-zinc-800',
                              dp.status === 'missing' ? 'text-red-400 italic' : 'text-zinc-200',
                            )}
                            onClick={() => handleCellEdit(dp.id, dp.value)}
                          >
                            {dp.status === 'missing' ? 'Needs input' : dp.value.toLocaleString()}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-400">{dp.unit}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            dp.confidence === 'high' ? 'default' : dp.confidence === 'medium' ? 'warning' : 'destructive'
                          }
                          className="text-xs"
                        >
                          {dp.confidence}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={cn('text-xs font-medium', STATUS_COLOR[dp.status])}>
                          {STATUS_LABEL[dp.status]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {dp.status === 'auto_extracted' && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400" onClick={() => handleConfirm(dp.id)}>
                            {t(locale, 'common.confirm')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== Gap Register Tab ========== */}
        <TabsContent value="gaps" className="space-y-4">
          {DEMO_FRAMEWORK_PROGRESS.map((fw) => {
            const gaps = DEMO_GAPS.filter((g) => g.frameworkRef.startsWith(fw.framework));
            if (gaps.length === 0) return null;
            return (
              <Card key={fw.framework}>
                <CardHeader>
                  <CardTitle className="text-base">{fw.framework}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t(locale, 'gapRegister.missingItems')}</TableHead>
                        <TableHead>Disclosure</TableHead>
                        <TableHead>{t(locale, 'gapRegister.assignee')}</TableHead>
                        <TableHead>{t(locale, 'gapRegister.deadline')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gaps.map((gap) => (
                        <TableRow key={gap.id}>
                          <TableCell className="font-medium text-zinc-200">{gap.metricName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {gap.frameworkRef}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-zinc-400">{gap.assignee}</TableCell>
                          <TableCell className="text-zinc-400">
                            {new Date(gap.deadline).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}

          {/* Gaps without matching framework prefix */}
          {(() => {
            const fwPrefixes = DEMO_FRAMEWORK_PROGRESS.map((fw) => fw.framework);
            const ungrouped = DEMO_GAPS.filter((g) => !fwPrefixes.some((p) => g.frameworkRef.startsWith(p)));
            if (ungrouped.length === 0) return null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Other Frameworks</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t(locale, 'gapRegister.missingItems')}</TableHead>
                        <TableHead>Disclosure</TableHead>
                        <TableHead>{t(locale, 'gapRegister.assignee')}</TableHead>
                        <TableHead>{t(locale, 'gapRegister.deadline')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ungrouped.map((gap) => (
                        <TableRow key={gap.id}>
                          <TableCell className="font-medium text-zinc-200">{gap.metricName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {gap.frameworkRef}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-zinc-400">{gap.assignee}</TableCell>
                          <TableCell className="text-zinc-400">
                            {new Date(gap.deadline).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* ========== Completeness Tab ========== */}
        <TabsContent value="completeness" className="space-y-6">
          {/* By Framework */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t(locale, 'completeness.byFramework')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {DEMO_FRAMEWORK_PROGRESS.map((fp) => {
                const pct = Math.round((fp.completed / fp.total) * 100);
                return (
                  <div key={fp.framework} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-200">{fp.framework}</span>
                      <span className="text-zinc-400">
                        {fp.completed}/{fp.total} ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* By Topic - bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t(locale, 'completeness.byTopic')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={DEMO_TOPIC_PROGRESS.map((tp) => ({
                      topic: tp.topic,
                      completed: tp.completed,
                      remaining: tp.total - tp.completed,
                    }))}
                    layout="vertical"
                    margin={{ left: 120 }}
                  >
                    <XAxis type="number" stroke="#71717a" fontSize={12} />
                    <YAxis type="category" dataKey="topic" stroke="#71717a" fontSize={12} width={120} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                      labelStyle={{ color: '#e4e4e7' }}
                    />
                    <Bar dataKey="completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="remaining" stackId="a" fill="#27272a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Confidence distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t(locale, 'completeness.confidenceDistribution')}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-8">
              <div className="h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={CONFIDENCE_DIST} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" strokeWidth={0}>
                      {CONFIDENCE_DIST.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {CONFIDENCE_DIST.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.fill }} />
                    <span className="text-zinc-300">
                      {item.name}: {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
