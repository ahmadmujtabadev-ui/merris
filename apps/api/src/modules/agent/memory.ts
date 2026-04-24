/**
 * Merris Engagement Memory Service
 *
 * Captures and retrieves memory across all interactions:
 * - Conversation memory (every chat)
 * - Decision memory (methodology choices, framework selections)
 * - Style memory (user/client/firm preferences learned from edits)
 * - "Catch me up" summary generation
 */

import {
  ConversationMemoryModel,
  DecisionMemoryModel,
  StyleMemoryModel,
  type IConversationMemory,
  type IDecisionMemory,
  type IStyleMemory,
} from '../../models/memory.model.js';
import { DataPointModel } from '../ingestion/ingestion.model.js';
import { logger } from '../../lib/logger.js';
import mongoose from 'mongoose';

// ============================================================
// Conversation Memory
// ============================================================

export interface CaptureConversationInput {
  engagementId: string;
  userId: string;
  channel: IConversationMemory['channel'];
  userMessage: string;
  agentResponse: string;
  toolsUsed: string[];
  documentContext?: string;
  actionTaken?: string;
}

export async function captureConversation(input: CaptureConversationInput): Promise<void> {
  try {
    await ConversationMemoryModel.create({
      engagementId: new (mongoose.Types.ObjectId as any)(input.engagementId),
      userId: new (mongoose.Types.ObjectId as any)(input.userId),
      channel: input.channel,
      userMessage: input.userMessage,
      agentResponse: input.agentResponse,
      toolsUsed: input.toolsUsed,
      documentContext: input.documentContext,
      actionTaken: input.actionTaken,
    });
  } catch (err) {
    logger.error('Failed to capture conversation memory', err);
  }
}

