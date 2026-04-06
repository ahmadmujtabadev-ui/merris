/**
 * Merris Perception Engine
 *
 * Reads an entire document on open, cross-references against engagement data,
 * and produces a situational briefing BEFORE the user interacts.
 *
 * Supports: Word (reports), Excel (data sheets), PowerPoint (decks), Outlook (emails)
 */

import { DataPointModel } from '../ingestion/ingestion.model.js';
import { Framework } from '../../models/framework.model.js';
import { getCompleteness } from '../data-collection/data-collection.service.js';
import { sendMessage } from '../../lib/claude.js';
import { logger } from '../../lib/logger.js';
import mongoose from 'mongoose';
import { judgeSection } from './judgment.js';
import { catchMeUp, buildMemoryContext } from './memory.js';
import { getTeamContext, getRoleAwareSystemPromptAddition, type TeamContext } from './team-awareness.js';
import { detectEmotionalContext, getAdaptivePromptAddition } from './learning.js';
import { UserModel } from '../auth/auth.model.js';

// ============================================================
// Types
// ============================================================

export interface DocumentPerception {
  structure: {
    title: string;
    sections: SectionAnalysis[];
    totalSections: number;
    draftedSections: number;
    emptySections: number;
    placeholderSections: number;
  };
  dataAlignment: {
    figuresInDocument: ExtractedFigure[];
    figuresInDatabase: DatabaseFigure[];
    mismatches: DataMismatch[];
    missingFromDocument: string[];
    undocumentedFigures: string[];
  };
  complianceStatus: {
    frameworksCovered: string[];
    mandatoryGaps: ComplianceGap[];
    qualityIssues: QualityIssue[];
  };
  urgency: {
    deadlineDays: number | null;
    criticalActions: string[];
    partnerReadiness: number;
  };
  briefing: string;
}

export interface SectionAnalysis {
  heading: string;
  level: number;
  status: 'drafted' | 'placeholder' | 'empty' | 'data_only';
  frameworkRef: string | null;
  figureCount: number;
  wordCount: number;
  issues: string[];
}

export interface ExtractedFigure {
  value: number;
  rawText: string;
  unit: string;
  context: string;
  sectionHeading: string;
}

export interface DatabaseFigure {
  metricName: string;
  value: number | string;
  unit: string;
  frameworkRef: string;
  confidence: string;
  status: string;
}

export interface DataMismatch {
  metric: string;
  documentValue: number;
  documentContext: string;
  databaseValue: number | string;
  databaseUnit: string;
  severity: 'critical' | 'warning';
  suggestion: string;
}

export interface ComplianceGap {
  framework: string;
  disclosureCode: string;
  disclosureName: string;
  requirement: 'mandatory' | 'recommended';
  reason: string;
}

export interface QualityIssue {
  section: string;
  type: 'too_short' | 'no_data' | 'stale_figure' | 'missing_methodology' | 'missing_yoy';
  description: string;
}

// ============================================================
// Main perception function
// ============================================================

