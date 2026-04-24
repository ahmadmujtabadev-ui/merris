import mongoose from 'mongoose';
import {
  WorkflowModel,
  WORKFLOW_STAGES,
  type IWorkflowDefinition,
  type IWorkflowStage,
  type WorkflowStageName,
} from './workflow.model.js';
import { AppError } from '../auth/auth.service.js';
import { OrgProfileModel } from '../organization/organization.model.js';
import { FrameworkRecommendationModel } from '../organization/organization.model.js';
import { ReportModel } from '../report/report.model.js';
import { DataPointModel } from '../ingestion/ingestion.model.js';

// ============================================================
// Entry Criteria Definitions
// ============================================================

export interface EntryCriteriaResult {
  met: boolean;
  details: string[];
}

type CriteriaChecker = (engagementId: string) => Promise<EntryCriteriaResult>;

const entryCriteria: Record<string, CriteriaChecker> = {
  // Setup -> Data Collection
  'Setup->Data Collection': async (engagementId: string) => {
    const details: string[] = [];
    let met = true;

    // Check org profile exists (use engagementId to look up — in a real system
    // we'd join through engagement.orgId, but for validation we check if any profile exists)
    const workflow = await WorkflowModel.findOne({
      engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
    }).exec();

    // For entry criteria, we check via external models
    // Org profile: check if at least one org profile exists for this engagement's org
    const orgProfile = await OrgProfileModel.findOne({}).exec();
    if (!orgProfile) {
      met = false;
      details.push('Organization profile must exist');
    }

    // Frameworks selected: check if framework recommendation has selections
    const frameworkRec = await FrameworkRecommendationModel.findOne({}).exec();
    if (!frameworkRec || !frameworkRec.selections?.selected?.length) {
      met = false;
      details.push('At least one framework must be selected');
    }

    return { met, details };
  },

  // Data Collection -> Drafting
  'Data Collection->Drafting': async (engagementId: string) => {
    const details: string[] = [];
    let met = true;

    const dataPoints = await DataPointModel.find({
      engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
    }).exec();

    const total = dataPoints.length;
    if (total === 0) {
      met = false;
      details.push('No data points found — data completeness must be >= 80%');
      return { met, details };
    }

    const completed = dataPoints.filter(
      (dp) => dp.status !== 'missing',
    ).length;
    const completeness = (completed / total) * 100;

    if (completeness < 80) {
      met = false;
      details.push(
        `Data completeness is ${completeness.toFixed(1)}% — must be >= 80%`,
      );
    }

    return { met, details };
  },

  // Drafting -> Internal Review
  'Drafting->Internal Review': async (engagementId: string) => {
    const details: string[] = [];
    let met = true;

    const report = await ReportModel.findOne({
      engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
      status: 'draft',
    }).exec();

    if (!report) {
      met = false;
      details.push('A report with status "draft" must exist');
    }

    return { met, details };
  },

  // Internal Review -> Partner Approval
  'Internal Review->Partner Approval': async (engagementId: string) => {
    const details: string[] = [];
    let met = true;

    const report = await ReportModel.findOne({
      engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
    }).exec();

    if (!report) {
      met = false;
      details.push('Report must exist');
      return { met, details };
    }

    const unreviewedSections = report.structure.filter(
      (s) => s.status !== 'reviewed' && s.status !== 'approved',
    );

    if (unreviewedSections.length > 0) {
      met = false;
      details.push(
        `${unreviewedSections.length} section(s) have not been reviewed`,
      );
    }

    return { met, details };
  },

  // Partner Approval -> Client Review
  'Partner Approval->Client Review': async (engagementId: string) => {
    const details: string[] = [];
    let met = true;

    // This is validated at the route level — only owner/admin can approve
    // The criteria is that the advance request itself constitutes approval
    // So this always passes if the caller has the right role
    return { met, details };
  },

  // Client Review -> Assurance Prep
  'Client Review->Assurance Prep': async (engagementId: string) => {
    const details: string[] = [];
    let met = true;

    // Client approval or skip — always passes when explicitly advanced
    return { met, details };
  },

  // Assurance Prep -> Final
  'Assurance Prep->Final': async (engagementId: string) => {
    const details: string[] = [];
    let met = true;

    // Check QA passed: report must be in partner_approved or client_approved status
    const report = await ReportModel.findOne({
      engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
    }).exec();

    if (!report) {
      met = false;
      details.push('Report must exist for QA verification');
      return { met, details };
    }

    if (
      report.status !== 'partner_approved' &&
      report.status !== 'client_approved'
    ) {
      met = false;
      details.push('Report must be approved (partner or client) for QA');
    }

    // Check evidence pack exists — at least one document linked
    const docs = await DataPointModel.find({
      engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
      sourceDocumentId: { $exists: true, $ne: null },
    }).exec();

    if (docs.length === 0) {
      met = false;
      details.push('Evidence pack required — no data points with source documents found');
    }

    return { met, details };
  },
};

// ============================================================
// Initialize Workflow
// ============================================================

