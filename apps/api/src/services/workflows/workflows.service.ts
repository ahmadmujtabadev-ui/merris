// src/services/workflows/workflows.service.ts

import * as fs from "fs";
import * as path from "path";
import { chat } from "../../modules/agent/agent.service.js";
import { perceiveDocument } from "../../modules/agent/perception.js";
import { judgeDocument } from "../../modules/agent/judgment.js";
import { semanticSearch } from "../../modules/knowledge-base/search.service.js";
import { checkCompliance } from "../verification/compliance-checker.js";
import { calculate } from "../../modules/calculation/calculation.service.js";
import { logger } from "../../lib/logger.js";

// ============================================================
// Types
// ============================================================

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  tool: string;
  inputs: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;
  templateId: string;
  engagementId: string;
  status: "running" | "completed" | "failed";
  currentStep: number;
  totalSteps: number;
  results: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// ============================================================
// In-memory execution store (persistent storage in a later phase)
// ============================================================

const executionStore = new Map<string, WorkflowExecution>();

export function getExecution(executionId: string): WorkflowExecution | null {
  return executionStore.get(executionId) ?? null;
}

export function listExecutions(): WorkflowExecution[] {
  return Array.from(executionStore.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

// ============================================================
// Template helpers
// ============================================================

const templateDir = path.join(__dirname, "templates");

export function listTemplates(): WorkflowTemplate[] {
  try {
    const files = fs.readdirSync(templateDir).filter((f) => f.endsWith(".json"));
    return files.map((f) => {
      const content = fs.readFileSync(path.join(templateDir, f), "utf-8");
      return JSON.parse(content) as WorkflowTemplate;
    });
  } catch {
    return [];
  }
}

export function getTemplate(templateId: string): WorkflowTemplate | null {
  const filePath = path.join(templateDir, `${templateId}.json`);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as WorkflowTemplate;
  } catch {
    return null;
  }
}

// ============================================================
// Variable substitution
// ============================================================

/**
 * Replaces $variable references in a value with concrete data from
 * previous step results or the initial workflow inputs.
 */
function substituteVariables(
  value: unknown,
  stepResults: Record<string, unknown>,
  initialInputs: Record<string, unknown>
): unknown {
  if (typeof value === "string") {
    // Replace $variableName tokens with resolved values
    return value.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, varName: string) => {
      // Check step results first, then initial inputs
      if (varName in stepResults) {
        const resolved = stepResults[varName];
        return typeof resolved === "string" ? resolved : JSON.stringify(resolved);
      }
      if (varName in initialInputs) {
        const resolved = initialInputs[varName];
        return typeof resolved === "string" ? resolved : JSON.stringify(resolved);
      }
      // Leave unresolved variables as-is
      return `$${varName}`;
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => substituteVariables(item, stepResults, initialInputs));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = substituteVariables(v, stepResults, initialInputs);
    }
    return result;
  }

  return value;
}

// ============================================================
// Tool dispatch
// ============================================================

type ToolHandler = (
  resolvedInputs: Record<string, unknown>,
  engagementId: string
) => Promise<unknown>;

