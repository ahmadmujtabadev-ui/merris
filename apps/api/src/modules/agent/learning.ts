/**
 * Merris Learning & Adaptation Engine (Capability 6)
 *
 * Learns from user edits, acceptances, and rejections to adapt the agent's
 * writing style, terminology, and tone. Detects emotional context to modulate
 * response conciseness and supportiveness.
 */

import {
  captureStyle,
  getStylePreferences,
  type CaptureStyleInput,
} from './memory.js';
import { ConversationMemoryModel } from '../../models/memory.model.js';
import { StyleMemoryModel } from '../../models/memory.model.js';
import mongoose from 'mongoose';
import { logger } from '../../lib/logger.js';

// ============================================================
// Types
// ============================================================

export interface EditSignalResult {
  patternsDetected: string[];
  stylesLearned: string[];
}

export interface EmotionalContext {
  stress: number;
  confusion: number;
  confidence: number;
  deadlinePressure: number;
}

// ============================================================
// 1. Process Edit Signal — learn from user edits
// ============================================================

export async function processEditSignal(
  engagementId: string,
  userId: string,
  originalDraft: string,
  editedVersion: string
): Promise<EditSignalResult> {
  const patternsDetected: string[] = [];
  const stylesLearned: string[] = [];

  // Length analysis
  const originalWords = originalDraft.split(/\s+/).filter(Boolean).length;
  const editedWords = editedVersion.split(/\s+/).filter(Boolean).length;
  const lengthRatio = editedWords / Math.max(originalWords, 1);

  if (lengthRatio < 0.7) {
    patternsDetected.push('shortened');
    const style: CaptureStyleInput = {
      userId,
      category: 'writing',
      preference: 'Prefers concise prose — user consistently shortens AI-generated drafts',
      evidence: `Shortened from ${originalWords} to ${editedWords} words (${Math.round(lengthRatio * 100)}%)`,
    };
    await captureStyle(style).catch(() => {});
    stylesLearned.push('concise_prose');
  } else if (lengthRatio > 1.3) {
    patternsDetected.push('lengthened');
    const style: CaptureStyleInput = {
      userId,
      category: 'writing',
      preference: 'Prefers detailed, expansive prose — user consistently adds content to AI drafts',
      evidence: `Expanded from ${originalWords} to ${editedWords} words (${Math.round(lengthRatio * 100)}%)`,
    };
    await captureStyle(style).catch(() => {});
    stylesLearned.push('detailed_prose');
  }

  // Detect terminology changes
  const terminologyPatterns = detectTerminologyChanges(originalDraft, editedVersion);
  for (const term of terminologyPatterns) {
    patternsDetected.push(`terminology: ${term.from} -> ${term.to}`);
    const style: CaptureStyleInput = {
      userId,
      category: 'terminology',
      preference: `Use "${term.to}" instead of "${term.from}"`,
      evidence: `User replaced "${term.from}" with "${term.to}" in edit`,
    };
    await captureStyle(style).catch(() => {});
    stylesLearned.push(`term_${term.to}`);
  }

  // Detect spelling convention (British vs American English)
  const spellingConvention = detectSpellingConvention(editedVersion);
  if (spellingConvention) {
    patternsDetected.push(`spelling: ${spellingConvention}`);
    const style: CaptureStyleInput = {
      userId,
      category: 'writing',
      preference: `Use ${spellingConvention} English spelling`,
      evidence: `Detected ${spellingConvention} spelling patterns in user edit`,
    };
    await captureStyle(style).catch(() => {});
    stylesLearned.push(`spelling_${spellingConvention}`);
  }

  // Detect structural changes
  const structuralPatterns = detectStructuralChanges(originalDraft, editedVersion);
  for (const pattern of structuralPatterns) {
    patternsDetected.push(`structure: ${pattern}`);
    const style: CaptureStyleInput = {
      userId,
      category: 'formatting',
      preference: pattern,
      evidence: 'Detected in user edit comparison',
    };
    await captureStyle(style).catch(() => {});
    stylesLearned.push(`struct_${pattern}`);
  }

  // Detect YoY comparison additions
  if (!/year.over.year|yoy|compared to.*previous|vs\.?\s*20\d{2}/i.test(originalDraft) &&
      /year.over.year|yoy|compared to.*previous|vs\.?\s*20\d{2}/i.test(editedVersion)) {
    patternsDetected.push('added_yoy_comparison');
    const style: CaptureStyleInput = {
      userId,
      category: 'framing',
      preference: 'Always include year-on-year comparison in disclosures',
      evidence: 'User added YoY comparison that was missing from AI draft',
    };
    await captureStyle(style).catch(() => {});
    stylesLearned.push('yoy_comparison');
  }

  // Detect tone changes
  const toneShift = detectToneShift(originalDraft, editedVersion);
  if (toneShift) {
    patternsDetected.push(`tone: ${toneShift}`);
    const style: CaptureStyleInput = {
      userId,
      category: 'tone',
      preference: toneShift,
      evidence: 'Detected in user edit comparison',
    };
    await captureStyle(style).catch(() => {});
    stylesLearned.push(`tone_${toneShift}`);
  }

  return { patternsDetected, stylesLearned };
}

