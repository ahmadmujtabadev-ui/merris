// src/services/knowledge/benchmark.service.ts
//
// Peer benchmarking service that queries KnowledgeReportModel
// to compare a metric value against sector peers.

import { KnowledgeReportModel, type IExtractedMetric } from '../../models/knowledge-report.model.js';

// ============================================================
// Types
// ============================================================

export interface BenchmarkResult {
  metric: string;
  sector: string;
  peerCount: number;
  percentile: number;
  min: number;
  max: number;
  median: number;
  mean: number;
  yourValue: number;
  peers: Array<{ company: string; value: number; year: number }>;
}

// ============================================================
// Helpers
// ============================================================

function computePercentile(sortedValues: number[], value: number): number {
  if (sortedValues.length === 0) return 0;
  const below = sortedValues.filter((v) => v < value).length;
  return Math.round((below / sortedValues.length) * 100);
}

function computeMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

// ============================================================
// Benchmark metric
// ============================================================

export async function benchmarkMetric(
  metric: string,
  sector: string,
  yourValue: number
): Promise<BenchmarkResult> {
  // Find all reports in the given sector that contain the named metric
  const reports = await KnowledgeReportModel.find({
    sector,
    'metrics.name': metric,
  })
    .select('company reportYear metrics')
    .lean();

  // Extract the metric value from each report
  const peers: Array<{ company: string; value: number; year: number }> = [];

  for (const report of reports) {
    const found = report.metrics.find(
      (m: IExtractedMetric) => m.name === metric && typeof m.value === 'number'
    );
    if (found && typeof found.value === 'number') {
      peers.push({
        company: report.company,
        value: found.value,
        year: report.reportYear,
      });
    }
  }

  // Compute statistics
  const values = peers.map((p) => p.value).sort((a, b) => a - b);
  const peerCount = values.length;
  const min = peerCount > 0 ? values[0]! : 0;
  const max = peerCount > 0 ? values[peerCount - 1]! : 0;
  const median = computeMedian(values);
  const mean = peerCount > 0 ? Math.round((values.reduce((sum, v) => sum + v, 0) / peerCount) * 100) / 100 : 0;
  const percentile = computePercentile(values, yourValue);

  return {
    metric,
    sector,
    peerCount,
    percentile,
    min,
    max,
    median,
    mean,
    yourValue,
    peers,
  };
}
