import mongoose from 'mongoose';
import { z } from 'zod';
import { DataPointModel, IDataPoint, IAuditEntry } from '../ingestion/ingestion.model.js';
import { AppError } from '../auth/auth.service.js';
import type { DataPointStatus, ExtractionMethod } from '@merris/shared';

// ============================================================
// Zod Validation Schemas
// ============================================================

export const CreateDataPointSchema = z.object({
  frameworkRef: z.string().min(1),
  metricName: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().min(1),
  period: z.object({
    year: z.number().int().min(1900).max(2100),
    quarter: z.number().int().min(1).max(4).optional(),
  }),
  source: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
});

export const UpdateDataPointSchema = z.object({
  value: z.union([z.number(), z.string()]).optional(),
  unit: z.string().optional(),
  status: z.enum(['auto_extracted', 'user_confirmed', 'user_edited', 'estimated', 'missing']).optional(),
});

export const EstimateDataPointSchema = z.object({
  estimatedValue: z.union([z.number(), z.string()]),
  estimationMethod: z.string().min(1),
  notes: z.string().optional(),
});

export const AssignGapsSchema = z.object({
  dataPointIds: z.array(z.string().min(1)).min(1),
  assignee: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    department: z.string().optional(),
  }),
  deadline: z.coerce.date(),
});

export type CreateDataPointInput = z.infer<typeof CreateDataPointSchema>;
export type UpdateDataPointInput = z.infer<typeof UpdateDataPointSchema>;
export type EstimateDataPointInput = z.infer<typeof EstimateDataPointSchema>;
export type AssignGapsInput = z.infer<typeof AssignGapsSchema>;

// ============================================================
// Validation Helpers
// ============================================================

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

/**
 * Validates data point values based on business rules.
 * Returns warnings for unusual values and throws for invalid values.
 */
export function validateDataPointValue(
  metricName: string,
  value: number | string,
  unit: string,
  engagementId?: string
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (typeof value === 'number') {
    // GHG emissions cannot be negative
    const isGHG =
      metricName.toLowerCase().includes('ghg') ||
      metricName.toLowerCase().includes('emission') ||
      metricName.toLowerCase().includes('co2');

    if (isGHG && value < 0) {
      throw new AppError('GHG emissions values cannot be negative', 400);
    }

    // Percentages must be 0-100 (or 0-1)
    if (unit === '%' || unit === 'percent' || unit === 'percentage') {
      if (value < 0 || value > 100) {
        throw new AppError('Percentage values must be between 0 and 100', 400);
      }
    }
  }

  return warnings;
}

/**
 * Checks for year-over-year variance and duplicate metrics.
 * Returns warnings (does not reject).
 */
export async function checkVarianceAndDuplicates(
  engagementId: string,
  frameworkRef: string,
  metricName: string,
  value: number | string,
  period: { year: number; quarter?: number },
  excludeId?: string
): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];

  // Check for duplicate metric+period
  const duplicateQuery: Record<string, unknown> = {
    engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
    frameworkRef,
    metricName,
    'period.year': period.year,
  };
  if (period.quarter) {
    duplicateQuery['period.quarter'] = period.quarter;
  }
  if (excludeId) {
    duplicateQuery['_id'] = { $ne: new (mongoose.Types.ObjectId as any)(excludeId) };
  }

  const duplicate = await DataPointModel.findOne(duplicateQuery);
  if (duplicate) {
    warnings.push({
      code: 'DUPLICATE_METRIC',
      message: `Duplicate data point exists for ${metricName} in ${period.year}${period.quarter ? ' Q' + period.quarter : ''}`,
      field: 'metricName',
    });
  }

  // Check YoY variance (> 50% triggers warning)
  if (typeof value === 'number') {
    const previousYear = await DataPointModel.findOne({
      engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
      frameworkRef,
      metricName,
      'period.year': period.year - 1,
      status: { $ne: 'missing' },
    });

    if (previousYear && typeof previousYear.value === 'number' && previousYear.value !== 0) {
      const changePercent = Math.abs((value - previousYear.value) / previousYear.value) * 100;
      if (changePercent > 50) {
        warnings.push({
          code: 'UNUSUAL_VARIANCE',
          message: `Year-over-year change of ${changePercent.toFixed(1)}% exceeds 50% threshold`,
          field: 'value',
        });
      }
    }
  }

  return warnings;
}

