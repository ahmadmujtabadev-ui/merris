/**
 * Merris Work Product Generation Engine (Capability 5)
 *
 * Generates full ESG reports, assurance evidence packs, and executive summaries
 * by combining framework requirements, confirmed data, and AI-powered narrative.
 */

import mongoose from 'mongoose';
import { Framework } from '../../models/framework.model.js';
import { DataPointModel } from '../ingestion/ingestion.model.js';
import { ESGDocumentModel } from '../ingestion/ingestion.model.js';
import { ReportModel, type IReportSection } from '../report/report.model.js';
import { getCompleteness } from '../data-collection/data-collection.service.js';
import { sendMessage } from '../../lib/claude.js';
import { judgeSection, type JudgmentLevel } from './judgment.js';
import { logger } from '../../lib/logger.js';

// ============================================================
// Types
// ============================================================

export interface GenerateReportOptions {
  engagementId: string;
  language: 'en' | 'ar' | 'bilingual';
  qualityLevel: JudgmentLevel;
}

export interface GeneratedReport {
  title: string;
  executiveSummary: string;
  sections: GeneratedSection[];
  qualityScore: number;
  totalSections: number;
  generatedSections: number;
  existingSections: number;
  language: string;
  generatedAt: Date;
}

export interface GeneratedSection {
  title: string;
  frameworkRef: string;
  content: string;
  dataTable: DataTableEntry[] | null;
  crossReferences: string[];
  evidenceCitations: string[];
  qualityScore: number;
  status: 'existing' | 'generated';
}

export interface DataTableEntry {
  metric: string;
  value: number | string;
  unit: string;
  period: string;
  source: string;
  confidence: string;
}

export interface AssurancePack {
  engagementId: string;
  evidenceSummary: EvidenceItem[];
  methodologyNotes: string[];
  dataTraceability: DataTraceItem[];
  generatedAt: Date;
}

export interface EvidenceItem {
  disclosureCode: string;
  disclosureName: string;
  dataPoints: Array<{
    metric: string;
    value: number | string;
    unit: string;
    sourceDocument: string;
    extractionMethod: string;
    confirmationStatus: string;
    auditTrail: string[];
  }>;
  completeness: 'full' | 'partial' | 'missing';
}

export interface DataTraceItem {
  metric: string;
  sourceDocument: string;
  sourceReference: string;
  extractionMethod: string;
  confirmedBy: string;
  confirmationDate: Date | null;
}

// ============================================================
// 1. Full Report Generation
// ============================================================