// ============================================================
// 2. Accept Signal — reinforce preferences
// ============================================================

export async function processAcceptSignal(
  engagementId: string,
  userId: string
): Promise<void> {
  try {
    // Increase confidence on all user style preferences
    await StyleMemoryModel.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        confidence: { $lt: 1 },
      },
      {
        $inc: { confidence: 0.03 },
        $set: { lastUpdated: new Date() },
      }
    );

    // Cap confidence at 1.0
    await StyleMemoryModel.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        confidence: { $gt: 1 },
      },
      { $set: { confidence: 1 } }
    );
  } catch (err) {
    logger.error('Failed to process accept signal', err);
  }
}

// ============================================================
// 3. Reject Signal — decrease confidence
// ============================================================

export async function processRejectSignal(
  engagementId: string,
  userId: string,
  reason?: string
): Promise<void> {
  try {
    // Decrease confidence on recent style preferences
    await StyleMemoryModel.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        confidence: { $gt: 0 },
      },
      {
        $inc: { confidence: -0.1 },
        $set: { lastUpdated: new Date() },
      }
    );

    // Floor confidence at 0
    await StyleMemoryModel.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        confidence: { $lt: 0 },
      },
      { $set: { confidence: 0 } }
    );

    // If a reason is provided, capture it as negative evidence
    if (reason) {
      await captureStyle({
        userId,
        category: 'tone',
        preference: `User rejected output: ${reason}`,
        evidence: `Rejection reason: ${reason}`,
        confidence: 0.3,
      }).catch(() => {});
    }
  } catch (err) {
    logger.error('Failed to process reject signal', err);
  }
}

// ============================================================
// 4. Emotional Context Detection
// ============================================================