// ============================================================
// Service Functions
// ============================================================

export interface ListDataPointsFilters {
  status?: string;
  framework?: string;
  confidence?: string;
  sortBy?: string;
}

export async function listDataPoints(
  engagementId: string,
  filters: ListDataPointsFilters = {}
) {
  const query: Record<string, unknown> = {
    engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
  };

  if (filters.status) {
    query['status'] = filters.status;
  }
  if (filters.framework) {
    query['frameworkRef'] = { $regex: new RegExp(`^${filters.framework}`, 'i') };
  }
  if (filters.confidence) {
    query['confidence'] = filters.confidence;
  }

  let sortSpec: Record<string, 1 | -1> = { frameworkRef: 1, metricName: 1 };

  if (filters.sortBy === 'topic') {
    sortSpec = { metricName: 1, frameworkRef: 1 };
  } else if (filters.sortBy === 'priority') {
    sortSpec = { status: 1, confidence: -1, frameworkRef: 1 };
  }

  const dataPoints = await DataPointModel.find(query).sort(sortSpec).lean();
  return dataPoints;
}

export async function createDataPoint(
  engagementId: string,
  input: CreateDataPointInput,
  userId: string
) {
  // Validate value
  validateDataPointValue(input.metricName, input.value, input.unit);

  // Check for warnings
  const warnings = await checkVarianceAndDuplicates(
    engagementId,
    input.frameworkRef,
    input.metricName,
    input.value,
    input.period as any
  );

  const auditEntry = {
    action: 'created',
    userId,
    timestamp: new Date(),
    newValue: input.value,
    notes: input.source ? `Source: ${input.source}` : undefined,
  };

  const dataPoint = await DataPointModel.create({
    engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
    frameworkRef: input.frameworkRef,
    metricName: input.metricName,
    value: input.value,
    unit: input.unit,
    period: input.period,
    confidence: input.confidence || 'medium',
    status: 'user_confirmed' as DataPointStatus,
    extractionMethod: 'manual' as ExtractionMethod,
    auditTrail: [auditEntry],
  });

  return { dataPoint, warnings };
}

export async function updateDataPoint(
  dataPointId: string,
  input: UpdateDataPointInput,
  userId: string
) {
  const dataPoint = await DataPointModel.findById(dataPointId);
  if (!dataPoint) {
    throw new AppError('Data point not found', 404);
  }

  const prevValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  let auditNotes: string | undefined;

  if (input.value !== undefined) {
    // Validate the new value
    validateDataPointValue(dataPoint.metricName, input.value, input.unit || dataPoint.unit);

    prevValues['value'] = dataPoint.value;
    newValues['value'] = input.value;
    dataPoint.value = input.value;

    // Check variance warnings
    const warnings = await checkVarianceAndDuplicates(
      dataPoint.engagementId.toString(),
      dataPoint.frameworkRef,
      dataPoint.metricName,
      input.value,
      dataPoint.period,
      dataPointId
    );

    if (warnings.length > 0) {
      auditNotes = warnings.map((w) => w.message).join('; ');
    }
  }

  if (input.unit !== undefined) {
    prevValues['unit'] = dataPoint.unit;
    newValues['unit'] = input.unit;
    dataPoint.unit = input.unit;
  }

  if (input.status !== undefined) {
    prevValues['status'] = dataPoint.status;
    newValues['status'] = input.status;
    dataPoint.status = input.status;
  }

  dataPoint.auditTrail.push({
    action: 'updated',
    userId,
    timestamp: new Date(),
    previousValue: prevValues,
    newValue: newValues,
    notes: auditNotes,
  } as unknown as IAuditEntry);
  await dataPoint.save();

  return dataPoint;
}

