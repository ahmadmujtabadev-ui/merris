/**
 * Merris Engagement Memory Models
 *
 * Three memory types that persist across sessions:
 * 1. ConversationMemory — every chat interaction
 * 2. DecisionMemory — why things were done a certain way
 * 3. StyleMemory — how the user and client prefer things
 */

import mongoose, { Schema, Document } from 'mongoose';

// ============================================================
// 1. Conversation Memory
// ============================================================

export interface IConversationMemory extends Document {
  engagementId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  timestamp: Date;
  channel: 'word' | 'excel' | 'powerpoint' | 'outlook' | 'teams' | 'web';
  userMessage: string;
  agentResponse: string;
  toolsUsed: string[];
  documentContext?: string;
  actionTaken?: string;
}

const ConversationMemorySchema = new Schema<IConversationMemory>(
  {
    engagementId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    channel: {
      type: String,
      enum: ['word', 'excel', 'powerpoint', 'outlook', 'teams', 'web'],
      required: true,
    },
    userMessage: { type: String, required: true },
    agentResponse: { type: String, required: true },
    toolsUsed: [{ type: String }],
    documentContext: { type: String },
    actionTaken: { type: String },
  },
  { timestamps: true }
);

ConversationMemorySchema.index({ engagementId: 1, timestamp: -1 });
ConversationMemorySchema.index({ engagementId: 1, userId: 1, timestamp: -1 });

export const ConversationMemoryModel = mongoose.model<IConversationMemory>(
  'ConversationMemory',
  ConversationMemorySchema,
  'conversation_memories'
);

// ============================================================
// 2. Decision Memory
// ============================================================

export interface IDecisionMemory extends Document {
  engagementId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  timestamp: Date;
  decision: string;
  reasoning: string;
  alternatives: string[];
  context: string;
  revisitable: boolean;
  category: 'methodology' | 'framework' | 'data' | 'framing' | 'scope' | 'other';
}

const DecisionMemorySchema = new Schema<IDecisionMemory>(
  {
    engagementId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    timestamp: { type: Date, default: Date.now },
    decision: { type: String, required: true },
    reasoning: { type: String, required: true },
    alternatives: [{ type: String }],
    context: { type: String, required: true },
    revisitable: { type: Boolean, default: false },
    category: {
      type: String,
      enum: ['methodology', 'framework', 'data', 'framing', 'scope', 'other'],
      default: 'other',
    },
  },
  { timestamps: true }
);

DecisionMemorySchema.index({ engagementId: 1, timestamp: -1 });
DecisionMemorySchema.index({ engagementId: 1, category: 1 });

export const DecisionMemoryModel = mongoose.model<IDecisionMemory>(
  'DecisionMemory',
  DecisionMemorySchema,
  'decision_memories'
);

// ============================================================
// 3. Style Memory
// ============================================================

export interface IStyleMemory extends Document {
  userId?: mongoose.Types.ObjectId;
  orgId?: mongoose.Types.ObjectId;
  clientOrgId?: mongoose.Types.ObjectId;
  category: 'writing' | 'formatting' | 'framing' | 'terminology' | 'tone';
  preference: string;
  evidence: string[];
  confidence: number;
  lastUpdated: Date;
}

const StyleMemorySchema = new Schema<IStyleMemory>(
  {
    userId: { type: Schema.Types.ObjectId, index: true },
    orgId: { type: Schema.Types.ObjectId, index: true },
    clientOrgId: { type: Schema.Types.ObjectId, index: true },
    category: {
      type: String,
      enum: ['writing', 'formatting', 'framing', 'terminology', 'tone'],
      required: true,
    },
    preference: { type: String, required: true },
    evidence: [{ type: String }],
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

StyleMemorySchema.index({ userId: 1, category: 1 });
StyleMemorySchema.index({ orgId: 1, category: 1 });
StyleMemorySchema.index({ clientOrgId: 1, category: 1 });

export const StyleMemoryModel = mongoose.model<IStyleMemory>(
  'StyleMemory',
  StyleMemorySchema,
  'style_memories'
);
