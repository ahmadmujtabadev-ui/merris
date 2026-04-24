import mongoose from 'mongoose';
import { DataPointModel, IDataPoint } from '../ingestion/ingestion.model.js';
import { ReportModel, IReportSection } from '../report/report.model.js';
import { Disclosure } from '../../models/disclosure.model.js';
import { Framework } from '../../models/framework.model.js';

// ============================================================
// Types
// ============================================================

export interface QAIssue {
  type: string;
  severity: 'error' | 'warning';
  description: string;
  location: string;
  suggestion: string;
}

export interface QACheck {
  type: string;
  description: string;
  location: string;
}

export interface ConsistencyReport {
  engagementId: string;
  runAt: Date;
  issues: QAIssue[];
  warnings: QAIssue[];
  passed: QACheck[];
  summary: {
    totalChecks: number;
    errors: number;
    warnings: number;
    passed: number;
  };
}

// ============================================================
// Unit Equivalence Map
// ============================================================

const UNIT_GROUPS: Record<string, string[]> = {
  volume: ['m3', 'm\u00b3', 'ML', 'megalitre', 'megalitres', 'litre', 'litres', 'L', 'gallon', 'gallons'],
  mass: ['tonnes', 'tons', 'metric tons', 'mt', 'kg', 'kilograms', 'tCO2e', 'tCO2'],
  energy: ['MWh', 'kWh', 'GJ', 'TJ', 'MJ'],
  percentage: ['%', 'percent', 'percentage'],
};

function getUnitGroup(unit: string): string | null {
  for (const [group, units] of Object.entries(UNIT_GROUPS)) {
    if (units.some((u) => u.toLowerCase() === unit.toLowerCase())) {
      return group;
    }
  }
  return null;
}

function unitsConflict(unitA: string, unitB: string): boolean {
  if (unitA.toLowerCase() === unitB.toLowerCase()) return false;
  const groupA = getUnitGroup(unitA);
  const groupB = getUnitGroup(unitB);
  // Both in the same group but different strings = mismatch
  if (groupA && groupB && groupA === groupB) return true;
  return false;
}

// ============================================================
// QA Engine
// ============================================================

export async function runQA(engagementId: string): Promise<ConsistencyReport> {
  const engObjId = new (mongoose.Types.ObjectId as any)(engagementId);

  const [dataPoints, reports] = await Promise.all([
    DataPointModel.find({ engagementId: engObjId }).lean() as unknown as Promise<IDataPoint[]>,
    ReportModel.find({ engagementId: engObjId }).lean(),
  ]);

  const issues: QAIssue[] = [];
  const warnings: QAIssue[] = [];
  const passed: QACheck[] = [];

  // ----------------------------------------------------------
  // Check 1: Conflicting values — same metric, same period,
  //          different values across report sections or data points
  // ----------------------------------------------------------
  checkConflictingValues(dataPoints, issues, warnings, passed);

  // ----------------------------------------------------------
  // Check 2: Unit mismatches — same metric with different units
  // ----------------------------------------------------------
  checkUnitMismatches(dataPoints, issues, warnings, passed);

  // ----------------------------------------------------------
  // Check 3: Missing required disclosures
  // ----------------------------------------------------------
  await checkMissingDisclosures(engagementId, dataPoints, issues, warnings, passed);

  // ----------------------------------------------------------
  // Check 4: Implausible YoY changes (>200%)
  // ----------------------------------------------------------
  checkImplausibleYoY(dataPoints, issues, warnings, passed);

  // ----------------------------------------------------------
  // Check 5: Rounding inconsistencies
  // ----------------------------------------------------------
  checkRoundingInconsistencies(dataPoints, reports, issues, warnings, passed);

  // ----------------------------------------------------------
  // Check 6: Data points without source document reference
  // ----------------------------------------------------------
  checkMissingSources(dataPoints, issues, warnings, passed);

  const result: ConsistencyReport = {
    engagementId,
    runAt: new Date(),
    issues: issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warning').concat(warnings),
    passed,
    summary: {
      totalChecks: issues.length + warnings.length + passed.length,
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length + warnings.length,
      passed: passed.length,
    },
  };

  return result;
}

// ============================================================
// Individual Checks
// ============================================================