export async function confirmDataPoint(dataPointId: string, userId: string) {
  const dataPoint = await DataPointModel.findById(dataPointId);
  if (!dataPoint) {
    throw new AppError('Data point not found', 404);
  }

  const previousStatus = dataPoint.status;
  dataPoint.status = 'user_confirmed';

  dataPoint.auditTrail.push({
    action: 'confirmed',
    userId,
    timestamp: new Date(),
    previousValue: { status: previousStatus },
    newValue: { status: 'user_confirmed' },
  } as unknown as IAuditEntry);

  await dataPoint.save();
  return dataPoint;
}

export async function estimateDataPoint(
  dataPointId: string,
  input: EstimateDataPointInput,
  userId: string
) {
  const dataPoint = await DataPointModel.findById(dataPointId);
  if (!dataPoint) {
    throw new AppError('Data point not found', 404);
  }

  const previousValue = dataPoint.value;
  const previousStatus = dataPoint.status;

  dataPoint.value = input.estimatedValue;
  dataPoint.status = 'estimated';

  dataPoint.auditTrail.push({
    action: 'estimated',
    userId,
    timestamp: new Date(),
    previousValue: { value: previousValue, status: previousStatus },
    newValue: { value: input.estimatedValue, status: 'estimated' },
    notes: `Method: ${input.estimationMethod}${input.notes ? '. ' + input.notes : ''}`,
  } as unknown as IAuditEntry);

  await dataPoint.save();
  return dataPoint;
}

// ============================================================
// Gap Register
// ============================================================

export interface GapRegisterItem {
  dataPoint: IDataPoint;
  framework: string;
  assignee?: { name: string; email: string; department?: string };
  deadline?: Date;
  priority: string;
}

export async function getGapRegister(engagementId: string) {
  const missingOrIncomplete = await DataPointModel.find({
    engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
    status: { $in: ['missing', 'auto_extracted'] },
  })
    .sort({ frameworkRef: 1, metricName: 1 })
    .lean();

  // Group by framework
  const byFramework: Record<string, typeof missingOrIncomplete> = {};
  for (const dp of missingOrIncomplete) {
    const fw = dp.frameworkRef.split('-')[0] || dp.frameworkRef;
    if (!byFramework[fw]) {
      byFramework[fw] = [];
    }
    byFramework[fw]!.push(dp);
  }

  // Group by assignee (from audit trail assignment entries)
  const byAssignee: Record<string, typeof missingOrIncomplete> = {};
  for (const dp of missingOrIncomplete) {
    const assignmentEntry = [...dp.auditTrail].reverse().find((a) => a.action === 'assigned');
    const assigneeName = assignmentEntry?.notes?.replace('Assigned to: ', '') || 'Unassigned';
    if (!byAssignee[assigneeName]) {
      byAssignee[assigneeName] = [];
    }
    byAssignee[assigneeName]!.push(dp);
  }

  // Group by priority (based on confidence)
  const byPriority: Record<string, typeof missingOrIncomplete> = {};
  for (const dp of missingOrIncomplete) {
    const priority = dp.confidence === 'low' ? 'high' : dp.confidence === 'medium' ? 'medium' : 'low';
    if (!byPriority[priority]) {
      byPriority[priority] = [];
    }
    byPriority[priority]!.push(dp);
  }

  return {
    total: missingOrIncomplete.length,
    items: missingOrIncomplete,
    byFramework,
    byAssignee,
    byPriority,
  };
}

export async function assignGaps(
  engagementId: string,
  input: AssignGapsInput,
  userId: string
) {
  const objectIds = input.dataPointIds.map((id) => new (mongoose.Types.ObjectId as any)(id));

  const dataPoints = await DataPointModel.find({
    _id: { $in: objectIds },
    engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
  });

  if (dataPoints.length === 0) {
    throw new AppError('No matching data points found', 404);
  }

  const results = [];

  for (const dp of dataPoints) {
    dp.auditTrail.push({
      action: 'assigned',
      userId,
      timestamp: new Date(),
      notes: `Assigned to: ${input.assignee.name} (${input.assignee.email})${input.assignee.department ? ', ' + input.assignee.department : ''}. Deadline: ${input.deadline.toISOString()}`,
    } as unknown as IAuditEntry);

    await dp.save();
    results.push(dp);
  }

  return {
    assigned: results.length,
    assignee: input.assignee,
    deadline: input.deadline,
    dataPointIds: results.map((dp) => dp._id.toString()),
  };
}

