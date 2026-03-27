import mongoose from 'mongoose';
import { DataPointModel, IDataPoint } from '../ingestion/ingestion.model.js';
import { ESGDocumentModel } from '../ingestion/ingestion.model.js';
import { ReportModel } from '../report/report.model.js';
import { Disclosure } from '../../models/disclosure.model.js';
import { Framework } from '../../models/framework.model.js';

// ============================================================
// Types
// ============================================================

export interface SourceReference {
  documentId: string;
  filename: string;
  format: string;
  pageRef?: number;
  cellRef?: string;
  uploadSource: string;
  uploadedAt: Date;
}

export interface AuditTrailEntry {
  action: string;
  userId?: string;
  timestamp: Date;
  previousValue?: unknown;
  newValue?: unknown;
  notes?: string;
}

export interface EvidenceItem {
  dataPointId: string;
  metricName: string;
  frameworkRef: string;
  value: number | string;
  unit: string;
  period: { year: number; quarter?: number };
  status: string;
  confidence: string;
  extractionMethod: string;
  sourceDocument: SourceReference | null;
  calculationMethodology: string | null;
  auditTrail: AuditTrailEntry[];
  confirmedBy: string | null;
  confirmedAt: Date | null;
}

export interface DisclosureEvidence {
  disclosureCode: string;
  disclosureName: string;
  frameworkCode: string;
  topic: string;
  evidenceItems: EvidenceItem[];
  completeness: {
    required: number;
    provided: number;
    percentage: number;
  };
}

export interface AssurancePack {
  engagementId: string;
  generatedAt: Date;
  disclosures: DisclosureEvidence[];
  summary: {
    totalDisclosures: number;
    fullyEvidenced: number;
    partiallyEvidenced: number;
    noEvidence: number;
    totalDataPoints: number;
    withSourceDoc: number;
    withAuditTrail: number;
  };
}

// ============================================================
// Evidence Chain Builder
// ============================================================

async function buildEvidenceItem(dp: IDataPoint): Promise<EvidenceItem> {
  let sourceDocument: SourceReference | null = null;

  const sourceDocId = dp.sourceDocumentId || dp.documentId;
  if (sourceDocId) {
    const doc = await ESGDocumentModel.findById(sourceDocId).lean();
    if (doc) {
      sourceDocument = {
        documentId: doc._id.toString(),
        filename: doc.filename,
        format: doc.format,
        pageRef: dp.sourcePage,
        cellRef: dp.sourceCell,
        uploadSource: doc.uploadSource,
        uploadedAt: doc.uploadedAt,
      };
    }
  }

  // Find calculation methodology from audit trail or extraction method
  let calculationMethodology: string | null = null;
  const estimateEntry = dp.auditTrail.find((a) => a.action === 'estimated');
  if (estimateEntry?.notes) {
    calculationMethodology = estimateEntry.notes;
  } else if (dp.extractionMethod === 'calculation') {
    calculationMethodology = 'Calculated value';
  }

  // Find confirmation details
  const confirmEntry = [...dp.auditTrail].reverse().find(
    (a) => a.action === 'confirmed' || a.action === 'created',
  );

  return {
    dataPointId: dp._id.toString(),
    metricName: dp.metricName,
    frameworkRef: dp.frameworkRef,
    value: dp.value,
    unit: dp.unit,
    period: dp.period,
    status: dp.status,
    confidence: dp.confidence,
    extractionMethod: dp.extractionMethod,
    sourceDocument,
    calculationMethodology,
    auditTrail: dp.auditTrail.map((a) => ({
      action: a.action,
      userId: a.userId,
      timestamp: a.timestamp,
      previousValue: a.previousValue,
      newValue: a.newValue,
      notes: a.notes,
    })),
    confirmedBy: confirmEntry?.userId || null,
    confirmedAt: confirmEntry?.timestamp || null,
  };
}

// ============================================================
// Assurance Pack Generator
// ============================================================

