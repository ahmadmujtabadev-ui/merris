/**
 * Knowledge Report Model
 *
 * Stores deeply extracted data from sustainability report PDFs.
 * Links to K1 CorporateDisclosure entries for catalog integration.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ============================================================
// Metric interface
// ============================================================

export interface IExtractedMetric {
  name: string;
  value: number | string;
  unit: string;
  frameworkRef: string;
  yearOverYear?: number;
  context: string;
  pageRef: number;
  confidence: number;
}

// ============================================================
// Narrative interface
// ============================================================

export interface IExtractedNarrative {
  frameworkRef: string;
  title: string;
  content: string;
  qualityScore: number;
  wordCount: number;
  hasQuantitativeData: boolean;
  hasYoYComparison: boolean;
  hasMethodology: boolean;
  hasPeerContext: boolean;
  pageRef: number;
}

// ============================================================
// Quality interface
// ============================================================

export interface IReportQuality {
  overallScore: number;
  frameworkCoverage: number;
  dataCompleteness: number;
  narrativeQuality: number;
  assuranceLevel: 'none' | 'limited' | 'reasonable';
  frameworks: string[];
}

// ============================================================
// Knowledge Report document interface
// ============================================================

export interface IKnowledgeReport extends Document {
  disclosureId?: Types.ObjectId;
  company: string;
  reportYear: number;
  sector: string;
  country: string;
  metrics: IExtractedMetric[];
  narratives: IExtractedNarrative[];
  quality: IReportQuality;
  fullText?: string;
  vectorEmbeddingId?: string;
  extractedAt: Date;
  processingTime: number;
}

// ============================================================
// Schema
// ============================================================

const ExtractedMetricSchema = new Schema<IExtractedMetric>(
  {
    name: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    unit: { type: String, required: true },
    frameworkRef: { type: String, required: true },
    yearOverYear: Number,
    context: { type: String, default: '' },
    pageRef: { type: Number, default: 0 },
    confidence: { type: Number, default: 0.5 },
  },
  { _id: false }
);

const ExtractedNarrativeSchema = new Schema<IExtractedNarrative>(
  {
    frameworkRef: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    qualityScore: { type: Number, default: 0 },
    wordCount: { type: Number, default: 0 },
    hasQuantitativeData: { type: Boolean, default: false },
    hasYoYComparison: { type: Boolean, default: false },
    hasMethodology: { type: Boolean, default: false },
    hasPeerContext: { type: Boolean, default: false },
    pageRef: { type: Number, default: 0 },
  },
  { _id: false }
);

const ReportQualitySchema = new Schema<IReportQuality>(
  {
    overallScore: { type: Number, default: 0 },
    frameworkCoverage: { type: Number, default: 0 },
    dataCompleteness: { type: Number, default: 0 },
    narrativeQuality: { type: Number, default: 0 },
    assuranceLevel: { type: String, enum: ['none', 'limited', 'reasonable'], default: 'none' },
    frameworks: { type: [String], default: [] },
  },
  { _id: false }
);

const KnowledgeReportSchema = new Schema<IKnowledgeReport>(
  {
    disclosureId: { type: Schema.Types.ObjectId, ref: 'CorporateDisclosure', index: true },
    company: { type: String, required: true },
    reportYear: { type: Number, required: true },
    sector: { type: String, required: true, index: true },
    country: { type: String, required: true, index: true },
    metrics: { type: [ExtractedMetricSchema], default: [] },
    narratives: { type: [ExtractedNarrativeSchema], default: [] },
    quality: { type: ReportQualitySchema, default: () => ({}) },
    fullText: String,
    vectorEmbeddingId: String,
    extractedAt: { type: Date, default: Date.now },
    processingTime: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Indexes
KnowledgeReportSchema.index({ company: 1, reportYear: 1 }, { unique: true });
KnowledgeReportSchema.index({ sector: 1, 'quality.overallScore': -1 });
KnowledgeReportSchema.index({ 'metrics.frameworkRef': 1 });
KnowledgeReportSchema.index({ 'metrics.name': 1, sector: 1 });

export const KnowledgeReportModel = mongoose.model<IKnowledgeReport>(
  'KnowledgeReport',
  KnowledgeReportSchema,
  'kb_knowledge_reports'
);