export async function generateFullReport(
  options: GenerateReportOptions
): Promise<GeneratedReport> {
  const { engagementId, language, qualityLevel } = options;
  const engObjId = new (mongoose.Types.ObjectId as any)(engagementId);

  // Fetch engagement info, frameworks, data points, and existing report in parallel
  const [engagement, frameworks, dataPoints, existingReport, completeness] = await Promise.all([
    getEngagementInfo(engagementId),
    getEngagementFrameworks(engagementId),
    DataPointModel.find({ engagementId: engObjId }).lean() as any,
    ReportModel.findOne({ engagementId: engObjId }).sort({ updatedAt: -1 }).lean() as any,
    getCompleteness(engagementId).catch(() => null),
  ]);

  const engName = engagement?.name || 'ESG Report';
  const reportTitle = `${engName} — Sustainability Report`;

  // Build report structure from framework requirements
  const sectionDefinitions = buildReportStructure(frameworks);

  // Process each section
  const generatedSections: GeneratedSection[] = [];
  let existingCount = 0;
  let generatedCount = 0;

  for (const sectionDef of sectionDefinitions) {
    // Check if draft exists in existing report
    const existingSection = existingReport?.structure?.find(
      (s: any) => s.frameworkRef === sectionDef.frameworkRef || s.title === sectionDef.title
    );

    // Gather relevant data points for this section
    const sectionDataPoints = (dataPoints as any[]).filter((dp: any) =>
      dp.frameworkRef?.includes(sectionDef.frameworkCode)
    );

    // Build data table
    const dataTable: DataTableEntry[] = sectionDataPoints.map((dp: any) => ({
      metric: dp.metricName,
      value: dp.value,
      unit: dp.unit,
      period: `${dp.period?.year || 'N/A'}${dp.period?.quarter ? ` Q${dp.period.quarter}` : ''}`,
      source: dp.extractionMethod,
      confidence: dp.confidence,
    }));

    // Build cross-references
    const crossReferences = sectionDef.crossRefs.map(
      (cr: any) => `${cr.frameworkCode} ${cr.disclosureCode} (${cr.mappingType})`
    );

    // Build evidence citations
    const evidenceCitations = sectionDataPoints
      .filter((dp: any) => dp.sourceDocumentId)
      .map((dp: any) => `${dp.metricName}: Document ${dp.sourceDocumentId}${dp.sourcePage ? `, p.${dp.sourcePage}` : ''}${dp.sourceCell ? `, cell ${dp.sourceCell}` : ''}`);

    let content: string;
    let status: 'existing' | 'generated';

    if (existingSection?.content && existingSection.content.length > 50) {
      // Use existing draft
      content = existingSection.content;
      status = 'existing';
      existingCount++;
    } else {
      // Generate with AI
      content = await generateSectionContent(
        sectionDef,
        sectionDataPoints,
        engagement,
        language
      );
      status = 'generated';
      generatedCount++;
    }

    // Run quality judgment (non-blocking for 'quick' level)
    let qualityScore = 0;
    try {
      const judgment = await judgeSection({
        engagementId,
        sectionContent: content,
        sectionTitle: sectionDef.title,
        frameworkRef: sectionDef.frameworkRef,
        judgmentLevel: qualityLevel === 'partner_review' ? 'thorough' : 'quick',
      });
      qualityScore = judgment.score;
    } catch {
      qualityScore = 50; // Default if judgment fails
    }

    generatedSections.push({
      title: sectionDef.title,
      frameworkRef: sectionDef.frameworkRef,
      content,
      dataTable: dataTable.length > 0 ? dataTable : null,
      crossReferences,
      evidenceCitations,
      qualityScore,
      status,
    });
  }

  // Generate executive summary by synthesizing all sections
  const executiveSummary = await generateExecutiveSummaryFromSections(
    engName,
    generatedSections,
    completeness,
    engagement,
    language
  );

  // Calculate overall quality score
  const scores = generatedSections.map(s => s.qualityScore);
  const overallScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return {
    title: reportTitle,
    executiveSummary,
    sections: generatedSections,
    qualityScore: overallScore,
    totalSections: generatedSections.length,
    generatedSections: generatedCount,
    existingSections: existingCount,
    language,
    generatedAt: new Date(),
  };
}

// ============================================================
// 2. Assurance Evidence Pack
// ============================================================

