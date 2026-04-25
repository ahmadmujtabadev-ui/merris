import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../../lib/logger.js';

// ============================================================
// System Prompt Loader
// ============================================================
//
// Lifted out of agent.service.ts so both the JSON and SSE chat paths
// (agent.service.ts and tool-use-loop.ts) can share a single source of
// truth for the router prompt. Keep the on-disk fallback string exactly
// in sync with the previous private copy.

function getDirname(): string {
  try { return path.dirname(fileURLToPath(import.meta.url)); } catch { return process.cwd(); }
}
const __dirname = getDirname();

export function loadSystemPrompt(): string {
  const promptPath = path.resolve(__dirname, '../../../../../prompts/router.md');
  try {
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    logger.warn('Could not load prompts/router.md, using fallback system prompt');
    return `You are the Merris ESG Agent — an expert sustainability advisor.
NEVER fabricate data. Only use values from confirmed data points.
Always cite sources when referencing data.`;
  }
}
