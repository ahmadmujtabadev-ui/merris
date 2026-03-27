import { z } from 'zod';
import {
  EngagementSchema,
  EngagementStatusSchema,
  EngagementScopeSchema,
  EngagementSettingsSchema,
  ReportTypeSchema,
} from '../validators/schemas.js';

export type Engagement = z.infer<typeof EngagementSchema>;
export type EngagementStatus = z.infer<typeof EngagementStatusSchema>;
export type EngagementScope = z.infer<typeof EngagementScopeSchema>;
export type EngagementSettings = z.infer<typeof EngagementSettingsSchema>;
export type ReportType = z.infer<typeof ReportTypeSchema>;