export async function generateAssurancePack(engagementId: string): Promise<AssurancePack> {
  const engObjId = new (mongoose.Types.ObjectId as any)(engagementId);

  const [frameworks, dataPoints, documents] = await Promise.all([
    getEngagementFrameworks(engagementId),
    DataPointModel.find({ engagementId: engObjId }).lean() as any,
    ESGDocumentModel.find({ engagementId: engObjId, status: 'ingested' }).lean() as any,
  ]);

  // Build document lookup
  const docMap = new Map<string, string>();
  for (const doc of documents as any[]) {
    docMap.set(doc._id.toString(), doc.filename);
  }

  // Build evidence summary per disclosure
  const evidenceSummary: EvidenceItem[] = [];

  for (const fw of frameworks) {
    for (const topic of fw.topics) {
      for (const disc of topic.disclosures) {
        const relatedDps = (dataPoints as any[]).filter((dp: any) =>
          dp.frameworkRef?.includes(disc.code)
        );

        const dpEntries = relatedDps.map((dp: any) => ({
          metric: dp.metricName,
          value: dp.value,
          unit: dp.unit,
          sourceDocument: dp.sourceDocumentId ? (docMap.get(dp.sourceDocumentId.toString()) || 'Unknown') : 'No source',
          extractionMethod: dp.extractionMethod,
          confirmationStatus: dp.status,
          auditTrail: (dp.auditTrail || []).map(
            (a: any) => `${a.action} by ${a.userId || 'system'} at ${new Date(a.timestamp).toISOString()}`
          ),
        }));

        if (relatedDps.length > 0 || disc.dataType === 'quantitative') {
          evidenceSummary.push({
            disclosureCode: disc.code,
            disclosureName: disc.name,
            dataPoints: dpEntries,
            completeness: relatedDps.length === 0
              ? 'missing'
              : relatedDps.every((dp: any) => dp.status === 'user_confirmed' || dp.status === 'user_edited')
                ? 'full'
                : 'partial',
          });
        }
      }
    }
  }

  // Build data traceability
  const dataTraceability: DataTraceItem[] = (dataPoints as any[])
    .filter((dp: any) => dp.sourceDocumentId)
    .map((dp: any) => {
      const lastConfirmation = (dp.auditTrail || [])
        .filter((a: any) => a.action === 'confirmed')
        .pop();
      return {
        metric: dp.metricName,
        sourceDocument: docMap.get(dp.sourceDocumentId?.toString()) || 'Unknown',
        sourceReference: dp.sourcePage ? `Page ${dp.sourcePage}` : dp.sourceCell ? `Cell ${dp.sourceCell}` : 'N/A',
        extractionMethod: dp.extractionMethod,
        confirmedBy: lastConfirmation?.userId || 'Not confirmed',
        confirmationDate: lastConfirmation?.timestamp ? new Date(lastConfirmation.timestamp) : null,
      };
    });

  // Generate methodology notes
  const methodologyNotes = generateMethodologyNotes(frameworks, dataPoints as any[]);

  return {
    engagementId,
    evidenceSummary,
    methodologyNotes,
    dataTraceability,
    generatedAt: new Date(),
  };
}

// ============================================================
// 3. Executive Summary Generation
// ============================================================

export async function generateExecutiveSummary(engagementId: string): Promise<string> {
  const engObjId = new (mongoose.Types.ObjectId as any)(engagementId);

  const [engagement, dataPoints, completeness, existingReport] = await Promise.all([
    getEngagementInfo(engagementId),
    DataPointModel.find({ engagementId: engObjId }).lean() as any,
    getCompleteness(engagementId).catch(() => null),
    ReportModel.findOne({ engagementId: engObjId }).sort({ updatedAt: -1 }).lean() as any,
  ]);

  const engName = engagement?.name || 'This engagement';

  // Build key metrics summary
  const confirmed = (dataPoints as any[]).filter((dp: any) => dp.status === 'user_confirmed').length;
  const total = (dataPoints as any[]).length;
  const completenessPercentage = completeness?.overall?.percentage ?? 0;

  // Count report sections by status
  const reportSections = existingReport?.structure || [];
  const drafted = reportSections.filter((s: any) => s.status === 'drafted' || s.status === 'reviewed' || s.status === 'approved').length;
  const pending = reportSections.filter((s: any) => s.status === 'pending').length;

  // Critical issues
  const missing = (dataPoints as any[]).filter((dp: any) => dp.status === 'missing').length;
  const lowConfidence = (dataPoints as any[]).filter((dp: any) => dp.confidence === 'low').length;

  const summaryContext = `
Engagement: ${engName}
Data completeness: ${completenessPercentage}%
Data points: ${total} total, ${confirmed} confirmed, ${missing} missing
Report sections: ${drafted} drafted, ${pending} pending
Low confidence data: ${lowConfidence} points
Deadline: ${engagement?.deadline || 'Not set'}
`;

  const response = await sendMessage({
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1000,
    system: `You are a senior ESG advisor writing an executive summary for a sustainability engagement status report.
Be concise (3-4 paragraphs), professional, and focus on: overall progress, key achievements, critical gaps, and recommended next steps.
Do not fabricate data — only reference the metrics provided.`,
    messages: [{ role: 'user', content: `Generate an executive summary for this ESG engagement:\n${summaryContext}` }],
  });

  if (!response) {
    // Deterministic fallback
    const parts: string[] = [];
    parts.push(`${engName} is currently at ${completenessPercentage}% data completeness with ${confirmed} of ${total} data points confirmed.`);
    if (drafted > 0) parts.push(`${drafted} report sections have been drafted.`);
    if (missing > 0) parts.push(`${missing} data points remain missing and require collection.`);
    if (lowConfidence > 0) parts.push(`${lowConfidence} data points have low confidence and should be reviewed.`);
    if (pending > 0) parts.push(`${pending} report sections are still pending initial drafting.`);
    return parts.join(' ');
  }

  return response;
}

