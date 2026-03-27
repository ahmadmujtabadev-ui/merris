import mongoose, { Schema, Document } from 'mongoose';

// ============================================================
// Workflow Stage Statuses
// ============================================================

export type StageStatus = 'pending' | 'active' | 'completed' | 'skipped';

export const WORKFLOW_STAGES = [
  'Setup',
  'Data Collection',
  'Drafting',
  'Internal Review',
  'Partner Approval',
  'Client Review',
  'Assurance Prep',
  'Final',
] as const;

export type WorkflowStageName = (typeof WORKFLOW_STAGES)[number];

// ============================================================
// WorkflowStage Sub-document
// ============================================================

export interface IWorkflowStage {
  name: WorkflowStageName;
  order: number;
  status: StageStatus;
  enteredAt?: Date;
  completedAt?: Date;
  approvedBy?: string;
  approvalNotes?: string;
  attachments?: string[];
}

const WorkflowStageSubSchema = new Schema<IWorkflowStage>(
  {
    name: { type: String, required: true },
    order: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'skipped'],
      default: 'pending',
    },
    enteredAt: { type: Date },
    completedAt: { type: Date },
    approvedBy: { type: String },
    approvalNotes: { type: String },
    attachments: [{ type: String }],
  },
  { _id: false },
);

// ============================================================
// TransitionHistory Sub-document
// ============================================================

export interface ITransitionHistory {
  fromStage: string;
  toStage: string;
  action: 'advance' | 'return';
  performedBy: string;
  performedAt: Date;
  reason?: string;
  approvalNotes?: string;
  attachments?: string[];
}

const TransitionHistorySubSchema = new Schema<ITransitionHistory>(
  {
    fromStage: { type: String, required: true },
    toStage: { type: String, required: true },
    action: { type: String, enum: ['advance', 'return'], required: true },
    performedBy: { type: String, required: true },
    performedAt: { type: Date, default: Date.now },
    reason: { type: String },
    approvalNotes: { type: String },
    attachments: [{ type: String }],
  },
  { _id: false },
);

// ============================================================
// WorkflowDefinition Model
// ============================================================

export interface IWorkflowDefinition extends Document {
  engagementId: mongoose.Types.ObjectId;
  stages: IWorkflowStage[];
  currentStage: string;
  history: ITransitionHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowDefinitionSchema = new Schema<IWorkflowDefinition>(
  {
    engagementId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    stages: [WorkflowStageSubSchema],
    currentStage: { type: String, required: true },
    history: [TransitionHistorySubSchema],
  },
  { timestamps: true },
);

export const WorkflowModel = mongoose.model<IWorkflowDefinition>(
  'WorkflowDefinition',
  WorkflowDefinitionSchema,
);
