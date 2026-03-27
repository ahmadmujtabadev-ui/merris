import { z } from 'zod';
import {
  AgentContextSchema,
  AgentMessageSchema,
  ToolCallSchema,
  DataCompletenessReportSchema,
} from '../validators/schemas.js';

export type AgentContext = z.infer<typeof AgentContextSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type DataCompletenessReport = z.infer<typeof DataCompletenessReportSchema>;