export async function getRecentConversations(
  engagementId: string,
  limit = 10
): Promise<Array<Record<string, any>>> {
  return ConversationMemoryModel.find({
    engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean() as any;
}

// ============================================================
// Decision Memory
// ============================================================

export interface CaptureDecisionInput {
  engagementId: string;
  userId: string;
  decision: string;
  reasoning: string;
  alternatives?: string[];
  context: string;
  revisitable?: boolean;
  category?: IDecisionMemory['category'];
}

export async function captureDecision(input: CaptureDecisionInput): Promise<void> {
  try {
    await DecisionMemoryModel.create({
      engagementId: new (mongoose.Types.ObjectId as any)(input.engagementId),
      userId: new (mongoose.Types.ObjectId as any)(input.userId),
      decision: input.decision,
      reasoning: input.reasoning,
      alternatives: input.alternatives || [],
      context: input.context,
      revisitable: input.revisitable ?? false,
      category: input.category || 'other',
    });
  } catch (err) {
    logger.error('Failed to capture decision memory', err);
  }
}

export async function getDecisions(engagementId: string): Promise<Array<Record<string, any>>> {
  return DecisionMemoryModel.find({
    engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
  })
    .sort({ timestamp: -1 })
    .lean() as any;
}

// ============================================================
// Style Memory
// ============================================================

export interface CaptureStyleInput {
  userId?: string;
  orgId?: string;
  clientOrgId?: string;
  category: IStyleMemory['category'];
  preference: string;
  evidence: string;
  confidence?: number;
}

export async function captureStyle(input: CaptureStyleInput): Promise<void> {
  try {
    // Upsert: if same user+category+preference exists, update confidence and add evidence
    const query: Record<string, any> = { category: input.category };
    if (input.userId) query.userId = new (mongoose.Types.ObjectId as any)(input.userId);
    if (input.orgId) query.orgId = new (mongoose.Types.ObjectId as any)(input.orgId);
    if (input.clientOrgId) query.clientOrgId = new (mongoose.Types.ObjectId as any)(input.clientOrgId);

    const existing = await StyleMemoryModel.findOne({
      ...query,
      preference: input.preference,
    });

    if (existing) {
      // Reinforce: increase confidence, add evidence
      existing.confidence = Math.min(1, existing.confidence + 0.05);
      existing.evidence.push(input.evidence);
      if (existing.evidence.length > 20) existing.evidence = existing.evidence.slice(-20);
      existing.lastUpdated = new Date();
      await existing.save();
    } else {
      await StyleMemoryModel.create({
        userId: input.userId ? new (mongoose.Types.ObjectId as any)(input.userId) : undefined,
        orgId: input.orgId ? new (mongoose.Types.ObjectId as any)(input.orgId) : undefined,
        clientOrgId: input.clientOrgId ? new (mongoose.Types.ObjectId as any)(input.clientOrgId) : undefined,
        category: input.category,
        preference: input.preference,
        evidence: [input.evidence],
        confidence: input.confidence ?? 0.5,
      });
    }
  } catch (err) {
    logger.error('Failed to capture style memory', err);
  }
}

export async function getStylePreferences(
  userId?: string,
  orgId?: string,
  clientOrgId?: string
): Promise<IStyleMemory[]> {
  const conditions: Record<string, any>[] = [];
  if (userId) conditions.push({ userId: new (mongoose.Types.ObjectId as any)(userId) });
  if (orgId) conditions.push({ orgId: new (mongoose.Types.ObjectId as any)(orgId) });
  if (clientOrgId) conditions.push({ clientOrgId: new (mongoose.Types.ObjectId as any)(clientOrgId) });

  if (conditions.length === 0) return [];

  return StyleMemoryModel.find({ $or: conditions })
    .sort({ confidence: -1 })
    .lean() as any;
}

// ============================================================
// "Catch Me Up" — Summary since last session
// ============================================================

export interface CatchMeUpSummary {
  daysSinceLastSession: number;
  lastSessionChannel: string;
  conversationsSince: number;
  dataPointChanges: DataPointChange[];
  decisionssMade: DecisionSummary[];
  statusChanges: string[];
  summary: string;
}

interface DataPointChange {
  metricName: string;
  action: string;
  userName: string;
  timestamp: Date;
}

interface DecisionSummary {
  decision: string;
  reasoning: string;
  by: string;
  timestamp: Date;
}

export async function catchMeUp(
  engagementId: string,
  userId: string
): Promise<CatchMeUpSummary> {
  const engObjId = new (mongoose.Types.ObjectId as any)(engagementId);
  const userObjId = new (mongoose.Types.ObjectId as any)(userId);

  // Find user's last interaction
  const lastSession = await ConversationMemoryModel.findOne({
    engagementId: engObjId,
    userId: userObjId,
  }).sort({ timestamp: -1 }).lean();

  const sinceDate = lastSession?.timestamp || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const daysSince = Math.ceil((Date.now() - new Date(sinceDate).getTime()) / (1000 * 60 * 60 * 24));

  // Conversations by OTHER users since then
  const otherConversations = await ConversationMemoryModel.find({
    engagementId: engObjId,
    userId: { $ne: userObjId },
    timestamp: { $gt: sinceDate },
  }).sort({ timestamp: -1 }).limit(20).lean();

  // Data point changes since then
  const recentDataPoints = await DataPointModel.find({
    engagementId: engagementId,
    updatedAt: { $gt: sinceDate },
  }).sort({ updatedAt: -1 }).limit(20).lean();

  const dataPointChanges: DataPointChange[] = recentDataPoints.map((dp: any) => {
    const lastAudit = dp.auditTrail?.length > 0 ? dp.auditTrail[dp.auditTrail.length - 1] : null;
    return {
      metricName: dp.metricName,
      action: lastAudit?.action || 'updated',
      userName: lastAudit?.userId || 'system',
      timestamp: dp.updatedAt,
    };
  });

  // Decisions since then
  const recentDecisions = await DecisionMemoryModel.find({
    engagementId: engObjId,
    timestamp: { $gt: sinceDate },
  }).sort({ timestamp: -1 }).lean();

  const decisionSummaries: DecisionSummary[] = recentDecisions.map((d) => ({
    decision: d.decision,
    reasoning: d.reasoning,
    by: d.userId.toString(),
    timestamp: d.timestamp,
  }));

  // Build summary
  const parts: string[] = [];

  if (daysSince <= 0) {
    parts.push('Welcome back. You were here earlier today.');
  } else {
    parts.push(`Since your last session ${daysSince} day${daysSince !== 1 ? 's' : ''} ago:`);
  }

  if (otherConversations.length > 0) {
    parts.push(`• ${otherConversations.length} conversation${otherConversations.length !== 1 ? 's' : ''} by other team members`);
  }

  if (dataPointChanges.length > 0) {
    const confirmed = dataPointChanges.filter(d => d.action === 'confirmed').length;
    const created = dataPointChanges.filter(d => d.action === 'created').length;
    const updated = dataPointChanges.filter(d => d.action === 'updated').length;
    const changeParts: string[] = [];
    if (confirmed > 0) changeParts.push(`${confirmed} confirmed`);
    if (created > 0) changeParts.push(`${created} new`);
    if (updated > 0) changeParts.push(`${updated} updated`);
    parts.push(`• Data points: ${changeParts.join(', ')}`);
  }

  if (decisionSummaries.length > 0) {
    parts.push(`• ${decisionSummaries.length} decision${decisionSummaries.length !== 1 ? 's' : ''} recorded:`);
    for (const d of decisionSummaries.slice(0, 3)) {
      parts.push(`  - ${d.decision}`);
    }
  }

  if (otherConversations.length === 0 && dataPointChanges.length === 0 && decisionSummaries.length === 0) {
    parts.push('No activity from other team members. Everything is as you left it.');
  }

  return {
    daysSinceLastSession: daysSince,
    lastSessionChannel: lastSession?.channel || 'unknown',
    conversationsSince: otherConversations.length,
    dataPointChanges,
    decisionssMade: decisionSummaries,
    statusChanges: [],
    summary: parts.join('\n'),
  };
}

// ============================================================
// Memory context for agent prompts
// ============================================================

export async function buildMemoryContext(
  engagementId: string,
  userId: string,
  orgId?: string,
  clientOrgId?: string
): Promise<string> {
  const [conversations, decisions, styles] = await Promise.all([
    getRecentConversations(engagementId, 10),
    getDecisions(engagementId),
    getStylePreferences(userId, orgId, clientOrgId),
  ]);

  const parts: string[] = [];

  // Recent conversations
  if (conversations.length > 0) {
    parts.push(`RECENT CONVERSATIONS (last ${conversations.length}):`);
    for (const c of conversations.slice(0, 5)) {
      const timeAgo = getTimeAgo(c.timestamp);
      parts.push(`  [${timeAgo}] User: "${c.userMessage.substring(0, 80)}..." → Agent used: ${c.toolsUsed.join(', ') || 'none'}`);
    }
  }

  // Decisions
  if (decisions.length > 0) {
    parts.push(`\nENGAGEMENT DECISIONS (${decisions.length} total):`);
    for (const d of decisions.slice(0, 10)) {
      parts.push(`  - ${d.decision} (Reason: ${d.reasoning.substring(0, 100)})`);
      if (d.revisitable) parts.push(`    ⚠️ Marked for revisit`);
    }
  }

  // Style preferences
  const highConfidence = styles.filter(s => s.confidence >= 0.7);
  if (highConfidence.length > 0) {
    parts.push(`\nUSER PREFERENCES (learned from ${styles.length} signals):`);
    for (const s of highConfidence.slice(0, 15)) {
      const scope = s.userId ? 'User' : s.orgId ? 'Firm' : s.clientOrgId ? 'Client' : 'General';
      parts.push(`  - [${scope}] ${s.category}: ${s.preference} (confidence: ${s.confidence.toFixed(2)})`);
    }
  }

  return parts.join('\n');
}

// ============================================================
// Helpers
// ============================================================

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
