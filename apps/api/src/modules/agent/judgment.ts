/**
 * Merris Quality Judgment Engine
 *
 * Judges whether ESG content meets the standard a Big 4 partner would approve.
 * Uses Claude with domain-specific expert prompt to produce structured assessments.
 */

import fs from 'fs/promises';
import path from 'path';
import { DataPointModel } from '../ingestion/ingestion.model.js';
import { Framework } from '../../models/framework.model.js';
import { sendMessage } from '../../lib/claude.js';
import { logger } from '../../lib/logger.js';
import { perceiveDocument, type DocumentPerception } from './perception.js';
import { KnowledgeReportModel } from '../../models/knowledge-report.model.js';

// ============================================================
// Types
// ============================================================

export interface QualityJudgment {
  overallScore: number;
  partnerWouldApprove: boolean;
  auditorWouldAccept: boolean;
  sections: SectionJudgment[];
  criticalIssues: JudgmentIssue[];
  improvements: JudgmentIssue[];
  suggestions: JudgmentIssue[];
}

export interface SectionJudgment {
  sectionTitle: string;
  frameworkRef: string;
  score: number;
  verdict: 'strong' | 'adequate' | 'weak' | 'unacceptable';
  reasoning: string;
  specificFeedback: string[];
}

export interface JudgmentIssue {
  type: 'accuracy' | 'completeness' | 'framing' | 'materiality' |
        'greenwash_risk' | 'liability_risk' | 'peer_gap' | 'regulatory_gap';
  severity: 'critical' | 'major' | 'minor';
  location: string;
  issue: string;
  recommendation: string;
  context: string;
}

export type JudgmentLevel = 'quick' | 'thorough' | 'partner_review';

export interface JudgmentRequest {
  engagementId: string;
  sectionContent?: string;
  sectionTitle?: string;
  frameworkRef?: string;
  fullDocumentBody?: string;
  judgmentLevel: JudgmentLevel;
}

// ============================================================
// System prompt loader
// ============================================================

let cachedPrompt: string | null = null;

async function loadJudgmentPrompt(): Promise<string> {
  if (cachedPrompt) return cachedPrompt;
  try {
    const promptPath = path.resolve(process.cwd(), 'prompts/judgment.md');
    cachedPrompt = await fs.readFile(promptPath, 'utf-8');
    return cachedPrompt;
  } catch {
    logger.warn('prompts/judgment.md not found, using embedded fallback');
    return 'You are a senior ESG advisor. Judge the quality of the following ESG disclosure section. Score 0-100. Return JSON with overallScore, verdict, criticalIssues, improvements, suggestions.';
  }
}

// ============================================================
// Main judgment functions
// ============================================================

/**
 * Judge a single section of an ESG report.
 */
