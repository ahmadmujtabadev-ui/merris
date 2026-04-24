/**
 * Merris Multi-User Awareness Engine (Capability 4)
 *
 * Understands team composition, role-based context, and engagement bottlenecks.
 * Provides role-aware prompt additions so the agent adapts its communication
 * style to each user type (analyst, partner, client, auditor).
 */

import mongoose from 'mongoose';
import { UserModel } from '../auth/auth.model.js';
import { ConversationMemoryModel } from '../../models/memory.model.js';
import { DataPointModel } from '../ingestion/ingestion.model.js';
import { logger } from '../../lib/logger.js';

// ============================================================
// Types
// ============================================================

export interface TeamContext {
  engagement: {
    lead: { userId: string; name: string; role: string };
    members: Array<{ userId: string; name: string; role: string; lastActive: Date }>;
  };
  assignments: TaskAssignment[];
  bottlenecks: Bottleneck[];
}

export interface TaskAssignment {
  task: string;
  assigneeId: string;
  assigneeName: string;
  deadline: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

export interface Bottleneck {
  description: string;
  blocker: string;
  impact: string;
  suggestedAction: string;
  daysBlocked: number;
}

// ============================================================
// 1. Team Context
// ============================================================

export async function getTeamContext(engagementId: string): Promise<TeamContext> {
  const engObjId = new (mongoose.Types.ObjectId as any)(engagementId);

  // Get the engagement to find orgId
  let engagement: any = null;
  try {
    const db = mongoose.connection.db;
    if (db) {
      engagement = await db.collection('engagements').findOne({
        _id: engObjId,
      });
    }
  } catch {
    // Fallback below
  }

  const orgId = engagement?.orgId;

  // Fetch all users in the org
  let users: any[] = [];
  if (orgId) {
    users = await UserModel.find({ orgId, isActive: true }).lean() as any;
  }

  // Find last activity per user from conversation memories
  const lastActivities = await ConversationMemoryModel.aggregate([
    { $match: { engagementId: engObjId } },
    { $group: { _id: '$userId', lastActive: { $max: '$timestamp' } } },
  ]);

  const activityMap = new Map<string, Date>();
  for (const entry of lastActivities) {
    activityMap.set(entry._id.toString(), entry.lastActive);
  }

  // Determine lead (owner or manager with latest activity)
  const sortedByRole = [...users].sort((a, b) => {
    const roleOrder: Record<string, number> = { owner: 0, admin: 1, manager: 2, reviewer: 3, analyst: 4, auditor_readonly: 5 };
    return (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9);
  });

  const leadUser = sortedByRole[0];
  const lead = leadUser
    ? { userId: leadUser._id.toString(), name: leadUser.name, role: leadUser.role }
    : { userId: '', name: 'Unknown', role: 'analyst' };

  const members = users.map((u: any) => ({
    userId: u._id.toString(),
    name: u.name,
    role: u.role,
    lastActive: activityMap.get(u._id.toString()) || u.updatedAt || u.createdAt,
  }));

  // Get bottlenecks and assignments
  const [assignments, bottlenecks] = await Promise.all([
    getTaskAssignments(engagementId, users),
    getBottlenecks(engagementId),
  ]);

  return {
    engagement: { lead, members },
    assignments,
    bottlenecks,
  };
}

// ============================================================
// 2. Bottleneck Detection
// ============================================================

export async function getBottlenecks(engagementId: string): Promise<Bottleneck[]> {
  const bottlenecks: Bottleneck[] = [];
  const now = Date.now();

  try {
    // Check for data points that have been in auto_extracted status too long (>7 days)
    const staleDataPoints = await DataPointModel.find({
      engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
      status: 'auto_extracted',
      updatedAt: { $lt: new Date(now - 7 * 24 * 60 * 60 * 1000) },
    }).limit(20).lean() as any;

    if (staleDataPoints.length > 0) {
      const daysOldest = Math.ceil(
        (now - new Date(staleDataPoints[0]!.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      bottlenecks.push({
        description: `${staleDataPoints.length} data points awaiting confirmation for over 7 days`,
        blocker: 'Data verification not completed',
        impact: 'Report drafting cannot proceed with unconfirmed data — quality risk',
        suggestedAction: 'Assign an analyst to review and confirm pending data points',
        daysBlocked: daysOldest,
      });
    }

    // Check for missing data points
    const missingDataPoints = await DataPointModel.find({
      engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
      status: 'missing',
    }).limit(20).lean() as any;

    if (missingDataPoints.length > 0) {
      bottlenecks.push({
        description: `${missingDataPoints.length} required data points still missing`,
        blocker: 'Source data not yet provided or uploaded',
        impact: 'Incomplete disclosures will fail compliance check',
        suggestedAction: 'Request missing data from client or upload additional source documents',
        daysBlocked: 0,
      });
    }

    // Check for no recent activity on the engagement (>14 days)
    const recentConversations = await ConversationMemoryModel.findOne({
      engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
      timestamp: { $gt: new Date(now - 14 * 24 * 60 * 60 * 1000) },
    }).lean();

    if (!recentConversations) {
      bottlenecks.push({
        description: 'No team activity on this engagement for over 14 days',
        blocker: 'Engagement appears inactive',
        impact: 'Risk of missing deadlines or losing project momentum',
        suggestedAction: 'Schedule a team check-in to review progress and reassign tasks',
        daysBlocked: 14,
      });
    }

    // Check for reports stuck in review
    const db = mongoose.connection.db;
    if (db) {
      const stalledReports = await db.collection('reports').find({
        engagementId: new (mongoose.Types.ObjectId as any)(engagementId),
        status: 'in_review',
        updatedAt: { $lt: new Date(now - 5 * 24 * 60 * 60 * 1000) },
      }).toArray();

      if (stalledReports.length > 0) {
        const daysStalled = Math.ceil(
          (now - new Date(stalledReports[0]!.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        bottlenecks.push({
          description: `${stalledReports.length} report(s) stuck in review for ${daysStalled}+ days`,
          blocker: 'Partner/reviewer approval pending',
          impact: 'Downstream publication and client delivery delayed',
          suggestedAction: 'Escalate to the partner or reassign review to an available reviewer',
          daysBlocked: daysStalled,
        });
      }
    }
  } catch (err) {
    logger.error('Failed to detect bottlenecks', err);
  }

  return bottlenecks.sort((a, b) => b.daysBlocked - a.daysBlocked);
}

// ============================================================
// 3. Task Assignments (derived from data state)
// ============================================================

async function getTaskAssignments(engagementId: string, users: any[]): Promise<TaskAssignment[]> {
  const assignments: TaskAssignment[] = [];
  const now = new Date();

  try {
    // Derive tasks from engagement state
    const engObjId = new (mongoose.Types.ObjectId as any)(engagementId);

    // Count data points by status
    const statusCounts = await DataPointModel.aggregate([
      { $match: { engagementId: engObjId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>();
    for (const s of statusCounts) {
      countMap.set(s._id, s.count);
    }

    const autoExtracted = countMap.get('auto_extracted') || 0;
    const missing = countMap.get('missing') || 0;

    // Assign review tasks to analysts
    const analysts = users.filter((u: any) => u.role === 'analyst');
    if (autoExtracted > 0 && analysts.length > 0) {
      const analyst = analysts[0]!;
      assignments.push({
        task: `Review and confirm ${autoExtracted} auto-extracted data points`,
        assigneeId: analyst._id.toString(),
        assigneeName: analyst.name,
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: autoExtracted > 20 ? 'in_progress' : 'pending',
      });
    }

    // Assign data collection tasks
    if (missing > 0 && analysts.length > 0) {
      const analyst = analysts[analysts.length > 1 ? 1 : 0]!;
      assignments.push({
        task: `Collect ${missing} missing data points from client`,
        assigneeId: analyst._id.toString(),
        assigneeName: analyst.name,
        deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        status: 'pending',
      });
    }

    // Check for reports needing review
    const db = mongoose.connection.db;
    if (db) {
      const draftReports = await db.collection('reports').find({
        engagementId: engObjId,
        status: 'draft',
      }).toArray();

      if (draftReports.length > 0) {
        const reviewers = users.filter((u: any) => ['owner', 'admin', 'manager', 'reviewer'].includes(u.role));
        const reviewer = reviewers[0];
        if (reviewer) {
          assignments.push({
            task: `Review ${draftReports.length} draft report section(s)`,
            assigneeId: reviewer._id.toString(),
            assigneeName: reviewer.name,
            deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
            status: 'pending',
          });
        }
      }
    }
  } catch (err) {
    logger.error('Failed to derive task assignments', err);
  }

  return assignments;
}

// ============================================================
// 4. Role-Aware Prompt Additions
// ============================================================

export function getRoleAwareSystemPromptAddition(
  userRole: string
): string {
  switch (userRole) {
    case 'analyst':
      return `USER ROLE: Analyst
COMMUNICATION STYLE:
- Be technically detailed and precise
- Provide actionable, step-by-step tasks
- Include framework references, metric codes, and methodology details
- Suggest data sources and calculation approaches
- Use professional but accessible language`;

    case 'owner':
    case 'admin':
      return `USER ROLE: Partner/Owner
COMMUNICATION STYLE:
- Lead with executive summary and key risks
- Focus on partner readiness score, compliance gaps, and deadline proximity
- Flag anything that could delay client delivery or create liability
- Be concise — bullet points over paragraphs
- Highlight items requiring partner-level decisions
- Frame recommendations in terms of business impact and risk`;

    case 'manager':
      return `USER ROLE: Manager
COMMUNICATION STYLE:
- Balance technical detail with strategic overview
- Focus on team progress, bottlenecks, and task assignments
- Highlight items requiring escalation or reallocation
- Provide both current status and recommended next steps
- Frame advice in terms of project delivery and team efficiency`;

    case 'reviewer':
      return `USER ROLE: Reviewer
COMMUNICATION STYLE:
- Focus on evidence quality, methodology adherence, and audit trail
- Reference specific framework requirements and standards
- Flag unsupported claims, missing citations, or unverified data
- Be methodical and thorough in assessments
- Suggest specific improvements with framework justification`;

    case 'auditor_readonly':
      return `USER ROLE: External Auditor (Read-Only)
COMMUNICATION STYLE:
- Focus entirely on evidence and methodology
- Reference specific standards (GHG Protocol, GRI, ESRS) for each assertion
- Provide audit trail information: data source, extraction method, confirmation status
- Never suggest edits — only observe and report
- Use formal, objective language consistent with assurance engagements
- Flag any areas where evidence is insufficient for assurance`;

    default:
      return `USER ROLE: Client/External User
COMMUNICATION STYLE:
- Use simple, non-technical language
- Focus on action items: what they need to provide or approve
- Avoid internal jargon, framework codes, and methodology detail
- Frame everything in terms of their deliverables and timeline
- Be supportive and encouraging about progress`;
  }
}
