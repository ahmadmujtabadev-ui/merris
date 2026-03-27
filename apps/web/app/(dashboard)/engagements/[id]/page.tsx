'use client';

import { useState, useEffect } from 'react';
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
import { api } from '@/lib/api';
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

// ----- Types -----

type DataPointStatus = 'auto_extracted' | 'user_confirmed' | 'user_edited' | 'estimated' | 'missing';
type Confidence = 'high' | 'medium' | 'low';
type DocStatus = 'queued' | 'processing' | 'ingested' | 'failed';

interface DataPoint {
  id: string;
  metricName: string;
  frameworkRef: string;
  value: string | number;
  unit: string;
  confidence: Confidence;
  status: DataPointStatus;
}

interface DocumentItem {
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

interface CompletenessData {
  overall: number;
  byFramework: FrameworkProgress[];
  byTopic: TopicProgress[];
  confidenceDistribution: { name: string; value: number; fill: string }[];
}

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

function ensureToken() {
  if (!api.getToken() && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('merris_auth');
      if (stored) {
        const parsed = JSON.parse(stored) as { token?: string };
        if (parsed.token) api.setToken(parsed.token);
      }
    } catch { /* ignore */ }
  }
}

// ----- Main Component -----

export default function EngagementDetailPage() {
  const params = useParams();
  const engagementId = params.id as string;
  const { locale } = useAuthStore();

  // Data state
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [completeness, setCompleteness] = useState<CompletenessData | null>(null);
  const [engagementName, setEngagementName] = useState<string>('');

  // Loading state
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingGaps, setLoadingGaps] = useState(true);

  // Error state
  const [errorOverview, setErrorOverview] = useState<string | null>(null);
  const [errorDocs, setErrorDocs] = useState<string | null>(null);
  const [errorData, setErrorData] = useState<string | null>(null);
  const [errorGaps, setErrorGaps] = useState<string | null>(null);

  // Edit state
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Fetch all data on mount
  useEffect(() => {
    ensureToken();

    // Fetch completeness/overview data
    async function fetchCompleteness() {
      try {
        const data = await api.get<CompletenessData>(`/engagements/${engagementId}/completeness`);
        setCompleteness(data);
        setErrorOverview(null);
      } catch (err) {
        setErrorOverview(err instanceof Error ? err.message : 'Failed to load overview');
      } finally {
        setLoadingOverview(false);
      }
    }

    // Fetch documents
    async function fetchDocuments() {
      try {
        const data = await api.get<DocumentItem[]>(`/engagements/${engagementId}/documents`);
        setDocuments(data);
        setErrorDocs(null);
      } catch (err) {
        setErrorDocs(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        setLoadingDocs(false);
      }
    }

    // Fetch data points
    async function fetchDataPoints() {
      try {
        const data = await api.get<DataPoint[]>(`/engagements/${engagementId}/data-points`);
        setDataPoints(data);
        setErrorData(null);
      } catch (err) {
        setErrorData(err instanceof Error ? err.message : 'Failed to load data points');
      } finally {
        setLoadingData(false);
      }
    }

    // Fetch gaps
    async function fetchGaps() {
      try {
        const data = await api.get<GapItem[]>(`/engagements/${engagementId}/gap-register`);
        setGaps(data);
        setErrorGaps(null);
      } catch (err) {
        setErrorGaps(err instanceof Error ? err.message : 'Failed to load gap register');
      } finally {
        setLoadingGaps(false);
      }
    }

    // Fetch engagement name
    async function fetchEngagement() {
      try {
        const data = await api.get<{ name: string }>(`/engagements/${engagementId}`);
        setEngagementName(data.name);
      } catch {
        setEngagementName(`Engagement ${engagementId}`);
      }
    }

    void fetchCompleteness();
    void fetchDocuments();
    void fetchDataPoints();
    void fetchGaps();
    void fetchEngagement();
  }, [engagementId]);

  const totalCompleteness = completeness?.overall ?? (
    completeness?.byFramework && completeness.byFramework.length > 0
      ? Math.round(
          (completeness.byFramework.reduce((acc, fp) => acc + fp.completed, 0) /
            completeness.byFramework.reduce((acc, fp) => acc + fp.total, 0)) *
            100,
        )
      : 0
  );

  const frameworkProgress = completeness?.byFramework ?? [];
  const topicProgress = completeness?.byTopic ?? [];
  const confidenceDist = completeness?.confidenceDistribution ?? [];

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

  function LoadingSkeleton() {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  function ErrorState({ message }: { message: string }) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-red-400">{message}</p>
          <p className="mt-1 text-xs text-zinc-500">The API endpoint may not be available yet.</p>
        </CardContent>
      </Card>
    );
  }

  function EmptyState({ message }: { message: string }) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-zinc-400">{message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{engagementName || 'Loading...'}</h1>
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
          {loadingOverview ? (
            <LoadingSkeleton />
          ) : errorOverview ? (
            <>
              {/* Show KPI cards with zeros when API unavailable */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-400">Overall Completeness</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-4">
                    <CompletionDonut value={0} size={56} />
                    <span className="text-2xl font-bold text-zinc-100">0%</span>
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
                    <span className="text-2xl font-bold text-zinc-100">{documents.length}</span>
                    <span className="ms-2 text-sm text-zinc-500">uploaded</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-400">Open Gaps</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold text-red-400">{gaps.length}</span>
                    <span className="ms-2 text-sm text-zinc-500">items</span>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <p className="text-sm text-zinc-500">No activity data available yet.</p>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
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
                    <span className="text-2xl font-bold text-zinc-100">{documents.length}</span>
                    <span className="ms-2 text-sm text-zinc-500">uploaded</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-400">Open Gaps</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold text-red-400">{gaps.length}</span>
                    <span className="ms-2 text-sm text-zinc-500">items</span>
                  </CardContent>
                </Card>
              </div>

              {/* Framework summary */}
              {frameworkProgress.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Framework Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {frameworkProgress.map((fp) => {
                      const pct = fp.total > 0 ? Math.round((fp.completed / fp.total) * 100) : 0;
                      return (
                        <div key={fp.framework} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-zinc-200">{fp.framework}</span>
                            <span className="text-zinc-400">{fp.completed}/{fp.total} ({pct}%)</span>
                          </div>
                          <Progress value={pct} />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ========== Documents Tab ========== */}
        <TabsContent value="documents" className="space-y-6">
          <FileUpload engagementId={engagementId} />

          {loadingDocs ? (
            <LoadingSkeleton />
          ) : errorDocs ? (
            <EmptyState message="No documents uploaded yet." />
          ) : documents.length === 0 ? (
            <EmptyState message="No documents uploaded yet. Use the upload area above to add files." />
          ) : (
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
                    {documents.map((doc) => {
                      const badge = DOC_STATUS_BADGE[doc.status] ?? DOC_STATUS_BADGE.queued;
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
          )}
        </TabsContent>

        {/* ========== Data Collection Tab ========== */}
        <TabsContent value="data" className="space-y-4">
          {loadingData ? (
            <LoadingSkeleton />
          ) : errorData ? (
            <EmptyState message="No data points collected yet." />
          ) : dataPoints.length === 0 ? (
            <EmptyState message="No data points collected yet. Upload documents to auto-extract ESG metrics." />
          ) : (
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
                      <TableRow key={dp.id} className={STATUS_BG[dp.status] ?? ''}>
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
                              {dp.status === 'missing' ? 'Needs input' : String(dp.value)}
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
                          <span className={cn('text-xs font-medium', STATUS_COLOR[dp.status] ?? 'text-zinc-400')}>
                            {STATUS_LABEL[dp.status] ?? dp.status}
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
          )}
        </TabsContent>

        {/* ========== Gap Register Tab ========== */}
        <TabsContent value="gaps" className="space-y-4">
          {loadingGaps ? (
            <LoadingSkeleton />
          ) : errorGaps ? (
            <EmptyState message="No gap data available yet." />
          ) : gaps.length === 0 ? (
            <EmptyState message="No gaps identified. All required disclosures are covered." />
          ) : (
            <>
              {/* Group gaps by framework prefix */}
              {frameworkProgress.map((fw) => {
                const fwGaps = gaps.filter((g) => g.frameworkRef.startsWith(fw.framework));
                if (fwGaps.length === 0) return null;
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
                          {fwGaps.map((gap) => (
                            <TableRow key={gap.id}>
                              <TableCell className="font-medium text-zinc-200">{gap.metricName}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{gap.frameworkRef}</Badge>
                              </TableCell>
                              <TableCell className="text-zinc-400">{gap.assignee}</TableCell>
                              <TableCell className="text-zinc-400">{new Date(gap.deadline).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Ungrouped gaps */}
              {(() => {
                const fwPrefixes = frameworkProgress.map((fw) => fw.framework);
                const ungrouped = gaps.filter((g) => !fwPrefixes.some((p) => g.frameworkRef.startsWith(p)));
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
                                <Badge variant="outline" className="text-xs">{gap.frameworkRef}</Badge>
                              </TableCell>
                              <TableCell className="text-zinc-400">{gap.assignee}</TableCell>
                              <TableCell className="text-zinc-400">{new Date(gap.deadline).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* If no framework progress data, show all gaps in one table */}
              {frameworkProgress.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">All Gaps</CardTitle>
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
                              <Badge variant="outline" className="text-xs">{gap.frameworkRef}</Badge>
                            </TableCell>
                            <TableCell className="text-zinc-400">{gap.assignee}</TableCell>
                            <TableCell className="text-zinc-400">{new Date(gap.deadline).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ========== Completeness Tab ========== */}
        <TabsContent value="completeness" className="space-y-6">
          {loadingOverview ? (
            <LoadingSkeleton />
          ) : errorOverview ? (
            <EmptyState message="No completeness data available yet." />
          ) : (
            <>
              {/* By Framework */}
              {frameworkProgress.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t(locale, 'completeness.byFramework')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {frameworkProgress.map((fp) => {
                      const pct = fp.total > 0 ? Math.round((fp.completed / fp.total) * 100) : 0;
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
              ) : (
                <EmptyState message="No framework progress data available." />
              )}

              {/* By Topic - bar chart */}
              {topicProgress.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t(locale, 'completeness.byTopic')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={topicProgress.map((tp) => ({
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
              )}

              {/* Confidence distribution */}
              {confidenceDist.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t(locale, 'completeness.confidenceDistribution')}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-8">
                    <div className="h-48 w-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={confidenceDist} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" strokeWidth={0}>
                            {confidenceDist.map((entry, idx) => (
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
                      {confidenceDist.map((item) => (
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
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