export async function judgeSection(request: JudgmentRequest): Promise<SectionJudgment> {
  const { engagementId, sectionContent, sectionTitle, frameworkRef, judgmentLevel } = request;

  if (!sectionContent || !sectionTitle) {
    throw new Error('sectionContent and sectionTitle are required for section judgment');
  }

  // Gather context
  const [systemPrompt, dataPoints, orgContext] = await Promise.all([
    loadJudgmentPrompt(),
    DataPointModel.find({ engagementId }).lean(),
    getOrgContext(engagementId),
  ]);

  // Build the judgment request for Claude
  const detailLevel = judgmentLevel === 'quick'
    ? 'Provide a brief 2-3 sentence assessment with a score.'
    : judgmentLevel === 'partner_review'
      ? 'Simulate exactly what a Big 4 senior partner would say in a review meeting. Be direct, specific, and demanding.'
      : 'Provide a thorough section-by-section review with specific, actionable feedback.';

  const relevantData = dataPoints
    .filter((dp: any) => !frameworkRef || dp.frameworkRef?.includes(frameworkRef?.split(' ')[0] || ''))
    .slice(0, 20)
    .map((dp: any) => `${dp.metricName}: ${dp.value} ${dp.unit} (${dp.confidence}, ${dp.status})`)
    .join('\n');

  // K1 peer comparison: find top-scoring peer disclosure for same frameworkRef + sector
  let peerComparison = '';
  if (frameworkRef) {
    try {
      const orgSector = orgContext.split(',')[1]?.trim() || '';
      const refPattern = frameworkRef.replace(/[\s-]+/g, '.*');

      const peerReports = await KnowledgeReportModel.find({
        'narratives.frameworkRef': { $regex: new RegExp(refPattern, 'i') },
        ...(orgSector ? { sector: { $regex: new RegExp(orgSector.split(' ')[0] || '', 'i') } } : {}),
      })
        .sort({ 'quality.narrativeQuality': -1 })
        .limit(3)
        .lean();

      for (const report of peerReports) {
        const matchingNarrative = report.narratives.find((n) =>
          new RegExp(refPattern, 'i').test(n.frameworkRef)
        );
        if (matchingNarrative && matchingNarrative.qualityScore > 0) {
          peerComparison = `\nPEER BENCHMARK: ${report.company}'s ${frameworkRef} disclosure scores ${matchingNarrative.qualityScore}/100. ` +
            `Key attributes: ${matchingNarrative.hasQuantitativeData ? 'has quantitative data' : 'lacks quantitative data'}, ` +
            `${matchingNarrative.hasYoYComparison ? 'includes YoY comparison' : 'no YoY comparison'}, ` +
            `${matchingNarrative.hasMethodology ? 'references methodology' : 'no methodology reference'}. ` +
            `Use this as a quality reference when scoring.`;
          break;
        }
      }
    } catch {
      logger.debug('K1 peer comparison not available for judgment');
    }
  }

  const userMessage = `
${detailLevel}

SECTION TITLE: ${sectionTitle}
FRAMEWORK REFERENCE: ${frameworkRef || 'Not specified'}
ORGANIZATION CONTEXT: ${orgContext}
${peerComparison}

AVAILABLE DATA IN DATABASE:
${relevantData || 'No data points found for this section.'}

SECTION CONTENT TO REVIEW:
${sectionContent}
`;

  const response = await sendMessage({
    model: judgmentLevel === 'quick' ? 'claude-sonnet-4-20250514' : 'claude-sonnet-4-20250514',
    maxTokens: judgmentLevel === 'quick' ? 500 : 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  if (!response) {
    // Fallback: deterministic scoring when Claude is unavailable
    return deterministicJudgment(sectionContent, sectionTitle, frameworkRef || '', dataPoints);
  }

  // Parse Claude's JSON response
  try {
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      sectionTitle,
      frameworkRef: frameworkRef || '',
      score: parsed.overallScore ?? 50,
      verdict: scoreToVerdict(parsed.overallScore ?? 50),
      reasoning: parsed.reasoning ?? '',
      specificFeedback: [
        ...(parsed.criticalIssues || []).map((i: any) => `[CRITICAL] ${i.issue}: ${i.recommendation}`),
        ...(parsed.improvements || []).map((i: any) => `[IMPROVE] ${i.issue}: ${i.recommendation}`),
        ...(parsed.suggestions || []).map((i: any) => `[SUGGEST] ${i.issue}: ${i.recommendation}`),
      ],
    };
  } catch {
    // If JSON parsing fails, extract what we can
    return {
      sectionTitle,
      frameworkRef: frameworkRef || '',
      score: 60,
      verdict: 'weak',
      reasoning: response.substring(0, 500),
      specificFeedback: [response.substring(0, 1000)],
    };
  }
}

/**
 * Judge an entire document — runs judgment on every section.
 */
export async function judgeDocument(request: JudgmentRequest): Promise<QualityJudgment> {
  const { engagementId, fullDocumentBody, judgmentLevel } = request;

  if (!fullDocumentBody) {
    throw new Error('fullDocumentBody is required for document judgment');
  }

  // First, perceive the document to get its structure
  const perception = await perceiveDocument(engagementId, fullDocumentBody, 'word');

  // Judge each drafted section
  const sectionJudgments: SectionJudgment[] = [];
  const allIssues: { critical: JudgmentIssue[]; improvements: JudgmentIssue[]; suggestions: JudgmentIssue[] } = {
    critical: [],
    improvements: [],
    suggestions: [],
  };

  // Extract section content from document body
  const sections = extractSectionsContent(fullDocumentBody, perception);

  for (const section of sections) {
    if (section.status === 'empty' || section.content.trim().length < 20) continue;

    const sectionJudgment = await judgeSection({
      engagementId,
      sectionContent: section.content,
      sectionTitle: section.heading,
      frameworkRef: section.frameworkRef || undefined,
      judgmentLevel: judgmentLevel === 'partner_review' ? 'partner_review' : 'quick',
    });

    sectionJudgments.push(sectionJudgment);

    // Categorize feedback into issues
    for (const fb of sectionJudgment.specificFeedback) {
      const issue: JudgmentIssue = {
        type: fb.includes('accuracy') || fb.includes('figure') ? 'accuracy' :
              fb.includes('complete') || fb.includes('missing') ? 'completeness' :
              fb.includes('greenwash') ? 'greenwash_risk' :
              fb.includes('liability') || fb.includes('legal') ? 'liability_risk' : 'framing',
        severity: fb.startsWith('[CRITICAL]') ? 'critical' : fb.startsWith('[IMPROVE]') ? 'major' : 'minor',
        location: sectionJudgment.sectionTitle,
        issue: fb.replace(/^\[(CRITICAL|IMPROVE|SUGGEST)\]\s*/, '').split(':')[0] || fb,
        recommendation: fb.split(':').slice(1).join(':').trim() || '',
        context: sectionJudgment.reasoning,
      };

      if (issue.severity === 'critical') allIssues.critical.push(issue);
      else if (issue.severity === 'major') allIssues.improvements.push(issue);
      else allIssues.suggestions.push(issue);
    }
  }

  // Add perception-based issues
  for (const mismatch of perception.dataAlignment.mismatches) {
    allIssues.critical.push({
      type: 'accuracy',
      severity: 'critical',
      location: mismatch.metric,
      issue: `Document says ${mismatch.documentValue.toLocaleString()} but database has ${mismatch.databaseValue.toLocaleString()} ${mismatch.databaseUnit}`,
      recommendation: mismatch.suggestion,
      context: 'Data mismatch detected by perception engine',
    });
  }

  for (const gap of perception.complianceStatus.mandatoryGaps) {
    allIssues.critical.push({
      type: 'regulatory_gap',
      severity: 'critical',
      location: `${gap.framework} ${gap.disclosureCode}`,
      issue: `Mandatory disclosure missing: ${gap.disclosureName}`,
      recommendation: `Add a section addressing ${gap.disclosureCode}. This is required by ${gap.framework}.`,
      context: 'Compliance gap detected by perception engine',
    });
  }

  // Calculate overall score
  const scores = sectionJudgments.map(s => s.score);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  // Adjust for critical issues
  const adjustedScore = Math.max(0, avgScore - (allIssues.critical.length * 5));

  return {
    overallScore: adjustedScore,
    partnerWouldApprove: adjustedScore >= 75 && allIssues.critical.length === 0,
    auditorWouldAccept: adjustedScore >= 70 && allIssues.critical.filter(i => i.type === 'accuracy').length === 0,
    sections: sectionJudgments,
    criticalIssues: allIssues.critical,
    improvements: allIssues.improvements,
    suggestions: allIssues.suggestions,
  };
}

// ============================================================
// Deterministic fallback (no Claude)
// ============================================================

function deterministicJudgment(
  content: string,
  title: string,
  frameworkRef: string,
  dataPoints: any[]
): SectionJudgment {
  let score = 50;
  const feedback: string[] = [];

  // Word count check
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 150) score += 10;
  else if (wordCount < 50) {
    score -= 15;
    feedback.push('[CRITICAL] Section is too short for a framework disclosure — minimum 100-150 words expected');
  }

  // Has numbers (data-backed)
  const numbers = content.match(/[\d,]+\.?\d*/g) || [];
  if (numbers.length >= 3) score += 10;
  else {
    score -= 10;
    feedback.push('[IMPROVE] Section lacks quantitative data — disclosures should include specific figures');
  }

  // Has methodology reference
  if (/methodology|ghg protocol|gri|framework|standard/i.test(content)) score += 5;
  else feedback.push('[SUGGEST] Add methodology reference (e.g., GHG Protocol, GRI guidance)');

  // Has YoY comparison
  if (/year.over.year|yoy|compared to|previous year|baseline|20\d{2}/i.test(content)) score += 5;
  else feedback.push('[IMPROVE] Add year-on-year comparison to show trends');

  // Has unit consistency
  if (/tCO2e|kWh|m³|tonnes/i.test(content)) score += 5;

  // Check if data points support the content
  const relevantDps = dataPoints.filter((dp: any) =>
    dp.frameworkRef?.includes(frameworkRef.split(' ')[0] || '')
  );
  if (relevantDps.length > 0) score += 10;
  else feedback.push('[IMPROVE] No confirmed data points found for this section in the database');

  // Greenwash check
  if (/leading|best.in.class|world.class|pioneer/i.test(content) && !/evidence|data|third.party|verified/i.test(content)) {
    score -= 10;
    feedback.push('[CRITICAL] Unsubstantiated superlative claims detected — risk of greenwash allegation');
  }

  // Placeholder check
  if (/\[TO BE|TBD|placeholder|insert\]/i.test(content)) {
    score -= 20;
    feedback.push('[CRITICAL] Contains placeholder text — must be completed before submission');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    sectionTitle: title,
    frameworkRef,
    score,
    verdict: scoreToVerdict(score),
    reasoning: `Deterministic assessment: ${wordCount} words, ${numbers.length} figures, ${relevantDps.length} supporting data points.`,
    specificFeedback: feedback,
  };
}

