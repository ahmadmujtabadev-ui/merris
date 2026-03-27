import { z } from 'zod';
import {
  ReportSchema,
  ReportStatusSchema,
  ReportSectionSchema,
  ReviewCommentSchema,
} from '../validators/schemas.js';

export type Report = z.infer<typeof ReportSchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type ReportSection = z.infer<typeof ReportSectionSchema>;
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;