function checkConflictingValues(
  dataPoints: IDataPoint[],
  issues: QAIssue[],
  _warnings: QAIssue[],
  passed: QACheck[],
): void {
  // Group by metricName + period.year + period.quarter
  const groups = new Map<string, IDataPoint[]>();

  for (const dp of dataPoints) {
    const key = `${dp.metricName}::${dp.period.year}::${dp.period.quarter || ''}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(dp);
  }

  let foundConflict = false;
  for (const [key, group] of groups) {
    if (group.length < 2) continue;

    const numericValues = group
      .filter((dp) => typeof dp.value === 'number')
      .map((dp) => dp.value as number);

    const uniqueValues = [...new Set(numericValues)];
    if (uniqueValues.length > 1) {
      foundConflict = true;
      const [metricName, year] = key.split('::');
      issues.push({
        type: 'CONFLICTING_VALUES',
        severity: 'error',
        description: `Metric "${metricName}" has conflicting values for period ${year}: ${uniqueValues.join(', ')}`,
        location: `DataPoints for ${metricName}`,
        suggestion: 'Review and reconcile the different values to ensure consistency across the report.',
      });
    }
  }

  if (!foundConflict) {
    passed.push({
      type: 'CONFLICTING_VALUES',
      description: 'No conflicting metric values found across data points',
      location: 'All data points',
    });
  }
}

function checkUnitMismatches(
  dataPoints: IDataPoint[],
  issues: QAIssue[],
  _warnings: QAIssue[],
  passed: QACheck[],
): void {
  // Group by metricName
  const groups = new Map<string, IDataPoint[]>();

  for (const dp of dataPoints) {
    if (!groups.has(dp.metricName)) {
      groups.set(dp.metricName, []);
    }
    groups.get(dp.metricName)!.push(dp);
  }

  let foundMismatch = false;
  for (const [metricName, group] of groups) {
    const units = [...new Set(group.map((dp) => dp.unit))];
    if (units.length < 2) continue;

    // Check if any pair conflicts
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        if (unitsConflict(units[i]!, units[j]!)) {
          foundMismatch = true;
          issues.push({
            type: 'UNIT_MISMATCH',
            severity: 'error',
            description: `Metric "${metricName}" uses inconsistent units: "${units[i]}" and "${units[j]}"`,
            location: `DataPoints for ${metricName}`,
            suggestion: `Standardize to a single unit. Consider converting "${units[j]}" to "${units[i]}" or vice versa.`,
          });
        }
      }
    }
  }

  if (!foundMismatch) {
    passed.push({
      type: 'UNIT_MISMATCH',
      description: 'No unit mismatches found across metrics',
      location: 'All data points',
    });
  }
}

async function checkMissingDisclosures(
  engagementId: string,
  dataPoints: IDataPoint[],
  issues: QAIssue[],
  _warnings: QAIssue[],
  passed: QACheck[],
): Promise<void> {
  // Collect distinct framework codes from data points
  const frameworkCodes = new Set<string>();
  for (const dp of dataPoints) {
    const code = dp.frameworkRef.split('-')[0];
    if (code) frameworkCodes.add(code);
  }

  if (frameworkCodes.size === 0) {
    passed.push({
      type: 'MISSING_DISCLOSURES',
      description: 'No framework references found — disclosure check skipped',
      location: 'Engagement',
    });
    return;
  }

  // Load frameworks to find required disclosures
  const frameworks = await Framework.find({
    code: { $in: Array.from(frameworkCodes) },
  }).lean();

  const coveredRefs = new Set(dataPoints.map((dp) => dp.frameworkRef));
  let foundMissing = false;

  for (const fw of frameworks) {
    for (const topic of fw.structure.topics) {
      for (const disc of topic.disclosures) {
        // Build the expected frameworkRef pattern (e.g., "gri-305-1")
        const expectedRef = `${fw.code}-${disc.code}`.toLowerCase();
        const altRef = disc.code.toLowerCase();

        const isCovered = [...coveredRefs].some(
          (ref) => ref.toLowerCase() === expectedRef || ref.toLowerCase() === altRef,
        );

        if (!isCovered && disc.requiredMetrics.length > 0) {
          foundMissing = true;
          issues.push({
            type: 'MISSING_DISCLOSURE',
            severity: 'warning',
            description: `Required disclosure "${disc.name}" (${disc.code}) from ${fw.code} has no data points`,
            location: `Framework ${fw.code}`,
            suggestion: `Collect data for disclosure ${disc.code} or document why it is not applicable.`,
          });
        }
      }
    }
  }

  if (!foundMissing) {
    passed.push({
      type: 'MISSING_DISCLOSURES',
      description: 'All required disclosures have associated data points',
      location: 'All frameworks',
    });
  }
}

function checkImplausibleYoY(
  dataPoints: IDataPoint[],
  issues: QAIssue[],
  _warnings: QAIssue[],
  passed: QACheck[],
): void {
  // Group by metricName
  const groups = new Map<string, IDataPoint[]>();

  for (const dp of dataPoints) {
    if (typeof dp.value !== 'number') continue;
    if (!groups.has(dp.metricName)) {
      groups.set(dp.metricName, []);
    }
    groups.get(dp.metricName)!.push(dp);
  }

  let foundImplausible = false;

  for (const [metricName, group] of groups) {
    // Sort by year
    const sorted = [...group].sort((a, b) => a.period.year - b.period.year);

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;

      if (curr.period.year - prev.period.year !== 1) continue;
      if (typeof prev.value !== 'number' || typeof curr.value !== 'number') continue;
      if (prev.value === 0) continue;

      const changePercent = Math.abs((curr.value - prev.value) / prev.value) * 100;

      if (changePercent > 200) {
        foundImplausible = true;
        issues.push({
          type: 'IMPLAUSIBLE_YOY',
          severity: 'warning',
          description: `Metric "${metricName}" changed by ${changePercent.toFixed(0)}% from ${prev.period.year} to ${curr.period.year} (${prev.value} -> ${curr.value})`,
          location: `DataPoints for ${metricName}`,
          suggestion: 'Verify this change is accurate. Consider adding a narrative explanation for significant year-over-year variations.',
        });
      }
    }
  }

  if (!foundImplausible) {
    passed.push({
      type: 'IMPLAUSIBLE_YOY',
      description: 'No implausible year-over-year changes (>200%) detected',
      location: 'All data points',
    });
  }
}

function checkRoundingInconsistencies(
  dataPoints: IDataPoint[],
  reports: Array<{ structure: IReportSection[] }>,
  issues: QAIssue[],
  _warnings: QAIssue[],
  passed: QACheck[],
): void {
  // Check if the same metric has values with different decimal precision
  const groups = new Map<string, IDataPoint[]>();

  for (const dp of dataPoints) {
    if (typeof dp.value !== 'number') continue;
    const key = `${dp.metricName}::${dp.period.year}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(dp);
  }

  let foundRounding = false;

  for (const [key, group] of groups) {
    if (group.length < 2) continue;

    const precisions = group.map((dp) => {
      const str = String(dp.value);
      const parts = str.split('.');
      return parts.length > 1 ? parts[1]!.length : 0;
    });

    const uniquePrecisions = [...new Set(precisions)];
    if (uniquePrecisions.length > 1) {
      foundRounding = true;
      const [metricName, year] = key.split('::');
      issues.push({
        type: 'ROUNDING_INCONSISTENCY',
        severity: 'warning',
        description: `Metric "${metricName}" in ${year} has values with different decimal precisions (${uniquePrecisions.join(', ')} decimal places)`,
        location: `DataPoints for ${metricName}`,
        suggestion: 'Standardize the number of decimal places across all instances of this metric.',
      });
    }
  }

  if (!foundRounding) {
    passed.push({
      type: 'ROUNDING_INCONSISTENCY',
      description: 'No rounding inconsistencies detected',
      location: 'All data points',
    });
  }
}

