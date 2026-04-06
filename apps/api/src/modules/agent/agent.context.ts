import mongoose from 'mongoose';
import { OrgProfileModel } from '../organization/organization.model.js';
import { DataPointModel } from '../ingestion/ingestion.model.js';
import { UserModel } from '../auth/auth.model.js';
import { Framework } from '../../models/framework.model.js';
import { getCompleteness } from '../data-collection/data-collection.service.js';
import { buildMemoryContext } from './memory.js';
import { logger } from '../../lib/logger.js';
import type { DataPointStatus } from '@merris/shared';

// ============================================================
// Types
// ============================================================

export interface EngagementSummary {
  name: string;
  scope: string;
  deadline: string;
  status: string;
}

export interface OrgProfileSummary {
  industry: string;
  country: string;
  listing: string;
  size: string;
}

export interface FrameworkSummaryForContext {
  code: string;
  name: string;
  type: string;
}

export interface DataCompletenessSummary {
  overall: number;
  byFramework: Array<{
    code: string;
    total: number;
    completed: number;
    percentage: number;
  }>;
}

export interface RecentActivityEntry {
  action: string;
  metric: string;
  timestamp: string;
}

export interface AgentContextData {
  engagement: EngagementSummary;
  orgProfile: OrgProfileSummary;
  activeFrameworks: FrameworkSummaryForContext[];
  dataCompleteness: DataCompletenessSummary;
  currentStage: string;
  recentActivity: RecentActivityEntry[];
  userRole: string;
  memoryContext?: string;
}

// ============================================================
// Context Builder
// ============================================================

export async function buildAgentContext(
  engagementId: string,
  userId: string
): Promise<AgentContextData> {
  // Fetch user for role info
  let userRole = 'analyst';
  try {
    const user = await UserModel.findById(userId).lean();
    if (user) {
      userRole = user.role;
    }
  } catch (err) {
    logger.warn('Could not fetch user for agent context', err);
  }

  // Fetch org profile
  let orgProfile: OrgProfileSummary = {
    industry: 'Unknown',
    country: 'Unknown',
    listing: 'Unknown',
    size: 'Unknown',
  };

  try {
    const user = await UserModel.findById(userId).lean();
    if (user) {
      const profile = await OrgProfileModel.findOne({
        orgId: user.orgId,
      }).lean();
      if (profile) {
        orgProfile = {
          industry: profile.industryGICS,
          country: profile.country,
          listing: profile.listingStatus,
          size: `${profile.employeeCount} employees`,
        };
      }
    }
  } catch (err) {
    logger.warn('Could not fetch org profile for agent context', err);
  }

  // Fetch active frameworks
  let activeFrameworks: FrameworkSummaryForContext[] = [];
  try {
    const frameworks = await Framework.find({}).lean();
    activeFrameworks = frameworks.map((fw) => ({
      code: fw.code,
      name: fw.name,
      type: fw.type,
    }));
  } catch (err) {
    logger.warn('Could not fetch frameworks for agent context', err);
  }

  // Get data completeness
  let dataCompleteness: DataCompletenessSummary = {
    overall: 0,
    byFramework: [],
  };

  try {
    const completeness = await getCompleteness(engagementId);
    dataCompleteness = {
      overall: completeness.overall.percentage,
      byFramework: completeness.byFramework.map((fw) => ({
        code: fw.code,
        total: fw.total,
        completed: fw.completed,
        percentage: fw.percentage,
      })),
    };
  } catch (err) {
    logger.warn('Could not fetch completeness for agent context', err);
  }

  // Determine current stage from data completeness
  let currentStage = 'data_collection';
  if (dataCompleteness.overall >= 90) {
    currentStage = 'review';
  } else if (dataCompleteness.overall >= 60) {
    currentStage = 'drafting';
  }

  // Get recent activity from audit trails
  let recentActivity: RecentActivityEntry[] = [];
  try {
    const recentDataPoints = await DataPointModel.find({
      engagementId: new mongoose.Types.ObjectId(engagementId),
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    recentActivity = recentDataPoints.map((dp) => {
      const lastAudit = dp.auditTrail[dp.auditTrail.length - 1];
      return {
        action: lastAudit?.action || 'updated',
        metric: dp.metricName,
        timestamp: dp.updatedAt.toISOString(),
      };
    });
  } catch (err) {
    logger.warn('Could not fetch recent activity for agent context', err);
  }

  // Build engagement summary
  let engagementName = `Engagement ${engagementId}`;
  try {
    const db = mongoose.connection.db;
    if (db) {
      const eng = await db.collection('engagements').findOne({
        _id: new mongoose.Types.ObjectId(engagementId),
      });
      if (eng) engagementName = eng.name || engagementName;
    }
  } catch { /* fallback name */ }

  const engagement: EngagementSummary = {
    name: engagementName,
    scope: 'ESG Reporting',
    deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    status: currentStage,
  };

  // Build memory context (conversations, decisions, style preferences)
  let memoryContext = '';
  try {
    const user = await UserModel.findById(userId).lean();
    memoryContext = await buildMemoryContext(
      engagementId,
      userId,
      user?.orgId?.toString(),
    );
  } catch {
    // Memory is non-critical
  }

  return {
    engagement,
    orgProfile,
    activeFrameworks,
    dataCompleteness,
    currentStage,
    recentActivity,
    userRole,
    memoryContext,
  };
}