export async function perceiveDocument(
  engagementId: string,
  documentBody: string,
  documentType: 'word' | 'excel' | 'powerpoint' | 'outlook'
): Promise<DocumentPerception> {
  // Run all analysis steps in parallel where possible
  const [structure, dataPoints, frameworks, completeness, engagement] = await Promise.all([
    analyzeStructure(documentBody, documentType),
    DataPointModel.find({ engagementId }).lean(),
    getEngagementFrameworks(engagementId),
    getCompleteness(engagementId).catch(() => null),
    getEngagementInfo(engagementId),
  ]);

  // Extract figures from document
  const figuresInDocument = extractFigures(documentBody, structure.sections);

  // Build database figures list
  const figuresInDatabase: DatabaseFigure[] = dataPoints.map((dp: any) => ({
    metricName: dp.metricName,
    value: dp.value,
    unit: dp.unit,
    frameworkRef: dp.frameworkRef,
    confidence: dp.confidence,
    status: dp.status,
  }));

  // Cross-reference: find mismatches
  const mismatches = findMismatches(figuresInDocument, figuresInDatabase);

  // Find data in DB but not in document
  const missingFromDocument = findMissingFromDocument(figuresInDatabase, figuresInDocument, documentType);

  // Find figures in document with no database source
  const undocumentedFigures = findUndocumentedFigures(figuresInDocument, figuresInDatabase);

  // Check compliance gaps
  const complianceStatus = await checkComplianceGaps(
    structure.sections,
    frameworks,
    dataPoints,
    documentType
  );

  // Quality issues
  const qualityIssues = assessQuality(structure.sections, figuresInDatabase, documentType);

  // Calculate partner readiness
  const partnerReadiness = calculatePartnerReadiness(
    structure,
    mismatches,
    complianceStatus.mandatoryGaps,
    qualityIssues,
    completeness
  );

  // Calculate deadline
  const deadlineDays = engagement?.deadline
    ? Math.ceil((new Date(engagement.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Critical actions
  const criticalActions = determineCriticalActions(
    mismatches,
    complianceStatus.mandatoryGaps,
    qualityIssues,
    deadlineDays,
    documentType
  );

  const perception: DocumentPerception = {
    structure: {
      title: structure.title,
      sections: structure.sections,
      totalSections: structure.sections.length,
      draftedSections: structure.sections.filter(s => s.status === 'drafted').length,
      emptySections: structure.sections.filter(s => s.status === 'empty').length,
      placeholderSections: structure.sections.filter(s => s.status === 'placeholder').length,
    },
    dataAlignment: {
      figuresInDocument,
      figuresInDatabase,
      mismatches,
      missingFromDocument,
      undocumentedFigures,
    },
    complianceStatus,
    urgency: {
      deadlineDays,
      criticalActions,
      partnerReadiness,
    },
    briefing: '', // Generated below
  };

  // Generate natural language briefing
  perception.briefing = await generateBriefing(perception, documentType, engagement);

  return perception;
}

// ============================================================
// Structure Analysis
// ============================================================

interface StructureResult {
  title: string;
  sections: SectionAnalysis[];
}

function analyzeStructure(body: string, docType: 'word' | 'excel' | 'powerpoint' | 'outlook'): StructureResult {
  if (docType === 'excel') return analyzeExcelStructure(body);
  if (docType === 'powerpoint') return analyzePowerPointStructure(body);
  if (docType === 'outlook') return analyzeOutlookStructure(body);
  return analyzeWordStructure(body);
}

function analyzeWordStructure(body: string): StructureResult {
  // Preprocess: Word.js body.text may use \r or \r\n, normalize to \n
  // Also try to split on common heading patterns if text has no newlines
  let normalized = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // If the body has very few newlines, it might be a single block — try splitting on heading patterns
  const lineCount = normalized.split('\n').filter(l => l.trim()).length;
  if (lineCount < 3 && normalized.length > 200) {
    // Insert newlines before numbered headings and known heading patterns
    normalized = normalized
      .replace(/(\d+\.\d+\s+[A-Z])/g, '\n$1')
      .replace(/(\d+\.\s+[A-Z])/g, '\n$1')
      .replace(/(GRI\s+\d{3})/gi, '\n$1')
      .replace(/(ESRS\s+[A-Z]\d)/gi, '\n$1')
      .replace(/(\[TO BE )/gi, '\n$1');
  }

  const lines = normalized.split('\n');
  const sections: SectionAnalysis[] = [];
  let title = '';
  let currentSection: Partial<SectionAnalysis> | null = null;
  let currentContent = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect headings: multiple patterns
    const headingMatch =
      // Markdown-style: ## Heading
      trimmed.match(/^(#{1,6})\s+(.+)/) ||
      // Numbered with dot: "1. Title", "2.1 Subtitle", "3.1.2 Sub-subtitle"
      trimmed.match(/^(\d+(?:\.\d+)*)\.\s+(.+)/) ||
      // Numbered without dot: "1 Title" (only if short enough to be a heading)
      (trimmed.length < 120 ? trimmed.match(/^(\d+(?:\.\d+)*)\s+([A-Z].{3,})/) : null) ||
      // GRI-style: "GRI 305-1: Direct GHG Emissions"
      trimmed.match(/^(GRI\s+\d{3}(?:-\d+)?)[:\s]+(.+)/i) ||
      // ESRS-style: "ESRS E1-6: Gross Scopes"
      trimmed.match(/^(ESRS\s+[A-Z]\d(?:-\d+)?)[:\s]+(.+)/i) ||
      // TCFD pillars
      (/^(Governance|Strategy|Risk Management|Metrics (?:&|and) Targets)$/i.test(trimmed)
        ? [null, '1', trimmed] : null) ||
      // ALL CAPS short lines (not starting with a number, not a data row)
      (trimmed.length > 3 && trimmed.length < 80 && trimmed === trimmed.toUpperCase()
        && !/^\d/.test(trimmed) && !/\d{3,}/.test(trimmed)
        ? [null, '1', trimmed] : null);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.wordCount = currentContent.split(/\s+/).filter(Boolean).length;
        currentSection.status = classifySection(currentContent);
        currentSection.figureCount = (currentContent.match(/[\d,]+\.?\d*/g) || []).length;
        sections.push(currentSection as SectionAnalysis);
      }

      const level = typeof headingMatch[1] === 'string' && headingMatch[1].startsWith('#')
        ? headingMatch[1].length
        : (headingMatch[1]?.toString().split('.').length || 1);
      const heading = headingMatch[2]?.toString().trim() || trimmed;

      if (!title && level <= 1) title = heading;

      currentSection = {
        heading,
        level,
        status: 'empty',
        frameworkRef: detectFrameworkRef(heading),
        figureCount: 0,
        wordCount: 0,
        issues: [],
      };
      currentContent = '';
    } else if (currentSection) {
      currentContent += trimmed + ' ';
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.wordCount = currentContent.split(/\s+/).filter(Boolean).length;
    currentSection.status = classifySection(currentContent);
    currentSection.figureCount = (currentContent.match(/[\d,]+\.?\d*/g) || []).length;
    sections.push(currentSection as SectionAnalysis);
  }

  if (!title && sections.length > 0) title = sections[0]!.heading;

  return { title: title || 'Untitled Document', sections };
}

function analyzeExcelStructure(body: string): StructureResult {
  // Excel body comes as tab-separated text from sheets
  const sheets = body.split(/Sheet:\s*/i).filter(Boolean);
  const sections: SectionAnalysis[] = sheets.map((sheet, i) => {
    const lines = sheet.split('\n');
    const sheetName = lines[0]?.trim() || `Sheet ${i + 1}`;
    const content = lines.slice(1).join(' ');
    const numberCount = (content.match(/[\d,]+\.?\d*/g) || []).length;
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    return {
      heading: sheetName,
      level: 1,
      status: numberCount > 5 ? 'data_only' as const : wordCount > 20 ? 'drafted' as const : 'empty' as const,
      frameworkRef: detectFrameworkRef(sheetName),
      figureCount: numberCount,
      wordCount,
      issues: [],
    };
  });
  return { title: sections[0]?.heading || 'ESG Data Workbook', sections };
}

function analyzePowerPointStructure(body: string): StructureResult {
  // PowerPoint body comes as slide-separated text
  const slides = body.split(/Slide\s*\d+/i).filter(Boolean);
  const sections: SectionAnalysis[] = slides.map((slide, i) => {
    const lines = slide.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines[0] || `Slide ${i + 1}`;
    const content = lines.slice(1).join(' ');
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    return {
      heading: title,
      level: 1,
      status: wordCount > 10 ? 'drafted' as const : wordCount > 0 ? 'placeholder' as const : 'empty' as const,
      frameworkRef: detectFrameworkRef(title),
      figureCount: (content.match(/[\d,]+\.?\d*/g) || []).length,
      wordCount,
      issues: [],
    };
  });
  return { title: 'ESG Presentation', sections };
}

function analyzeOutlookStructure(body: string): StructureResult {
  // Outlook: analyze email body as a single section
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  return {
    title: 'Email',
    sections: [{
      heading: 'Email Body',
      level: 1,
      status: wordCount > 20 ? 'drafted' : 'empty',
      frameworkRef: null,
      figureCount: (body.match(/[\d,]+\.?\d*/g) || []).length,
      wordCount,
      issues: [],
    }],
  };
}

function classifySection(content: string): SectionAnalysis['status'] {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length < 10) return 'empty';
  if (/\[TO BE (DRAFTED|COMPLETED|WRITTEN|ADDED)\]/i.test(trimmed)) return 'placeholder';
  if (/\[TBD\]|\[PLACEHOLDER\]|\[INSERT\]|\[PENDING\]/i.test(trimmed)) return 'placeholder';
  // Data-only: mostly numbers, minimal narrative
  const words = trimmed.split(/\s+/);
  const numberWords = words.filter(w => /^\d[\d,.]*$/.test(w));
  if (words.length > 5 && numberWords.length / words.length > 0.5) return 'data_only';
  return 'drafted';
}

function detectFrameworkRef(heading: string): string | null {
  const patterns: [RegExp, string][] = [
    [/GRI\s*(\d{3}(?:-\d+)?)/i, 'GRI'],
    [/ESRS\s*([A-Z]\d(?:-\d+)?)/i, 'ESRS'],
    [/TCFD/i, 'TCFD'],
    [/SASB/i, 'SASB'],
    [/ISSB|IFRS\s*S/i, 'ISSB'],
    [/CDP/i, 'CDP'],
    [/Saudi\s*Exchange|29\s*KPI/i, 'saudi-exchange'],
    [/ADX/i, 'ADX'],
    [/QSE/i, 'QSE'],
  ];

  for (const [regex, framework] of patterns) {
    const match = heading.match(regex);
    if (match) return match[1] ? `${framework} ${match[1]}` : framework;
  }

  // Topic-based detection
  if (/emission|ghg|scope\s*[123]|carbon/i.test(heading)) return 'GRI 305';
  if (/energy|electricity|fuel/i.test(heading)) return 'GRI 302';
  if (/water|effluent/i.test(heading)) return 'GRI 303';
  if (/waste|circular/i.test(heading)) return 'GRI 306';
  if (/biodiversity|habitat/i.test(heading)) return 'GRI 304';
  if (/employment|employee|workforce/i.test(heading)) return 'GRI 401';
  if (/health.*safety|incident|ltifr/i.test(heading)) return 'GRI 403';
  if (/diversity|gender|inclusion/i.test(heading)) return 'GRI 405';
  if (/governance|board|ethics/i.test(heading)) return 'GRI 2';
  if (/human\s*right/i.test(heading)) return 'GRI 412';
  if (/supply\s*chain|supplier/i.test(heading)) return 'GRI 414';
  if (/climate\s*risk|scenario/i.test(heading)) return 'TCFD';
  if (/materiality/i.test(heading)) return 'GRI 3';

  return null;
}

// ============================================================
// Figure Extraction & Cross-Referencing
// ============================================================

function extractFigures(body: string, sections: SectionAnalysis[]): ExtractedFigure[] {
  const figures: ExtractedFigure[] = [];
  const lines = body.split('\n');
  let currentHeading = 'Document';

  // Track which section we're in
  for (const line of lines) {
    const trimmed = line.trim();
    // Update current heading
    for (const sec of sections) {
      if (trimmed.includes(sec.heading)) {
        currentHeading = sec.heading;
        break;
      }
    }

    // Extract numbers with context
    const numberPattern = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(tCO2e|tCO₂e|kWh|MWh|GWh|GJ|TJ|m³|m3|ML|tonnes|tons|kg|employees|FTE|%|QAR|USD|EUR|GBP|kW|MW)?/gi;
    let match;
    while ((match = numberPattern.exec(trimmed)) !== null) {
      const rawValue = match[1]!.replace(/,/g, '');
      const numValue = parseFloat(rawValue);
      // Skip trivially small numbers (page numbers, dates, etc.)
      if (numValue < 10 && !match[2]) continue;
      // Skip year-like numbers
      if (numValue >= 1990 && numValue <= 2100 && !match[2]) continue;

      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(trimmed.length, match.index + match[0].length + 50);
      const context = trimmed.substring(contextStart, contextEnd);

      figures.push({
        value: numValue,
        rawText: match[0],
        unit: match[2] || '',
        context,
        sectionHeading: currentHeading,
      });
    }
  }

  return figures;
}

function findMismatches(docFigures: ExtractedFigure[], dbFigures: DatabaseFigure[]): DataMismatch[] {
  const mismatches: DataMismatch[] = [];

  for (const dbFig of dbFigures) {
    if (typeof dbFig.value !== 'number') continue;

    // Find document figures that are close but not exact matches
    for (const docFig of docFigures) {
      // Check if values are in the same ballpark (within 10%) but not equal
      const ratio = docFig.value / (dbFig.value as number);
      if (ratio > 0.85 && ratio < 1.15 && ratio !== 1.0) {
        // Context should mention something related to this metric
        const contextLower = docFig.context.toLowerCase();
        const metricLower = dbFig.metricName.toLowerCase();
        const metricWords = metricLower.split(/\s+/);
        const hasOverlap = metricWords.some(w => w.length > 3 && contextLower.includes(w));

        if (hasOverlap) {
          const diff = Math.abs(docFig.value - (dbFig.value as number));
          mismatches.push({
            metric: dbFig.metricName,
            documentValue: docFig.value,
            documentContext: docFig.context,
            databaseValue: dbFig.value,
            databaseUnit: dbFig.unit,
            severity: diff / (dbFig.value as number) > 0.05 ? 'critical' : 'warning',
            suggestion: `Update document from ${docFig.value.toLocaleString()} to ${(dbFig.value as number).toLocaleString()} ${dbFig.unit}`,
          });
        }
      }
    }
  }

  return mismatches;
}

function findMissingFromDocument(
  dbFigures: DatabaseFigure[],
  docFigures: ExtractedFigure[],
  docType: string
): string[] {
  if (docType === 'outlook') return []; // Emails don't need all data

  const missing: string[] = [];
  const docValues = new Set(docFigures.map(f => f.value));

  for (const dbFig of dbFigures) {
    if (typeof dbFig.value !== 'number') continue;
    if (dbFig.status === 'missing') continue;

    // Check if this value (or a rounded version) appears in the document
    const val = dbFig.value as number;
    const found = docValues.has(val) ||
      docValues.has(Math.round(val)) ||
      docValues.has(Math.round(val / 1000) * 1000);

    if (!found) {
      missing.push(`${dbFig.metricName} (${val.toLocaleString()} ${dbFig.unit}) — confirmed in database but not found in document`);
    }
  }

  return missing.slice(0, 20); // Cap at 20 for readability
}

function findUndocumentedFigures(docFigures: ExtractedFigure[], dbFigures: DatabaseFigure[]): string[] {
  const dbValues = new Set(
    dbFigures
      .filter(f => typeof f.value === 'number')
      .map(f => f.value as number)
  );

  const undocumented: string[] = [];
  for (const docFig of docFigures) {
    if (docFig.value < 100) continue; // Skip small numbers
    if (!dbValues.has(docFig.value) && !dbValues.has(Math.round(docFig.value))) {
      undocumented.push(`${docFig.rawText} in "${docFig.sectionHeading}" — no matching source in database`);
    }
  }

  return undocumented.slice(0, 15);
}

// ============================================================
// Compliance Analysis
// ============================================================

async function checkComplianceGaps(
  sections: SectionAnalysis[],
  frameworks: FrameworkInfo[],
  dataPoints: any[],
  docType: string
): Promise<{ frameworksCovered: string[]; mandatoryGaps: ComplianceGap[]; qualityIssues: QualityIssue[] }> {
  const frameworksCovered = [...new Set(sections.map(s => s.frameworkRef).filter(Boolean) as string[])];
  const mandatoryGaps: ComplianceGap[] = [];
  const qualityIssues: QualityIssue[] = [];

  // Only check compliance for Word documents (reports)
  if (docType !== 'word') {
    return { frameworksCovered, mandatoryGaps, qualityIssues };
  }

  for (const fw of frameworks) {
    if (fw.type !== 'mandatory') continue;

    // Check if key disclosures have corresponding sections
    for (const topic of fw.topics) {
      for (const disc of topic.disclosures) {
        const sectionExists = sections.some(s =>
          s.frameworkRef?.includes(disc.code) ||
          s.heading.toLowerCase().includes(disc.name.toLowerCase().substring(0, 20))
        );
        const dataExists = dataPoints.some((dp: any) =>
          dp.frameworkRef?.includes(disc.code)
        );

        if (!sectionExists && !dataExists) {
          mandatoryGaps.push({
            framework: fw.code,
            disclosureCode: disc.code,
            disclosureName: disc.name,
            requirement: 'mandatory',
            reason: `No section or data found for ${disc.code}: ${disc.name}`,
          });
        } else if (sectionExists) {
          const section = sections.find(s =>
            s.frameworkRef?.includes(disc.code)
          );
          if (section && section.status === 'placeholder') {
            qualityIssues.push({
              section: section.heading,
              type: 'no_data',
              description: `${disc.code} section exists but contains only placeholder text`,
            });
          }
          if (section && section.wordCount < 50 && disc.dataType === 'narrative') {
            qualityIssues.push({
              section: section.heading,
              type: 'too_short',
              description: `${disc.code} narrative disclosure is only ${section.wordCount} words — typical minimum is 100-150`,
            });
          }
        }
      }
    }
  }

  return { frameworksCovered, mandatoryGaps: mandatoryGaps.slice(0, 25), qualityIssues };
}

function assessQuality(
  sections: SectionAnalysis[],
  dbFigures: DatabaseFigure[],
  docType: string
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (docType === 'word') {
    for (const section of sections) {
      if (section.status === 'drafted' && section.wordCount < 30 && section.frameworkRef) {
        issues.push({
          section: section.heading,
          type: 'too_short',
          description: `Only ${section.wordCount} words — insufficient for framework disclosure`,
        });
      }
    }
  }

  if (docType === 'excel') {
    // Check for empty cells where data exists in DB
    const confirmedMetrics = dbFigures.filter(f => f.status === 'user_confirmed').length;
    const totalMetrics = dbFigures.length;
    if (totalMetrics > 0 && confirmedMetrics < totalMetrics * 0.5) {
      issues.push({
        section: 'Workbook',
        type: 'no_data',
        description: `Only ${confirmedMetrics}/${totalMetrics} data points confirmed — ${totalMetrics - confirmedMetrics} still auto-extracted`,
      });
    }
  }

  return issues;
}

// ============================================================
// Partner Readiness Score
// ============================================================

function calculatePartnerReadiness(
  structure: StructureResult,
  mismatches: DataMismatch[],
  gaps: ComplianceGap[],
  qualityIssues: QualityIssue[],
  completeness: any
): number {
  let score = 100;

  // Deductions for structure
  const placeholderRatio = structure.sections.filter(s => s.status === 'placeholder').length / Math.max(structure.sections.length, 1);
  const emptyRatio = structure.sections.filter(s => s.status === 'empty').length / Math.max(structure.sections.length, 1);
  score -= placeholderRatio * 30;
  score -= emptyRatio * 40;

  // Deductions for data mismatches
  score -= mismatches.filter(m => m.severity === 'critical').length * 10;
  score -= mismatches.filter(m => m.severity === 'warning').length * 3;

  // Deductions for compliance gaps
  score -= gaps.length * 5;

  // Deductions for quality issues
  score -= qualityIssues.length * 3;

  // Bonus for data completeness
  if (completeness?.overall?.percentage) {
    score += (completeness.overall.percentage / 100) * 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================================
// Critical Actions
// ============================================================

function determineCriticalActions(
  mismatches: DataMismatch[],
  gaps: ComplianceGap[],
  qualityIssues: QualityIssue[],
  deadlineDays: number | null,
  docType: string
): string[] {
  const actions: string[] = [];

  // Critical mismatches first
  const criticalMismatches = mismatches.filter(m => m.severity === 'critical');
  if (criticalMismatches.length > 0) {
    actions.push(`Fix ${criticalMismatches.length} data mismatch${criticalMismatches.length > 1 ? 'es' : ''} — document figures don't match database`);
  }

  // Mandatory gaps
  if (gaps.length > 0) {
    actions.push(`Address ${gaps.length} mandatory disclosure gap${gaps.length > 1 ? 's' : ''} — required by selected frameworks`);
  }

  // Placeholder sections
  const placeholders = qualityIssues.filter(q => q.type === 'no_data');
  if (placeholders.length > 0) {
    actions.push(`Draft ${placeholders.length} placeholder section${placeholders.length > 1 ? 's' : ''}`);
  }

  // Deadline urgency
  if (deadlineDays !== null && deadlineDays < 7) {
    actions.push(`URGENT:Deadline in ${deadlineDays} day${deadlineDays !== 1 ? 's' : ''} — prioritise critical items`);
  }

  // Doc-type specific
  if (docType === 'excel') {
    actions.push('Confirm auto-extracted data points before using in report');
  }
  if (docType === 'powerpoint') {
    actions.push('Refresh charts with latest engagement data');
  }

  return actions.slice(0, 6);
}

// ============================================================
// Natural Language Briefing
// ============================================================

async function generateBriefing(
  perception: DocumentPerception,
  docType: string,
  engagement: any
): Promise<string> {
  // Build a deterministic briefing first (no Claude needed for the basics)
  const parts: string[] = [];
  const { structure, dataAlignment, complianceStatus, urgency } = perception;

  // Status line
  const engName = engagement?.name || 'this engagement';
  if (urgency.deadlineDays !== null) {
    parts.push(`**${engName}** — ${urgency.deadlineDays} days to deadline | Partner readiness: ${urgency.partnerReadiness}/100`);
  } else {
    parts.push(`**${engName}** — Partner readiness: ${urgency.partnerReadiness}/100`);
  }

  // Structure summary
  if (docType === 'word') {
    parts.push(`Document has ${structure.totalSections} sections: ${structure.draftedSections} drafted, ${structure.placeholderSections} placeholder, ${structure.emptySections} empty.`);
  } else if (docType === 'excel') {
    parts.push(`Workbook has ${structure.totalSections} sheet${structure.totalSections !== 1 ? 's' : ''} with ${dataAlignment.figuresInDocument.length} data points detected.`);
  } else if (docType === 'powerpoint') {
    parts.push(`Presentation has ${structure.totalSections} slide${structure.totalSections !== 1 ? 's' : ''}.`);
  }

  // Data alignment
  if (dataAlignment.mismatches.length > 0) {
    const critical = dataAlignment.mismatches.filter(m => m.severity === 'critical').length;
    parts.push(`URGENT:${dataAlignment.mismatches.length} figure mismatch${dataAlignment.mismatches.length !== 1 ? 'es' : ''} found${critical > 0 ? ` (${critical} critical)` : ''} — document values don't match latest data.`);
  }

  if (dataAlignment.missingFromDocument.length > 0) {
    parts.push(`${dataAlignment.missingFromDocument.length} confirmed data point${dataAlignment.missingFromDocument.length !== 1 ? 's' : ''} not yet included in the document.`);
  }

  // Compliance
  if (complianceStatus.mandatoryGaps.length > 0) {
    const frameworks = [...new Set(complianceStatus.mandatoryGaps.map(g => g.framework))];
    parts.push(`GAPS:${complianceStatus.mandatoryGaps.length} mandatory disclosure gap${complianceStatus.mandatoryGaps.length !== 1 ? 's' : ''} across ${frameworks.join(', ')}.`);
  }

  // Actions
  if (urgency.criticalActions.length > 0) {
    parts.push('\n**Suggested actions:** ' + urgency.criticalActions.map(a => `\n• ${a}`).join(''));
  }

  return parts.join('\n\n');
}

// ============================================================
// Helpers
// ============================================================

interface FrameworkInfo {
  code: string;
  name: string;
  type: string;
  topics: { code: string; name: string; disclosures: { code: string; name: string; dataType: string }[] }[];
}

async function getEngagementFrameworks(engagementId: string): Promise<FrameworkInfo[]> {
  try {
    const db = mongoose.connection.db;
    if (!db) return [];
    const engagement = await db.collection('engagements').findOne({
      _id: new mongoose.Types.ObjectId(engagementId),
    });
    if (!engagement?.frameworks?.length) return [];

    const frameworks = await Framework.find({
      code: { $in: engagement.frameworks },
    }).lean();

    return frameworks.map((fw: any) => ({
      code: fw.code,
      name: fw.name,
      type: fw.type,
      topics: (fw.structure?.topics || []).map((t: any) => ({
        code: t.code,
        name: t.name,
        disclosures: (t.disclosures || []).map((d: any) => ({
          code: d.code,
          name: d.name,
          dataType: d.dataType,
        })),
      })),
    }));
  } catch {
    return [];
  }
}

async function getEngagementInfo(engagementId: string): Promise<any> {
  try {
    const db = mongoose.connection.db;
    if (!db) return null;
    return await db.collection('engagements').findOne({
      _id: new mongoose.Types.ObjectId(engagementId),
    });
  } catch {
    return null;
  }
}

// ============================================================
// Integration Layer: Full Perception
// ============================================================

export interface FullPerceptionResult {
  perception: DocumentPerception;
  quickJudgments: Array<{ section: string; score: number; verdict: string }>;
  catchMeUp: { summary: string; daysSinceLastSession: number } | null;
  teamContext: TeamContext | null;
  rolePromptAddition: string;
  adaptivePromptAddition: string;
}

/**
 * Unified "document open" endpoint — runs all capabilities in parallel
 * and returns a single enriched response for the sidebar.
 */
export async function fullPerception(
  engagementId: string,
  userId: string,
  documentBody: string,
  documentType: 'word' | 'excel' | 'powerpoint' | 'outlook'
): Promise<FullPerceptionResult> {
  // Get user info for role-aware additions
  let userRole = 'analyst';
  let orgId: string | undefined;
  try {
    const user = await UserModel.findById(userId).lean() as any;
    if (user) {
      userRole = user.role;
      orgId = user.orgId?.toString();
    }
  } catch {
    // Non-critical
  }

  // Run all capabilities in parallel
  const [perception, catchMeUpResult, teamContext, emotionalContext] = await Promise.all([
    // 1. Document perception (existing)
    perceiveDocument(engagementId, documentBody, documentType),
    // 3. Memory context — catch me up if user was away
    catchMeUp(engagementId, userId).catch(() => null),
    // 4. Team context — who's active, bottlenecks
    getTeamContext(engagementId).catch(() => null),
    // 5. Emotional context for adaptive prompt
    detectEmotionalContext(userId, engagementId).catch(() => ({
      stress: 0,
      confusion: 0,
      confidence: 0.5,
      deadlinePressure: 0,
    })),
  ]);

  // 2. Quick quality judgment on drafted sections (fire in parallel)
  const draftedSections = perception.structure.sections.filter(
    s => s.status === 'drafted' && s.wordCount > 20
  );

  const judgmentPromises = draftedSections.slice(0, 5).map(async (section) => {
    try {
      const judgment = await judgeSection({
        engagementId,
        sectionContent: extractSectionText(documentBody, section.heading),
        sectionTitle: section.heading,
        frameworkRef: section.frameworkRef || undefined,
        judgmentLevel: 'quick',
      });
      return { section: section.heading, score: judgment.score, verdict: judgment.verdict };
    } catch {
      return { section: section.heading, score: 0, verdict: 'error' };
    }
  });

  const quickJudgments = await Promise.all(judgmentPromises);

  // 5. Role-aware prompt addition
  const rolePromptAddition = getRoleAwareSystemPromptAddition(userRole);

  // 6. Adaptive prompt addition (style + EQ)
  const adaptivePromptAddition = await getAdaptivePromptAddition(
    userId,
    orgId,
    undefined,
    emotionalContext
  ).catch(() => '');

  return {
    perception,
    quickJudgments,
    catchMeUp: catchMeUpResult
      ? { summary: catchMeUpResult.summary, daysSinceLastSession: catchMeUpResult.daysSinceLastSession }
      : null,
    teamContext,
    rolePromptAddition,
    adaptivePromptAddition,
  };
}

/**
 * Extracts rough section text from the document body given a heading.
 */
function extractSectionText(body: string, heading: string): string {
  const lines = body.split('\n');
  let capturing = false;
  let captured = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes(heading)) {
      capturing = true;
      continue;
    }
    if (capturing) {
      // Stop at next heading-like line
      if (/^#{1,6}\s|^\d+(\.\d+)*\s/.test(trimmed) && trimmed.length > 3) {
        break;
      }
      captured += trimmed + '\n';
    }
  }

  return captured.trim() || heading;
}
