import { z } from 'zod';
import {
  OrganizationSchema,
  OrgTypeSchema,
  PlanTierSchema,
  OrgSettingsSchema,
  BrandingConfigSchema,
  OrgProfileSchema,
  ListingStatusSchema,
  MaturityLevelSchema,
  FacilitySchema,
  ReportingHistoryEntrySchema,
} from '../validators/schemas.js';

export type Organization = z.infer<typeof OrganizationSchema>;
export type OrgType = z.infer<typeof OrgTypeSchema>;
export type PlanTier = z.infer<typeof PlanTierSchema>;
export type OrgSettings = z.infer<typeof OrgSettingsSchema>;
export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
export type OrgProfile = z.infer<typeof OrgProfileSchema>;
export type ListingStatus = z.infer<typeof ListingStatusSchema>;
export type MaturityLevel = z.infer<typeof MaturityLevelSchema>;
export type Facility = z.infer<typeof FacilitySchema>;
export type ReportingHistoryEntry = z.infer<typeof ReportingHistoryEntrySchema>;