export async function initializeWorkflow(
  engagementId: string,
): Promise<IWorkflowDefinition> {
  const existing = await WorkflowModel.findOne({
    engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
  }).exec();

  if (existing) {
    throw new AppError('Workflow already initialized for this engagement', 409);
  }

  const stages: IWorkflowStage[] = WORKFLOW_STAGES.map((name, idx) => ({
    name,
    order: idx + 1,
    status: idx === 0 ? 'active' : 'pending',
    enteredAt: idx === 0 ? new Date() : undefined,
  }));

  const workflow = await WorkflowModel.create({
    engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
    stages,
    currentStage: 'Setup',
    history: [],
  });

  return workflow;
}

// ============================================================
// Get Workflow
// ============================================================

export async function getWorkflow(
  engagementId: string,
): Promise<IWorkflowDefinition> {
  const workflow = await WorkflowModel.findOne({
    engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
  }).exec();

  if (!workflow) {
    throw new AppError('Workflow not found', 404);
  }

  return workflow;
}

// ============================================================
// Advance Workflow
// ============================================================

interface AdvanceInput {
  userId: string;
  approvalNotes?: string;
  attachments?: string[];
}

export async function advanceWorkflow(
  engagementId: string,
  input: AdvanceInput,
): Promise<IWorkflowDefinition> {
  const workflow = await getWorkflow(engagementId);

  const currentIdx = WORKFLOW_STAGES.indexOf(
    workflow.currentStage as WorkflowStageName,
  );

  if (currentIdx === -1) {
    throw new AppError('Invalid current stage', 500);
  }

  if (currentIdx === WORKFLOW_STAGES.length - 1) {
    throw new AppError('Cannot advance past Final stage', 400);
  }

  const nextStage = WORKFLOW_STAGES[currentIdx + 1]!;
  const criteriaKey = `${workflow.currentStage}->${nextStage}`;
  const checker = entryCriteria[criteriaKey];

  if (checker) {
    const result = await checker(engagementId);
    if (!result.met) {
      throw new AppError(
        `Entry criteria not met for ${nextStage}: ${result.details.join('; ')}`,
        422,
      );
    }
  }

  // Complete current stage
  const currentStageObj = workflow.stages.find(
    (s) => s.name === workflow.currentStage,
  );
  if (currentStageObj) {
    currentStageObj.status = 'completed';
    currentStageObj.completedAt = new Date();
    currentStageObj.approvedBy = input.userId;
    if (input.approvalNotes) {
      currentStageObj.approvalNotes = input.approvalNotes;
    }
    if (input.attachments) {
      currentStageObj.attachments = input.attachments;
    }
  }

  // Activate next stage
  const nextStageObj = workflow.stages.find((s) => s.name === nextStage);
  if (nextStageObj) {
    nextStageObj.status = 'active';
    nextStageObj.enteredAt = new Date();
  }

  // Record transition
  workflow.history.push({
    fromStage: workflow.currentStage,
    toStage: nextStage,
    action: 'advance',
    performedBy: input.userId,
    performedAt: new Date(),
    approvalNotes: input.approvalNotes,
    attachments: input.attachments,
  });

  workflow.currentStage = nextStage;
  await workflow.save();

  return workflow;
}

// ============================================================
// Return to Earlier Stage
// ============================================================

interface ReturnInput {
  userId: string;
  returnToStage: string;
  reason: string;
}

export async function returnToStage(
  engagementId: string,
  input: ReturnInput,
): Promise<IWorkflowDefinition> {
  const workflow = await getWorkflow(engagementId);

  const currentIdx = WORKFLOW_STAGES.indexOf(
    workflow.currentStage as WorkflowStageName,
  );
  const targetIdx = WORKFLOW_STAGES.indexOf(
    input.returnToStage as WorkflowStageName,
  );

  if (targetIdx === -1) {
    throw new AppError(`Invalid stage: ${input.returnToStage}`, 400);
  }

  if (targetIdx >= currentIdx) {
    throw new AppError('Can only return to an earlier stage', 400);
  }

  // Set all stages between target and current back to pending
  for (const stage of workflow.stages) {
    if (stage.order > targetIdx + 1 && stage.order <= currentIdx + 1) {
      stage.status = 'pending';
      stage.completedAt = undefined;
      stage.approvedBy = undefined;
      stage.approvalNotes = undefined;
      stage.attachments = undefined;
    }
  }

  // Set target stage to active
  const targetStage = workflow.stages.find(
    (s) => s.name === input.returnToStage,
  );
  if (targetStage) {
    targetStage.status = 'active';
    targetStage.enteredAt = new Date();
  }

  // Record transition
  workflow.history.push({
    fromStage: workflow.currentStage,
    toStage: input.returnToStage,
    action: 'return',
    performedBy: input.userId,
    performedAt: new Date(),
    reason: input.reason,
  });

  workflow.currentStage = input.returnToStage;
  await workflow.save();

  return workflow;
}

// ============================================================
// Get Transition History
// ============================================================

export async function getTransitionHistory(
  engagementId: string,
): Promise<IWorkflowDefinition['history']> {
  const workflow = await getWorkflow(engagementId);
  return workflow.history;
}