export async function generateAssurancePack(
  engagementId: string,
): Promise<AssurancePack> {
  const engObjId = new mongoose.Types.ObjectId(engagementId);

  const dataPoints = await DataPointModel.find({ engagementId: engObjId }).lean() as unknown as IDataPoint[];

  // Group data points by frameworkRef
  const byRef = new Map<string, IDataPoint[]>();
  for (const dp of dataPoints) {
    if (!byRef.has(dp.frameworkRef)) {
      byRef.set(dp.frameworkRef, []);
    }
    byRef.get(dp.frameworkRef)!.push(dp);
  }

  // Build evidence for each disclosure
  const disclosures: DisclosureEvidence[] = [];

  for (const [ref, dps] of byRef) {
    // Try to find the disclosure metadata
    const fwCode = ref.split('-')[0] || ref;
    const discCode = ref.replace(`${fwCode}-`, '');

    let disclosureName = ref;
    let topic = 'Unknown';
    let requiredCount = dps.length;

    // Look up in Disclosure collection
    const disc = await Disclosure.findOne({
      $or: [{ code: discCode }, { code: ref }],
      frameworkCode: fwCode,
    }).lean();

    if (disc) {
      disclosureName = disc.name;
      topic = disc.topic;
      requiredCount = Math.max(disc.requiredMetrics.length, 1);
    } else {
      // Fallback: look in Framework doc
      const fw = await Framework.findOne({ code: fwCode }).lean();
      if (fw) {
        for (const t of fw.structure.topics) {
          const d = t.disclosures.find(
            (d) => d.code === discCode || `${fwCode}-${d.code}` === ref,
          );
          if (d) {
            disclosureName = d.name;
            topic = d.topic;
            requiredCount = Math.max(d.requiredMetrics.length, 1);
            break;
          }
        }
      }
    }

    const evidenceItems: EvidenceItem[] = [];
    for (const dp of dps) {
      evidenceItems.push(await buildEvidenceItem(dp));
    }

    const providedCount = evidenceItems.filter(
      (e) => e.status !== 'missing',
    ).length;

    disclosures.push({
      disclosureCode: ref,
      disclosureName,
      frameworkCode: fwCode,
      topic,
      evidenceItems,
      completeness: {
        required: requiredCount,
        provided: providedCount,
        percentage: requiredCount > 0
          ? Math.round((providedCount / requiredCount) * 100)
          : 0,
      },
    });
  }

  // Summary stats
  const totalDataPoints = dataPoints.length;
  const withSourceDoc = dataPoints.filter(
    (dp) => dp.sourceDocumentId || dp.documentId,
  ).length;
  const withAuditTrail = dataPoints.filter(
    (dp) => dp.auditTrail.length > 0,
  ).length;

  const fullyEvidenced = disclosures.filter(
    (d) => d.completeness.percentage === 100,
  ).length;
  const partiallyEvidenced = disclosures.filter(
    (d) => d.completeness.percentage > 0 && d.completeness.percentage < 100,
  ).length;
  const noEvidence = disclosures.filter(
    (d) => d.completeness.percentage === 0,
  ).length;

  return {
    engagementId,
    generatedAt: new Date(),
    disclosures,
    summary: {
      totalDisclosures: disclosures.length,
      fullyEvidenced,
      partiallyEvidenced,
      noEvidence,
      totalDataPoints,
      withSourceDoc,
      withAuditTrail,
    },
  };
}

// ============================================================
// Single Disclosure Evidence
// ============================================================

export async function getDisclosureEvidence(
  engagementId: string,
  disclosureId: string,
): Promise<DisclosureEvidence | null> {
  const engObjId = new mongoose.Types.ObjectId(engagementId);

  // Find data points matching this disclosure reference
  const dataPoints = await DataPointModel.find({
    engagementId: engObjId,
    frameworkRef: disclosureId,
  }).lean() as unknown as IDataPoint[];

  if (dataPoints.length === 0) {
    return null;
  }

  const fwCode = disclosureId.split('-')[0] || disclosureId;
  const discCode = disclosureId.replace(`${fwCode}-`, '');

  let disclosureName = disclosureId;
  let topic = 'Unknown';
  let requiredCount = dataPoints.length;

  // Look up disclosure metadata
  const disc = await Disclosure.findOne({
    $or: [{ code: discCode }, { code: disclosureId }],
    frameworkCode: fwCode,
  }).lean();

  if (disc) {
    disclosureName = disc.name;
    topic = disc.topic;
    requiredCount = Math.max(disc.requiredMetrics.length, 1);
  } else {
    const fw = await Framework.findOne({ code: fwCode }).lean();
    if (fw) {
      for (const t of fw.structure.topics) {
        const d = t.disclosures.find(
          (d) => d.code === discCode || `${fwCode}-${d.code}` === disclosureId,
        );
        if (d) {
          disclosureName = d.name;
          topic = d.topic;
          requiredCount = Math.max(d.requiredMetrics.length, 1);
          break;
        }
      }
    }
  }

  const evidenceItems: EvidenceItem[] = [];
  for (const dp of dataPoints) {
    evidenceItems.push(await buildEvidenceItem(dp));
  }

  const providedCount = evidenceItems.filter(
    (e) => e.status !== 'missing',
  ).length;

  return {
    disclosureCode: disclosureId,
    disclosureName,
    frameworkCode: fwCode,
    topic,
    evidenceItems,
    completeness: {
      required: requiredCount,
      provided: providedCount,
      percentage: requiredCount > 0
        ? Math.round((providedCount / requiredCount) * 100)
        : 0,
    },
  };
}
