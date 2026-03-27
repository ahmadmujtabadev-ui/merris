import { z } from 'zod';
import {
  FrameworkSchema,
  FrameworkTypeSchema,
  FrameworkStructureSchema,
  TopicSchema,
  DisclosureSchema,
  MetricDefinitionSchema,
  CrossReferenceSchema,
  EmissionFactorSchema,
} from '../validators/schemas.js';

export type Framework = z.infer<typeof FrameworkSchema>;
export type FrameworkType = z.infer<typeof FrameworkTypeSchema>;
export type FrameworkStructure = z.infer<typeof FrameworkStructureSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type Disclosure = z.infer<typeof DisclosureSchema>;
export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;
export type CrossReference = z.infer<typeof CrossReferenceSchema>;
export type EmissionFactor = z.infer<typeof EmissionFactorSchema>;