function checkMissingSources(
  dataPoints: IDataPoint[],
  issues: QAIssue[],
  _warnings: QAIssue[],
  passed: QACheck[],
): void {
  let foundMissing = false;

  for (const dp of dataPoints) {
    const hasSource = dp.sourceDocumentId || dp.documentId;
    if (!hasSource) {
      foundMissing = true;
      issues.push({
        type: 'MISSING_SOURCE',
        severity: 'warning',
        description: `Data point "${dp.metricName}" (${dp.frameworkRef}, ${dp.period.year}) has no source document reference`,
        location: `DataPoint ${dp._id}`,
        suggestion: 'Link this data point to its source document for audit trail completeness.',
      });
    }
  }

  if (!foundMissing) {
    passed.push({
      type: 'MISSING_SOURCE',
      description: 'All data points have source document references',
      location: 'All data points',
    });
  }
}

// ============================================================
// QA History (in-memory for now, could be persisted)
// ============================================================

const qaHistory = new Map<string, ConsistencyReport[]>();

export function storeQAResult(report: ConsistencyReport): void {
  const key = report.engagementId;
  if (!qaHistory.has(key)) {
    qaHistory.set(key, []);
  }
  qaHistory.get(key)!.push(report);
}

export function getQAHistory(engagementId: string): ConsistencyReport[] {
  return qaHistory.get(engagementId) || [];
}

export function clearQAHistory(): void {
  qaHistory.clear();
}
