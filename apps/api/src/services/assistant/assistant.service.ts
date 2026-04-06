// src/services/assistant/assistant.service.ts
//
// Re-exports and orchestrates existing agent module components
// as the "Merris Assistant" product.

import { chat, executeAction, type ChatRequest, type ChatResponse } from '../../modules/agent/agent.service.js';
import { perceiveDocument, fullPerception } from '../../modules/agent/perception.js';
import { judgeSection, judgeDocument } from '../../modules/agent/judgment.js';
import { catchMeUp, buildMemoryContext } from '../../modules/agent/memory.js';
import { getTeamContext } from '../../modules/agent/team-awareness.js';
import { generateFullReport, generateAssurancePack, generateExecutiveSummary } from '../../modules/agent/workproduct.js';
import { processEditSignal, processAcceptSignal, processRejectSignal } from '../../modules/agent/learning.js';

// Re-export everything as the Assistant API
export {
  // Core chat
  chat,
  executeAction,
  // Perception & Judgment
  perceiveDocument,
  fullPerception,
  judgeSection,
  judgeDocument,
  // Memory
  catchMeUp,
  buildMemoryContext,
  // Team
  getTeamContext,
  // Work Products
  generateFullReport,
  generateAssurancePack,
  generateExecutiveSummary,
  // Learning
  processEditSignal,
  processAcceptSignal,
  processRejectSignal,
};

// Re-export types
export type { ChatRequest, ChatResponse };
