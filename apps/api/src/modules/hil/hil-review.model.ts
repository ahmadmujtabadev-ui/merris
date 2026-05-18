import mongoose, { Schema, type Document } from 'mongoose';

export interface IHilReview extends Document {
  reviewId: string;
  executionId: string;
  templateId: string;
  engagementId: string;
  nodeId: string;
  nodeLabel: string;
  stepIndex: number;
  totalSteps: number;
  agentOutput: string;
  runContext: {
    engagementName?: string;
    jurisdiction?: string;
    severity?: string;
    triggeredBy?: string;
    assignedTo?: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  dueAt?: Date;
  createdAt: Date;
}

const HilReviewSchema = new Schema<IHilReview>(
  {
    reviewId:    { type: String, required: true, unique: true, index: true },
    executionId: { type: String, required: true, index: true },
    templateId:  { type: String, required: true },
    engagementId:{ type: String, required: true, index: true },
    nodeId:      { type: String, required: true },
    nodeLabel:   { type: String, required: true },
    stepIndex:   { type: Number, required: true },
    totalSteps:  { type: Number, required: true },
    agentOutput: { type: String, required: true },
    runContext: {
      engagementName: String,
      jurisdiction:   String,
      severity:       String,
      triggeredBy:    String,
      assignedTo:     String,
    },
    status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNotes: String,
    reviewedBy:  String,
    reviewedAt:  Date,
    dueAt:       Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const HilReviewModel = mongoose.model<IHilReview>('HilReview', HilReviewSchema);