// ============================================================
// Internal Helpers
// ============================================================

interface SectionDefinition {
  title: string;
  frameworkRef: string;
  frameworkCode: string;
  disclosureCode: string;
  disclosureName: string;
  dataType: string;
  guidanceText: string;
  crossRefs: Array<{ frameworkCode: string; disclosureCode: string; mappingType: string }>;
}

function buildReportStructure(frameworks: FrameworkInfo[]): SectionDefinition[] {
  const sections: SectionDefinition[] = [];

  for (const fw of frameworks) {
    for (const topic of fw.topics) {
      for (const disc of topic.disclosures) {
        sections.push({
          title: `${disc.code}: ${disc.name}`,
          frameworkRef: `${fw.code} ${disc.code}`,
          frameworkCode: fw.code,
          disclosureCode: disc.code,
          disclosureName: disc.name,
          dataType: disc.dataType,
          guidanceText: disc.guidanceText || '',
          crossRefs: disc.crossReferences || [],
        });
      }
    }
  }

  return sections;
}

async function generateSectionContent(
  sectionDef: SectionDefinition,
  dataPoints: any[],
  engagement: any,
  language: string
): Promise<string> {
  const dataContext = dataPoints
    .slice(0, 15)
    .map((dp: any) => `${dp.metricName}: ${dp.value} ${dp.unit} (${dp.confidence}, ${dp.status})`)
    .join('\n');

  const languageInstruction = language === 'ar'
    ? 'Write the disclosure in Arabic.'
    : language === 'bilingual'
      ? 'Write the disclosure in English, then provide an Arabic translation below.'
      : 'Write the disclosure in English.';

  const prompt = `Generate a professional ESG disclosure narrative for:

DISCLOSURE: ${sectionDef.disclosureCode} — ${sectionDef.disclosureName}
FRAMEWORK: ${sectionDef.frameworkCode}
DATA TYPE: ${sectionDef.dataType}
GUIDANCE: ${sectionDef.guidanceText.substring(0, 500)}
ORGANIZATION: ${engagement?.name || 'The organization'}

AVAILABLE DATA:
${dataContext || 'No confirmed data available yet.'}

${languageInstruction}

REQUIREMENTS:
- Reference specific data points with values and units
- Include year-on-year comparison if multiple periods exist
- Cite methodology (e.g., GHG Protocol for emissions)
- Be factual — do not fabricate data beyond what is provided
- Minimum 100 words for narrative disclosures
- For quantitative disclosures, include a data summary paragraph`;

  const response = await sendMessage({
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1500,
    system: 'You are an expert ESG report writer for a Big 4 consulting firm. Write professional, auditable disclosure narratives.',
    messages: [{ role: 'user', content: prompt }],
  });

  if (!response) {
    return `[Draft pending — ${sectionDef.disclosureCode}: ${sectionDef.disclosureName}]\n\nData points available: ${dataPoints.length}. Awaiting AI generation.`;
  }

  return response;
}

