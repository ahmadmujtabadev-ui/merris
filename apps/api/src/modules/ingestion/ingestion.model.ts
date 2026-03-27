import mongoose, { Schema, Document } from 'mongoose';

// ============================================================
// ESGDocument Model
// ============================================================

export interface IESGDocument extends Document {
  engagementId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  filename: string;
  format: string;
  size: number;
  hash: string;
  uploadSource: 'sharepoint' | 'manual' | 'email' | 'api';
  status: 'queued' | 'processing' | 'ingested' | 'failed';
  extractedData: Array<{
    metric: string;
    value: number | string;
    unit: string;
    confidence: number;
    pageRef?: number;
    cellRef?: string;
  }>;
  extractedText?: string;
  vectorEmbeddingId?: string;
  blobUrl?: string;
  localPath?: string;
  errorMessage?: string;
  uploadedAt: Date;
  processedAt?: Date;
}

const ExtractedDataPointSubSchema = new Schema(
  {
    metric: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    unit: { type: String, required: true },
    confidence: { type: Number, required: true },
    pageRef: { type: Number },
    cellRef: { type: String },
  },
  { _id: false }
);

const ESGDocumentSchema = new Schema<IESGDocument>(
  {
    engagementId: { type: Schema.Types.ObjectId, required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    filename: { type: String, required: true },
    format: { type: String, required: true },
    size: { type: Number, required: true },
    hash: { type: String, required: true },
    uploadSource: {
      type: String,
      enum: ['sharepoint', 'manual', 'email', 'api'],
      default: 'manual',
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'ingested', 'failed'],
      default: 'queued',
    },
    extractedData: [ExtractedDataPointSubSchema],
    extractedText: { type: String },
    vectorEmbeddingId: { type: String },
    blobUrl: { type: String },
    localPath: { type: String },
    errorMessage: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

ESGDocumentSchema.index({ engagementId: 1, status: 1 });

export const ESGDocumentModel = mongoose.model<IESGDocument>('ESGDocument', ESGDocumentSchema);

// ============================================================
// DataPoint Model
// ============================================================

export interface IAuditEntry {
  action: string;
  userId?: string;
  timestamp: Date;
  previousValue?: unknown;
  newValue?: unknown;
  notes?: string;
}

export interface IDataPoint extends Document {
  engagementId: mongoose.Types.ObjectId;
  documentId?: mongoose.Types.ObjectId;
  frameworkRef: string;
  metricName: string;
  value: number | string;
  unit: string;
  period: {
    year: number;
    quarter?: number;
  };
  sourceDocumentId?: mongoose.Types.ObjectId;
  sourcePage?: number;
  sourceCell?: string;
  confidence: 'high' | 'medium' | 'low';
  status: 'auto_extracted' | 'user_confirmed' | 'user_edited' | 'estimated' | 'missing';
  extractionMethod: 'ocr' | 'table_parse' | 'llm_extract' | 'calculation' | 'manual';
  auditTrail: IAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const AuditEntrySubSchema = new Schema(
  {
    action: { type: String, required: true },
    userId: { type: String },
    timestamp: { type: Date, default: Date.now },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    notes: { type: String },
  },
  { _id: false }
);

const DataPointSchema = new Schema<IDataPoint>(
  {
    engagementId: { type: Schema.Types.ObjectId, required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'ESGDocument' },
    frameworkRef: { type: String, required: true },
    metricName: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    unit: { type: String, required: true },
    period: {
      year: { type: Number, required: true },
      quarter: { type: Number },
    },
    sourceDocumentId: { type: Schema.Types.ObjectId, ref: 'ESGDocument' },
    sourcePage: { type: Number },
    sourceCell: { type: String },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low'],
      required: true,
    },
    status: {
      type: String,
      enum: ['auto_extracted', 'user_confirmed', 'user_edited', 'estimated', 'missing'],
      default: 'auto_extracted',
    },
    extractionMethod: {
      type: String,
      enum: ['ocr', 'table_parse', 'llm_extract', 'calculation', 'manual'],
      required: true,
    },
    auditTrail: [AuditEntrySubSchema],
  },
  { timestamps: true }
);

DataPointSchema.index({ engagementId: 1, frameworkRef: 1 });
DataPointSchema.index({ documentId: 1 });

export const DataPointModel = mongoose.model<IDataPoint>('DataPoint', DataPointSchema);
