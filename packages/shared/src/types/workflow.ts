import { z } from 'zod';
import {
  WorkflowDefinitionSchema,
  WorkflowStageSchema,
  WorkflowTriggerSchema,
} from '../validators/schemas.js';

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;
export type WorkflowTrigger = z.infer<typeof WorkflowTriggerSchema>;