const toolHandlers: Record<string, ToolHandler> = {
  async perceive_document(inputs, engagementId) {
    const documentBody = String(inputs["documentBody"] ?? "");
    const documentType = (inputs["documentType"] as "word" | "excel" | "powerpoint" | "outlook") ?? "word";
    return perceiveDocument(engagementId, documentBody, documentType);
  },

  async judge_document(inputs, engagementId) {
    const fullDocumentBody = String(inputs["fullDocumentBody"] ?? "");
    const judgmentLevel = (inputs["judgmentLevel"] as "quick" | "thorough" | "partner_review") ?? "thorough";
    return judgeDocument({ engagementId, fullDocumentBody, judgmentLevel });
  },

  async search_knowledge(inputs, _engagementId) {
    const query = String(inputs["query"] ?? "");
    const domains = (inputs["domains"] as string[] | undefined) ?? undefined;
    return semanticSearch({ query, domains });
  },

  async verify_compliance(inputs, engagementId) {
    const documentBody = String(inputs["documentBody"] ?? "");
    const frameworks = (inputs["frameworks"] as string[]) ?? [];
    return checkCompliance(engagementId, documentBody, frameworks);
  },

  async generate_text(inputs, engagementId) {
    const prompt = String(inputs["prompt"] ?? "");
    const response = await chat({
      engagementId,
      userId: "workflow-engine",
      message: prompt,
    });
    return response.response;
  },

  async detect_frameworks(inputs, _engagementId) {
    const documentBody = String(inputs["documentBody"] ?? "");
    const docLower = documentBody.toLowerCase();

    const frameworkPatterns: Record<string, RegExp[]> = {
      gri: [/\bgri\b/, /global reporting initiative/i],
      sasb: [/\bsasb\b/, /sustainability accounting standards/i],
      tcfd: [/\btcfd\b/, /task force on climate/i],
      issb: [/\bissb\b/, /international sustainability standards/i],
      csrd: [/\bcsrd\b/, /corporate sustainability reporting/i],
      esrs: [/\besrs\b/, /european sustainability reporting/i],
      cdp: [/\bcdp\b/, /carbon disclosure project/i],
      ungc: [/\bungc\b/, /un global compact/i],
      sdg: [/\bsdg\b/, /sustainable development goals/i],
    };

    const detected: string[] = [];
    for (const [code, patterns] of Object.entries(frameworkPatterns)) {
      if (patterns.some((p) => p.test(docLower))) {
        detected.push(code);
      }
    }
    return { detectedFrameworks: detected };
  },

  async benchmark(inputs, _engagementId) {
    const query = String(inputs["query"] ?? "");
    return semanticSearch({ query, domains: ["corporate_disclosure"] });
  },

  async calculate(inputs, engagementId) {
    const method = inputs["method"] as string;
    const calcInputs = (inputs["inputs"] as Record<string, unknown>) ?? {};
    const disclosureRef = String(inputs["disclosureRef"] ?? "");
    return calculate({
      method: method as any,
      inputs: calcInputs,
      engagementId,
      disclosureRef,
    });
  },
};

// ============================================================
// Workflow execution engine
// ============================================================

export async function runWorkflow(
  templateId: string,
  engagementId: string,
  inputs: Record<string, unknown>
): Promise<WorkflowExecution> {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Workflow template "${templateId}" not found`);
  }

  const executionId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const execution: WorkflowExecution = {
    id: executionId,
    templateId,
    engagementId,
    status: "running",
    currentStep: 0,
    totalSteps: template.steps.length,
    results: {},
    startedAt: new Date().toISOString(),
  };

  // Store immediately so status can be polled
  executionStore.set(executionId, execution);

  // Run steps sequentially
  const stepResults: Record<string, unknown> = {};

  try {
    for (let i = 0; i < template.steps.length; i++) {
      const step = template.steps[i]!;
      execution.currentStep = i + 1;
      executionStore.set(executionId, { ...execution });

      logger.info(`Workflow ${executionId}: running step ${i + 1}/${template.steps.length} — ${step.name} (${step.tool})`);

      const handler = toolHandlers[step.tool];
      if (!handler) {
        throw new Error(`Unknown tool "${step.tool}" in step "${step.id}"`);
      }

      // Substitute variables in step inputs
      const resolvedInputs = substituteVariables(step.inputs, stepResults, inputs) as Record<string, unknown>;

      // Execute the tool
      const result = await handler(resolvedInputs, engagementId);

      // Store result keyed by step id for downstream variable substitution
      stepResults[step.id] = result;
    }

    execution.status = "completed";
    execution.results = stepResults;
    execution.completedAt = new Date().toISOString();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error(`Workflow ${executionId} failed at step ${execution.currentStep}: ${errorMessage}`);
    execution.status = "failed";
    execution.error = errorMessage;
    execution.results = stepResults;
    execution.completedAt = new Date().toISOString();
  }

  executionStore.set(executionId, { ...execution });
  return execution;
}
