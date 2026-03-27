import { z } from 'zod';
import {
  ESGDocumentSchema,
  DocumentStatusSchema,
  ExtractedDataPointSchema,
} from '../validators/schemas.js';

export type ESGDocument = z.infer<typeof ESGDocumentSchema>;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export type ExtractedDataPoint = z.infer<typeof ExtractedDataPointSchema>;