// ============================================================
// Helpers
// ============================================================

function scoreToVerdict(score: number): 'strong' | 'adequate' | 'weak' | 'unacceptable' {
  if (score >= 85) return 'strong';
  if (score >= 75) return 'adequate';
  if (score >= 60) return 'weak';
  return 'unacceptable';
}

interface SectionContent {
  heading: string;
  content: string;
  status: string;
  frameworkRef: string | null;
}

function extractSectionsContent(body: string, perception: DocumentPerception): SectionContent[] {
  const lines = body.split('\n');
  const sections: SectionContent[] = [];
  let currentIdx = -1;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this line matches a known section heading
    const matchedSection = perception.structure.sections.find(s =>
      trimmed.includes(s.heading) || s.heading.includes(trimmed)
    );

    if (matchedSection && trimmed.length > 3) {
      currentIdx++;
      sections.push({
        heading: matchedSection.heading,
        content: '',
        status: matchedSection.status,
        frameworkRef: matchedSection.frameworkRef,
      });
    } else if (currentIdx >= 0 && sections[currentIdx]) {
      sections[currentIdx]!.content += trimmed + '\n';
    }
  }

  return sections;
}

async function getOrgContext(engagementId: string): Promise<string> {
  try {
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    if (!db) return 'Unknown organization';

    const engagement = await db.collection('engagements').findOne({
      _id: new (mongoose.default.Types.ObjectId as any)(engagementId),
    });
    if (!engagement) return 'Unknown engagement';

    const orgProfile = await db.collection('orgprofiles').findOne({
      orgId: engagement.orgId,
    });

    if (!orgProfile) return `Engagement: ${engagement.name}`;

    return `${orgProfile.tradingName || orgProfile.legalName || 'Organization'}, ` +
      `${orgProfile.subIndustry || orgProfile.industryGICS || 'unknown'} sector, ` +
      `${orgProfile.country || 'unknown'} (${orgProfile.listingStatus || 'unknown'} on ${orgProfile.exchange || 'N/A'}), ` +
      `${orgProfile.employeeCount || '?'} employees, ESG maturity: ${orgProfile.esgMaturity || 'unknown'}`;
  } catch {
    return 'Context unavailable';
  }
}
