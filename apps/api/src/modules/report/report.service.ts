import mongoose from 'mongoose';
import { ReportModel } from './report.model.js';
import type { IReport, IReportSection, IReviewComment } from './report.model.js';
import { AppError } from '../auth/auth.service.js';

// ============================================================
// Create Report
// ============================================================

interface CreateReportInput {
  engagementId: string;
  title: string;
  type: IReport['type'];
  language?: IReport['language'];
  sections?: Array<{
    title: string;
    frameworkRef?: string;
    disclosures?: string[];
  }>;
}

export async function createReport(input: CreateReportInput): Promise<IReport> {
  const structure: IReportSection[] = (input.sections ?? []).map((s, idx) => ({
    id: new mongoose.Types.ObjectId().toString(),
    title: s.title,
    frameworkRef: s.frameworkRef,
    disclosures: s.disclosures ?? [],
    content: undefined,
    dataPoints: [],
    status: 'pending' as const,
    reviewComments: [],
  }));

  const report = await ReportModel.create({
    engagementId: new mongoose.Types.ObjectId(input.engagementId),
    title: input.title,
    type: input.type,
    language: input.language ?? 'en',
    status: 'draft',
    structure,
    exportFormats: ['docx', 'pdf'],
  });

  return report;
}

// ============================================================
// List Reports for Engagement
// ============================================================

export async function listReports(engagementId: string): Promise<IReport[]> {
  return ReportModel.find({
    engagementId: new mongoose.Types.ObjectId(engagementId),
  })
    .sort({ updatedAt: -1 })
    .lean()
    .exec() as unknown as IReport[];
}

// ============================================================
// Get Report by ID
// ============================================================

export async function getReport(reportId: string): Promise<IReport> {
  const report = await ReportModel.findById(reportId).exec();
  if (!report) {
    throw new AppError('Report not found', 404);
  }
  return report;
}

// ============================================================
// Update Report Metadata
// ============================================================

interface UpdateReportInput {
  title?: string;
  language?: IReport['language'];
  status?: IReport['status'];
}

export async function updateReport(
  reportId: string,
  input: UpdateReportInput,
): Promise<IReport> {
  const report = await ReportModel.findByIdAndUpdate(
    reportId,
    { $set: input },
    { new: true, runValidators: true },
  ).exec();

  if (!report) {
    throw new AppError('Report not found', 404);
  }
  return report;
}

// ============================================================
// Update Section Content / Status
// ============================================================

interface UpdateSectionInput {
  title?: string;
  content?: string;
  status?: IReportSection['status'];
}

export async function updateSection(
  reportId: string,
  sectionId: string,
  input: UpdateSectionInput,
): Promise<IReport> {
  const report = await ReportModel.findById(reportId).exec();
  if (!report) {
    throw new AppError('Report not found', 404);
  }

  const section = report.structure.find((s) => s.id === sectionId);
  if (!section) {
    throw new AppError('Section not found', 404);
  }

  if (input.title !== undefined) section.title = input.title;
  if (input.content !== undefined) section.content = input.content;
  if (input.status !== undefined) section.status = input.status;

  await report.save();
  return report;
}

// ============================================================
// Add Review Comment
// ============================================================

interface AddReviewInput {
  userId: string;
  content: string;
}

export async function addReviewComment(
  reportId: string,
  sectionId: string,
  input: AddReviewInput,
): Promise<IReport> {
  const report = await ReportModel.findById(reportId).exec();
  if (!report) {
    throw new AppError('Report not found', 404);
  }

  const section = report.structure.find((s) => s.id === sectionId);
  if (!section) {
    throw new AppError('Section not found', 404);
  }

  const comment: IReviewComment = {
    userId: input.userId,
    content: input.content,
    timestamp: new Date(),
    resolved: false,
  };

  section.reviewComments.push(comment);
  await report.save();
  return report;
}

// ============================================================
// Export Report (Stub)
// ============================================================

interface ExportResult {
  format: string;
  url: string;
  message: string;
}

export async function exportReport(
  reportId: string,
  format: 'docx' | 'pdf' | 'html',
): Promise<ExportResult> {
  const report = await ReportModel.findById(reportId).exec();
  if (!report) {
    throw new AppError('Report not found', 404);
  }

  // Stub: in production, this would generate the actual document
  return {
    format,
    url: `/exports/${reportId}.${format}`,
    message: `Export to ${format.toUpperCase()} is queued. Download link will be available shortly.`,
  };
}