// ============================================================
// Completeness Dashboard
// ============================================================

export async function getCompleteness(engagementId: string) {
  const engObjId = new (mongoose.Types.ObjectId as any)(engagementId);
  const allDataPoints = await DataPointModel.find({ engagementId: engObjId }).lean();

  const total = allDataPoints.length;
  const completedStatuses: DataPointStatus[] = ['user_confirmed', 'user_edited', 'estimated'];
  const completed = allDataPoints.filter((dp) => completedStatuses.includes(dp.status as DataPointStatus)).length;
  // auto_extracted counts as half credit — data exists but hasn't been reviewed yet
  const autoExtracted = allDataPoints.filter((dp) => dp.status === 'auto_extracted').length;
  const weightedScore = completed + autoExtracted * 0.5;
  const percentage = total > 0 ? Math.round((weightedScore / total) * 100) : 0;

  // By framework
  const fwMap = new Map<string, { code: string; total: number; completed: number }>();
  for (const dp of allDataPoints) {
    const code = dp.frameworkRef.split('-')[0] || dp.frameworkRef;
    if (!fwMap.has(code)) {
      fwMap.set(code, { code, total: 0, completed: 0 });
    }
    const entry = fwMap.get(code)!;
    entry.total++;
    if (completedStatuses.includes(dp.status as DataPointStatus)) {
      entry.completed++;
    }
  }

  const byFramework = Array.from(fwMap.values()).map((fw) => ({
    code: fw.code,
    name: fw.code.toUpperCase(),
    total: fw.total,
    completed: fw.completed,
    percentage: fw.total > 0 ? Math.round((fw.completed / fw.total) * 100) : 0,
  }));

  // By topic (using metricName grouping)
  const topicMap = new Map<string, { name: string; total: number; completed: number }>();
  for (const dp of allDataPoints) {
    // Use the first part of metricName or frameworkRef topic segment as topic
    const topic = dp.metricName.split(' ')[0] || 'Other';
    if (!topicMap.has(topic)) {
      topicMap.set(topic, { name: topic, total: 0, completed: 0 });
    }
    const entry = topicMap.get(topic)!;
    entry.total++;
    if (completedStatuses.includes(dp.status as DataPointStatus)) {
      entry.completed++;
    }
  }

  const byTopic = Array.from(topicMap.values()).map((t) => ({
    name: t.name,
    total: t.total,
    completed: t.completed,
    percentage: t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0,
  }));

  // By confidence
  const byConfidence = { high: 0, medium: 0, low: 0 };
  for (const dp of allDataPoints) {
    if (dp.confidence === 'high') byConfidence.high++;
    else if (dp.confidence === 'medium') byConfidence.medium++;
    else if (dp.confidence === 'low') byConfidence.low++;
  }

  // Trend: group by createdAt date, compute running completion
  const sorted = [...allDataPoints].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const trend: Array<{ date: string; percentage: number }> = [];
  const seenDates = new Set<string>();
  let runningTotal = 0;
  let runningCompleted = 0;

  for (const dp of sorted) {
    const dateStr = new Date(dp.createdAt).toISOString().split('T')[0]!;
    runningTotal++;
    if (completedStatuses.includes(dp.status as DataPointStatus)) {
      runningCompleted++;
    }

    if (!seenDates.has(dateStr)) {
      seenDates.add(dateStr);
    }
    // Update the trend entry for this date
    const existingIdx = trend.findIndex((t) => t.date === dateStr);
    const pct = Math.round((runningCompleted / runningTotal) * 100);
    if (existingIdx >= 0) {
      trend[existingIdx]!.percentage = pct;
    } else {
      trend.push({ date: dateStr, percentage: pct });
    }
  }

  return {
    overall: { total, completed, percentage },
    byFramework,
    byTopic,
    byConfidence,
    trend,
  };
}
