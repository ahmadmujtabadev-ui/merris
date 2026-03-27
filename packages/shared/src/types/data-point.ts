import { z } from 'zod';
import {
  DataPointSchema,
  DataPointStatusSchema,
  ExtractionMethodSchema,
  AuditEntrySchema,
} from '../validators/schemas.js';

export type DataPoint = z.infer<typeof DataPointSchema>;
export type DataPointStatus = z.infer<typeof DataPointStatusSchema>;
export type ExtractionMethod = z.infer<typeof ExtractionMethodSchema>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
