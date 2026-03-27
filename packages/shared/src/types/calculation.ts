import { z } from 'zod';
import {
  CalculationRequestSchema,
  CalculationMethodSchema,
  CalculationResultSchema,
} from '../validators/schemas.js';

export type CalculationRequest = z.infer<typeof CalculationRequestSchema>;
export type CalculationMethod = z.infer<typeof CalculationMethodSchema>;
export type CalculationResult = z.infer<typeof CalculationResultSchema>;