async function generateExecutiveSummaryFromSections(
  engName: string,
  sections: GeneratedSection[],
  completeness: any,
  engagement: any,
  language: string
): Promise<string> {
  const sectionSummaries = sections
    .slice(0, 20)
    .map(s => `${s.title}: score ${s.qualityScore}/100, ${s.status}`)
    .join('\n');

  const completenessStr = completeness?.overall?.percentage
    ? `${completeness.overall.percentage}%`
    : 'Unknown';

  const prompt = `Synthesize an executive summary for the "${engName}" sustainability report.

SECTION OVERVIEW:
${sectionSummaries}

DATA COMPLETENESS: ${completenessStr}
TOTAL SECTIONS: ${sections.length}
AVERAGE QUALITY: ${Math.round(sections.reduce((a, s) => a + s.qualityScore, 0) / Math.max(sections.length, 1))}/100

Write 3-4 paragraphs covering: key highlights, material topics addressed, data quality status, and recommendations.
${language === 'ar' ? 'Write in Arabic.' : language === 'bilingual' ? 'Write in English then Arabic.' : 'Write in English.'}`;

  const response = await sendMessage({
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1000,
    system: 'You are a senior ESG partner writing an executive summary for a sustainability report.',
    messages: [{ role: 'user', content: prompt }],
  });

  return response || `Executive summary for ${engName}. ${sections.length} sections generated. Data completeness: ${completenessStr}.`;
}

function generateMethodologyNotes(frameworks: FrameworkInfo[], dataPoints: any[]): string[] {
  const notes: string[] = [];

  // Detect frameworks used
  const frameworkCodes = new Set(frameworks.map(f => f.code));
  if (frameworkCodes.has('GRI')) {
    notes.push('GRI Standards 2021: Disclosures prepared in accordance with the GRI Universal Standards.');
  }
  if (frameworkCodes.has('ESRS')) {
    notes.push('ESRS: Disclosures align with European Sustainability Reporting Standards as adopted by the EU Commission.');
  }
  if (frameworkCodes.has('TCFD')) {
    notes.push('TCFD: Climate-related disclosures follow the recommendations of the Task Force on Climate-related Financial Disclosures.');
  }

  // Detect emission-related data
  const hasEmissions = dataPoints.some((dp: any) => /emission|scope|ghg|co2/i.test(dp.metricName));
  if (hasEmissions) {
    notes.push('GHG emissions calculated in accordance with the GHG Protocol Corporate Accounting and Reporting Standard.');
  }

  // Extraction methods
  const methods = new Set(dataPoints.map((dp: any) => dp.extractionMethod));
  if (methods.has('ocr')) {
    notes.push('Some data points were extracted via OCR from scanned documents and require manual verification.');
  }
  if (methods.has('llm_extract')) {
    notes.push('AI-assisted extraction was used for certain data points; all AI-extracted values are flagged for human review.');
  }
  if (methods.has('calculation')) {
    notes.push('Derived metrics were calculated using standard formulas; calculation methodologies are documented in the audit trail.');
  }

  return notes;
}

// ============================================================
// Shared helpers (same pattern as perception.ts)
// ============================================================

interface FrameworkInfo {
  code: string;
  name: string;
  type: string;
  topics: {
    code: string;
    name: string;
    disclosures: {
      code: string;
      name: string;
      dataType: string;
      guidanceText: string;
      crossReferences: Array<{ frameworkCode: string; disclosureCode: string; mappingType: string }>;
    }[];
  }[];
}

async function getEngagementFrameworks(engagementId: string): Promise<FrameworkInfo[]> {
  try {
    const db = mongoose.connection.db;
    if (!db) return [];
    const engagement = await db.collection('engagements').findOne({
      _id: new (mongoose.Types.ObjectId as any)(engagementId),
    });
    if (!engagement?.frameworks?.length) return [];

    const frameworks = await Framework.find({
      code: { $in: engagement.frameworks },
    }).lean();

    return frameworks.map((fw: any) => ({
      code: fw.code,
      name: fw.name,
      type: fw.type,
      topics: (fw.structure?.topics || []).map((t: any) => ({
        code: t.code,
        name: t.name,
        disclosures: (t.disclosures || []).map((d: any) => ({
          code: d.code,
          name: d.name,
          dataType: d.dataType,
          guidanceText: d.guidanceText || '',
          crossReferences: d.crossReferences || [],
        })),
      })),
    }));
  } catch {
    return [];
  }
}

async function getEngagementInfo(engagementId: string): Promise<any> {
  try {
    const db = mongoose.connection.db;
    if (!db) return null;
    return await db.collection('engagements').findOne({
      _id: new (mongoose.Types.ObjectId as any)(engagementId),
    });
  } catch {
    return null;
  }
}