export async function detectEmotionalContext(
  userId: string,
  engagementId: string
): Promise<EmotionalContext> {
  const now = Date.now();
  const context: EmotionalContext = {
    stress: 0,
    confusion: 0,
    confidence: 0.5,
    deadlinePressure: 0,
  };

  try {
    // Get recent interactions (last 2 hours)
    const recentInteractions = await ConversationMemoryModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      engagementId: new mongoose.Types.ObjectId(engagementId),
      timestamp: { $gt: new Date(now - 2 * 60 * 60 * 1000) },
    }).sort({ timestamp: -1 }).limit(20).lean() as any;

    if (recentInteractions.length === 0) return context;

    // Rapid messages signal (stress indicator)
    if (recentInteractions.length >= 5) {
      const timestamps = recentInteractions.map((i: any) => new Date(i.timestamp).getTime());
      const intervals: number[] = [];
      for (let idx = 0; idx < timestamps.length - 1; idx++) {
        intervals.push(timestamps[idx]! - timestamps[idx + 1]!);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      // If average interval is less than 2 minutes, elevated stress
      if (avgInterval < 120000) context.stress = Math.min(1, 0.3 + (120000 - avgInterval) / 120000 * 0.7);
    }

    // Short query detection (stress or impatience)
    const avgMessageLength = recentInteractions
      .map((i: any) => (i.userMessage || '').split(/\s+/).length)
      .reduce((a: number, b: number) => a + b, 0) / recentInteractions.length;
    if (avgMessageLength < 10) context.stress = Math.min(1, context.stress + 0.2);

    // Confusion signals: repeated similar questions, questions with "?" marks, "I don't understand"
    const confusionKeywords = /don't understand|confused|what do you mean|unclear|help me|lost|stuck/i;
    const confusionCount = recentInteractions.filter(
      (i: any) => confusionKeywords.test(i.userMessage || '')
    ).length;
    context.confusion = Math.min(1, confusionCount / Math.max(recentInteractions.length, 1));

    // Late hours detection (stress indicator)
    const latestTimestamp = new Date(recentInteractions[0]!.timestamp);
    const hour = latestTimestamp.getHours();
    if (hour >= 22 || hour < 6) {
      context.stress = Math.min(1, context.stress + 0.2);
      context.deadlinePressure = Math.min(1, context.deadlinePressure + 0.3);
    }

    // Deadline pressure
    const db = mongoose.connection.db;
    if (db) {
      const engagement = await db.collection('engagements').findOne({
        _id: new mongoose.Types.ObjectId(engagementId),
      });
      if (engagement?.deadline) {
        const daysToDeadline = (new Date(engagement.deadline).getTime() - now) / (1000 * 60 * 60 * 24);
        if (daysToDeadline < 3) context.deadlinePressure = 1;
        else if (daysToDeadline < 7) context.deadlinePressure = 0.7;
        else if (daysToDeadline < 14) context.deadlinePressure = 0.3;
      }
    }

    // Confidence: inverse of confusion and stress
    context.confidence = Math.max(0, 1 - (context.confusion * 0.5 + context.stress * 0.3));

  } catch (err) {
    logger.error('Failed to detect emotional context', err);
  }

  return context;
}

// ============================================================
// 5. Adaptive Prompt Addition
// ============================================================

export async function getAdaptivePromptAddition(
  userId: string,
  orgId?: string,
  clientOrgId?: string,
  emotionalContext?: EmotionalContext
): Promise<string> {
  const parts: string[] = [];

  // Fetch style preferences
  const styles = await getStylePreferences(userId, orgId, clientOrgId);

  // Only include high-confidence preferences
  const highConfidence = styles.filter(s => s.confidence >= 0.6);

  if (highConfidence.length > 0) {
    parts.push('USER STYLE PREFERENCES (learned from past interactions):');
    for (const s of highConfidence.slice(0, 10)) {
      const scope = s.userId ? 'Personal' : s.orgId ? 'Firm-wide' : 'Client-specific';
      parts.push(`- [${scope}] ${s.preference} (confidence: ${s.confidence.toFixed(2)})`);
    }
  }

  // Emotional context modifiers
  if (emotionalContext) {
    const modifiers: string[] = [];

    if (emotionalContext.stress > 0.6) {
      modifiers.push('User stress level elevated — be more concise and action-oriented. Lead with the answer, not the reasoning.');
    } else if (emotionalContext.stress > 0.3) {
      modifiers.push('User may be under moderate pressure — keep responses focused and practical.');
    }

    if (emotionalContext.confusion > 0.5) {
      modifiers.push('User appears confused — use simpler language, provide step-by-step explanations, and ask clarifying questions.');
    }

    if (emotionalContext.deadlinePressure > 0.7) {
      modifiers.push('Deadline is imminent — prioritize speed over completeness. Focus only on critical blocking issues.');
    } else if (emotionalContext.deadlinePressure > 0.3) {
      modifiers.push('Deadline approaching — be efficient and flag only what matters most.');
    }

    if (emotionalContext.confidence < 0.3) {
      modifiers.push('User confidence is low — be supportive, acknowledge progress, and break tasks into smaller steps.');
    }

    if (modifiers.length > 0) {
      parts.push('\nEMOTIONAL CONTEXT ADJUSTMENTS:');
      for (const mod of modifiers) {
        parts.push(`- ${mod}`);
      }
    }
  }

  return parts.join('\n');
}

// ============================================================
// Pattern Detection Helpers
// ============================================================

interface TerminologyChange {
  from: string;
  to: string;
}

