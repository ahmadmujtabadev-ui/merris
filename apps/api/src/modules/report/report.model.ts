import mongoose, { Schema, Document } from 'mongoose';

// ============================================================
// ReviewComment Sub-document
// ============================================================

export interface IReviewComment {
  userId: string;
  content: string;
  timestamp: Date;
  resolved: boolean;
}

const ReviewCommentSubSchema = new Schema<IReviewComment>(
  {
    userId: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    resolved: { type: Boolean, default: false },
  },
  { _id: false },
);

// ============================================================
// ReportSection Sub-document
// ============================================================

export interface IReportSection {
  id: string;
  title: string;
  frameworkRef?: string;
  disclosures: string[];
  content?: string;
  dataPoints: string[];
  status: 'pending' | 'drafted' | 'reviewed' | 'approved';
  reviewComments: IReviewComment[];
}

const ReportSectionSubSchema = new Schema<IReportSection>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    frameworkRef: { type: String },
    disclosures: [{ type: String }],
    content: { type: String },
    dataPoints: [{ type: String }],
    status: {
      type: String,
      enum: ['pending', 'drafted', 'reviewed', 'approved'],
      default: 'pending',
    },
    reviewComments: [ReviewCommentSubSchema],
  },
  { _id: false },
);

// ============================================================
// Report Model
// ============================================================

export interface IReport extends Document {
  engagementId: mongoose.Types.ObjectId;
  title: string;
  type: 'sustainability_report' | 'esg_report' | 'tcfd_report' | 'integrated_report' | 'cdp_response' | 'custom';
  language: 'en' | 'ar' | 'bilingual';
  status: 'draft' | 'in_review' | 'partner_approved' | 'client_approved' | 'final';
  structure: IReportSection[];
  generatedAt?: Date;
  exportFormats: Array<'docx' | 'pdf' | 'html'>;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    engagementId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ['sustainability_report', 'esg_report', 'tcfd_report', 'integrated_report', 'cdp_response', 'custom'],
      required: true,
    },
    language: {
      type: String,
      enum: ['en', 'ar', 'bilingual'],
      default: 'en',
    },
    status: {
      type: String,
      enum: ['draft', 'in_review', 'partner_approved', 'client_approved', 'final'],
      default: 'draft',
    },
    structure: [ReportSectionSubSchema],
    generatedAt: { type: Date },
    exportFormats: [{ type: String, enum: ['docx', 'pdf', 'html'] }],
  },
  { timestamps: true },
);

export const ReportModel = mongoose.model<IReport>('Report', ReportSchema);