function detectTerminologyChanges(original: string, edited: string): TerminologyChange[] {
  const changes: TerminologyChange[] = [];

  // Common ESG terminology pairs
  const termPairs: [RegExp, string][] = [
    [/carbon emissions/gi, 'GHG emissions'],
    [/GHG emissions/gi, 'carbon emissions'],
    [/employees/gi, 'workforce'],
    [/workforce/gi, 'employees'],
    [/sustainability/gi, 'ESG'],
    [/ESG/gi, 'sustainability'],
    [/tons/gi, 'tonnes'],
    [/tonnes/gi, 'tons'],
    [/materiality/gi, 'double materiality'],
    [/significant/gi, 'material'],
    [/material/gi, 'significant'],
  ];

  for (const [pattern, replacement] of termPairs) {
    const originalMatches = original.match(pattern);
    const editedMatches = edited.match(pattern);
    const replacementRegex = new RegExp(replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const editedReplacementMatches = edited.match(replacementRegex);

    // If original had the term, edited doesn't, but edited has the replacement
    if (originalMatches && !editedMatches && editedReplacementMatches) {
      changes.push({
        from: originalMatches[0]!,
        to: editedReplacementMatches[0]!,
      });
    }
  }

  return changes.slice(0, 5);
}

function detectSpellingConvention(text: string): 'British' | 'American' | null {
  const britishPatterns = /\b(colour|favour|honour|organisation|specialise|analyse|centre|fibre|metre|licence)\b/gi;
  const americanPatterns = /\b(color|favor|honor|organization|specialize|analyze|center|fiber|meter|license)\b/gi;

  const britishMatches = (text.match(britishPatterns) || []).length;
  const americanMatches = (text.match(americanPatterns) || []).length;

  if (britishMatches > 0 && britishMatches > americanMatches) return 'British';
  if (americanMatches > 0 && americanMatches > britishMatches) return 'American';
  return null;
}

function detectStructuralChanges(original: string, edited: string): string[] {
  const patterns: string[] = [];

  // Bullet points added
  const originalBullets = (original.match(/^[\s]*[-•*]\s/gm) || []).length;
  const editedBullets = (edited.match(/^[\s]*[-•*]\s/gm) || []).length;
  if (editedBullets > originalBullets + 2) {
    patterns.push('Prefers bullet-point formatting over prose');
  }

  // Headers/sections added
  const originalHeaders = (original.match(/^#{1,4}\s|^[A-Z][A-Z\s]{3,}$/gm) || []).length;
  const editedHeaders = (edited.match(/^#{1,4}\s|^[A-Z][A-Z\s]{3,}$/gm) || []).length;
  if (editedHeaders > originalHeaders + 1) {
    patterns.push('Prefers well-structured sections with clear headers');
  }

  // Numbers/data emphasis
  const originalNumbers = (original.match(/\d[\d,]*\.?\d*/g) || []).length;
  const editedNumbers = (edited.match(/\d[\d,]*\.?\d*/g) || []).length;
  if (editedNumbers > originalNumbers * 1.5 && editedNumbers > originalNumbers + 3) {
    patterns.push('Prefers data-dense content with more quantitative detail');
  }

  return patterns;
}

function detectToneShift(original: string, edited: string): string | null {
  // Formal vs informal
  const informalPatterns = /\b(can't|won't|don't|it's|we're|they're|isn't|aren't)\b/gi;
  const originalInformal = (original.match(informalPatterns) || []).length;
  const editedInformal = (edited.match(informalPatterns) || []).length;

  if (originalInformal > 0 && editedInformal === 0) {
    return 'Prefers formal tone — avoid contractions';
  }
  if (editedInformal > originalInformal + 2) {
    return 'Prefers conversational tone — contractions acceptable';
  }

  // Passive vs active voice (rough heuristic)
  const passivePatterns = /\b(was|were|been|being|is|are)\s+(being\s+)?\w+ed\b/gi;
  const originalPassive = (original.match(passivePatterns) || []).length;
  const editedPassive = (edited.match(passivePatterns) || []).length;

  if (originalPassive > editedPassive + 2) {
    return 'Prefers active voice over passive constructions';
  }

  return null;
}
