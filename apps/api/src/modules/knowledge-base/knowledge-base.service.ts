import fs from 'fs/promises';
import crypto from 'crypto';
import { logger } from '../../lib/logger.js';
import { sendMessage } from '../../lib/claude.js';
import { parsePDF } from '../ingestion/ingestion.parsers.js';
import {
  KnowledgeReportModel,
  type IKnowledgeReport,
  type IExtractedMetric,
  type IExtractedNarrative,
  type IReportQuality,
} from '../../models/knowledge-report.model.js';
import { CorporateDisclosureModel } from '../../models/knowledge-base.model.js';
import { EmbeddingModel } from '../../models/embedding.model.js';
import { TFIDFEngine } from './tfidf-engine.js';
import { invalidateSearchCache } from './search.service.js';
import mongoose from 'mongoose';

// ============================================================
// Constants
// ============================================================

const MAX_TEXT_LENGTH = 100_000;

const REPORT_EXTRACTION_SYSTEM_PROMPT = `You are an expert ESG analyst extracting structured data from a sustainability report.

Extract ALL of the following:

1. METRICS: Every quantitative ESG data point. For each:
   - name, value, unit, framework reference (GRI/ESRS/SASB code), page reference
   - year-over-year change if mentioned
   - surrounding context (the sentence containing the metric)
   - confidence score (0.0 to 1.0) indicating extraction reliability

2. NARRATIVES: Every disclosure section. For each:
   - framework reference, title, full content text
   - quality score (0-100) based on: completeness, specificity, data backing, methodology reference
   - flags: hasQuantitativeData, hasYoYComparison, hasMethodology, hasPeerContext
   - word count of the content
   - page reference

3. QUALITY: Overall report quality:
   - frameworks used (array of framework names)
   - assurance level: "none", "limited", or "reasonable"
   - overall score (0-100)
   - framework coverage % (percentage of framework requirements addressed)
   - data completeness % (percentage of metrics with actual values vs targets/blanks)
   - narrative quality (average quality score of narrative sections)

Return as JSON with this exact structure:
{
  "metrics": [{ "name": "string", "value": "number or string", "unit": "string", "frameworkRef": "string", "yearOverYear": null, "context": "string", "pageRef": 0, "confidence": 0.8 }],
  "narratives": [{ "frameworkRef": "string", "title": "string", "content": "string", "qualityScore": 0, "wordCount": 0, "hasQuantitativeData": false, "hasYoYComparison": false, "hasMethodology": false, "hasPeerContext": false, "pageRef": 0 }],
  "quality": { "overallScore": 0, "frameworkCoverage": 0, "dataCompleteness": 0, "narrativeQuality": 0, "assuranceLevel": "none", "frameworks": [] }
}

Return ONLY valid JSON. Do not include markdown formatting, code fences, or any text outside the JSON object.`;

// ============================================================
// Types
// ============================================================

export interface IngestMetadata {
  company: string;
  reportYear: number;
  sector: string;
  country: string;
  disclosureId?: string;
}

export interface IngestResult {
  reportId: string;
  metricsCount: number;
  narrativesCount: number;
  quality: IReportQuality;
  processingTime: number;
}

interface ClaudeExtractionResult {
  metrics: IExtractedMetric[];
  narratives: IExtractedNarrative[];
  quality: IReportQuality;
}

// ============================================================
// Core Ingestion Pipeline
// ============================================================

export async function ingestReport(
  pdfBuffer: Buffer,
  metadata: IngestMetadata
): Promise<IngestResult> {
  const startTime = Date.now();

  // Step 1: Parse PDF
  logger.info(`Parsing PDF for ${metadata.company} (${metadata.reportYear})`);
  const parsed = await parsePDF(pdfBuffer);

  if (!parsed.text || parsed.text.length < 50) {
    throw new Error('PDF contains insufficient extractable text. It may be a scanned document.');
  }

  // Step 2: Truncate text if needed
  const text = parsed.text.length > MAX_TEXT_LENGTH
    ? parsed.text.substring(0, MAX_TEXT_LENGTH) + '\n\n[Content truncated at 100K characters]'
    : parsed.text;

  // Step 3: Claude extraction
  logger.info(`Sending ${text.length} chars to Claude for extraction`);
  const extraction = await extractWithClaude(text, metadata);

  // Step 4: Calculate processing time
  const processingTime = Math.round((Date.now() - startTime) / 1000);

  // Step 5: Store in database
  const report = await KnowledgeReportModel.findOneAndUpdate(
    { company: metadata.company, reportYear: metadata.reportYear },
    {
      disclosureId: metadata.disclosureId
        ? new mongoose.Types.ObjectId(metadata.disclosureId)
        : undefined,
      company: metadata.company,
      reportYear: metadata.reportYear,
      sector: metadata.sector,
      country: metadata.country,
      metrics: extraction.metrics,
      narratives: extraction.narratives,
      quality: extraction.quality,
      fullText: parsed.text,
      vectorEmbeddingId: `vec_kb_${Date.now()}_stub`,
      extractedAt: new Date(),
      processingTime,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Step 6: Update K1 catalog entry if linked
  if (metadata.disclosureId) {
    await CorporateDisclosureModel.findByIdAndUpdate(metadata.disclosureId, {
      status: 'ingested',
      pdfDocumentId: report._id,
    });
    logger.info(`Updated K1 disclosure ${metadata.disclosureId} status to ingested`);
  }

  // Step 7: Auto-generate TF-IDF embedding (non-blocking — fires after response)
  const embeddingText = [
    metadata.company, String(metadata.reportYear), metadata.sector, metadata.country,
    ...extraction.metrics.map((m) => `${m.name} ${m.value} ${m.unit} ${m.frameworkRef}`),
    ...extraction.narratives.map((n) => `${n.title} ${n.content.substring(0, 500)}`),
    parsed.text.substring(0, 20_000),
  ].filter(Boolean).join(' ');

  generateKBEmbeddingAsync(report._id.toString(), embeddingText, 'kb_knowledge_reports', 'K1')
    .catch((err) => logger.error('Auto-embedding failed for report', err));

  logger.info(
    `Report ingested: ${metadata.company} ${metadata.reportYear} — ` +
      `${extraction.metrics.length} metrics, ${extraction.narratives.length} narratives, ` +
      `quality=${extraction.quality.overallScore}, ${processingTime}s`
  );

  return {
    reportId: report._id.toString(),
    metricsCount: extraction.metrics.length,
    narrativesCount: extraction.narratives.length,
    quality: extraction.quality,
    processingTime,
  };
}

// ============================================================
// Auto-Embedding Helper
// ============================================================

/**
 * Generates and persists a TF-IDF embedding for a single KB document
 * immediately after ingestion. Rebuilds IDF from all existing embeddings
 * + the new text so vectors stay consistent. Invalidates the search
 * cache so the next query picks up the new entry.
 */
async function generateKBEmbeddingAsync(
  sourceId: string,
  newText: string,
  sourceCollection: string,
  domain: 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6' | 'K7'
): Promise<void> {
  const textHash = crypto.createHash('sha256').update(newText).digest('hex').substring(0, 16);

  // Load all existing embedding texts to rebuild a global IDF
  const existing = await EmbeddingModel.find({}).select('text').lean();
  const allTexts = [...existing.map((e) => e.text), newText];

  const engine = new TFIDFEngine();
  engine.buildIDF(allTexts);

  const vector = engine.computeVector(newText);
  const terms = vector.terms.slice(0, 500);
  const weights = vector.weights.slice(0, 500);

  // Compute L2 magnitude
  let magnitude = 0;
  for (const w of weights) magnitude += w * w;
  magnitude = Math.sqrt(magnitude);

  // Build sparse map for tfidfVector field
  const tfidfVector: Record<string, number> = {};
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const weight = weights[i];
    if (term !== undefined && weight !== undefined) {
      tfidfVector[term] = weight;
    }
  }

  await EmbeddingModel.findOneAndUpdate(
    { sourceCollection, sourceId: new mongoose.Types.ObjectId(sourceId) },
    {
      sourceCollection,
      sourceId: new mongoose.Types.ObjectId(sourceId),
      domain,
      text: newText.substring(0, 50_000),
      textHash,
      tfidfVector,
      denseTerms: terms,
      denseWeights: weights,
      magnitude,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Invalidate in-memory search cache so next query loads fresh data
  invalidateSearchCache();
  logger.info(`KB embedding generated: ${sourceCollection}/${sourceId}`);
}

// ============================================================
// Ingest from local file path
// ============================================================

export async function ingestReportByPath(
  filePath: string,
  metadata: IngestMetadata
): Promise<IngestResult> {
  const buffer = await fs.readFile(filePath);
  return ingestReport(buffer, metadata);
}

// ============================================================
// Claude Extraction
// ============================================================

async function extractWithClaude(
  text: string,
  metadata: IngestMetadata
): Promise<ClaudeExtractionResult> {
  const userContent =
    `Company: ${metadata.company}\n` +
    `Report Year: ${metadata.reportYear}\n` +
    `Sector: ${metadata.sector}\n` +
    `Country: ${metadata.country}\n\n` +
    `--- REPORT TEXT ---\n${text}`;

  const response = await sendMessage({
    system: REPORT_EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
    maxTokens: 16384,
  });

  if (!response) {
    logger.warn('Claude returned no response for report extraction');
    return emptyExtraction();
  }

  try {
    const parsed = JSON.parse(response) as ClaudeExtractionResult;

    // Validate structure
    if (!parsed.metrics || !Array.isArray(parsed.metrics)) {
      parsed.metrics = [];
    }
    if (!parsed.narratives || !Array.isArray(parsed.narratives)) {
      parsed.narratives = [];
    }
    if (!parsed.quality) {
      parsed.quality = emptyQuality();
    }

    return parsed;
  } catch {
    logger.warn('Failed to parse Claude extraction response as JSON');
    return emptyExtraction();
  }
}

function emptyQuality(): IReportQuality {
  return {
    overallScore: 0,
    frameworkCoverage: 0,
    dataCompleteness: 0,
    narrativeQuality: 0,
    assuranceLevel: 'none',
    frameworks: [],
  };
}

function emptyExtraction(): ClaudeExtractionResult {
  return {
    metrics: [],
    narratives: [],
    quality: emptyQuality(),
  };
}

// ============================================================
// Query: List Reports
// ============================================================

export interface ReportListFilter {
  sector?: string;
  country?: string;
  minQuality?: number;
}

export async function listReports(filter: ReportListFilter) {
  const query: Record<string, unknown> = {};

  if (filter.sector) query.sector = filter.sector;
  if (filter.country) query.country = filter.country;
  if (filter.minQuality) {
    query['quality.overallScore'] = { $gte: filter.minQuality };
  }

  const reports = await KnowledgeReportModel.find(query)
    .select('-fullText -metrics.context -narratives.content')
    .sort({ 'quality.overallScore': -1 })
    .lean();

  return reports.map((r) => ({
    id: r._id.toString(),
    disclosureId: r.disclosureId?.toString(),
    company: r.company,
    reportYear: r.reportYear,
    sector: r.sector,
    country: r.country,
    metricsCount: r.metrics.length,
    narrativesCount: r.narratives.length,
    quality: r.quality,
    extractedAt: r.extractedAt,
    processingTime: r.processingTime,
  }));
}

// ============================================================
// Query: Get Report Detail
// ============================================================

export async function getReportById(reportId: string) {
  const report = await KnowledgeReportModel.findById(reportId).lean();
  if (!report) return null;

  return {
    id: report._id.toString(),
    disclosureId: report.disclosureId?.toString(),
    company: report.company,
    reportYear: report.reportYear,
    sector: report.sector,
    country: report.country,
    metrics: report.metrics,
    narratives: report.narratives,
    quality: report.quality,
    extractedAt: report.extractedAt,
    processingTime: report.processingTime,
  };
}

// ============================================================
// Query: Benchmark Data
// ============================================================

export interface BenchmarkFilter {
  sector?: string;
  country?: string;
}

export interface BenchmarkResult {
  metric: string;
  values: Array<{
    company: string;
    year: number;
    value: number | string;
    unit: string;
  }>;
  percentiles: {
    p25: number | null;
    p50: number | null;
    p75: number | null;
  };
  count: number;
}

export async function getBenchmarkData(
  metricName: string,
  filter: BenchmarkFilter
): Promise<BenchmarkResult> {
  const matchStage: Record<string, unknown> = {
    'metrics.name': { $regex: metricName, $options: 'i' },
  };

  if (filter.sector) matchStage.sector = filter.sector;
  if (filter.country) matchStage.country = filter.country;

  const reports = await KnowledgeReportModel.find(matchStage)
    .select('company reportYear metrics')
    .lean();

  const values: BenchmarkResult['values'] = [];
  const numericValues: number[] = [];

  for (const report of reports) {
    for (const metric of report.metrics) {
      if (metric.name.toLowerCase().includes(metricName.toLowerCase())) {
        values.push({
          company: report.company,
          year: report.reportYear,
          value: metric.value,
          unit: metric.unit,
        });

        const numVal = typeof metric.value === 'number'
          ? metric.value
          : parseFloat(String(metric.value));

        if (!isNaN(numVal)) {
          numericValues.push(numVal);
        }
      }
    }
  }

  // Calculate percentiles
  numericValues.sort((a, b) => a - b);
  const percentiles = {
    p25: percentile(numericValues, 25),
    p50: percentile(numericValues, 50),
    p75: percentile(numericValues, 75),
  };

  return {
    metric: metricName,
    values,
    percentiles,
    count: values.length,
  };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (idx - lower);
}

// ============================================================
// Query: Top Disclosures
// ============================================================

export async function getTopDisclosures(
  frameworkRef: string,
  sector?: string,
  minQuality?: number
) {
  const matchStage: Record<string, unknown> = {
    'narratives.frameworkRef': { $regex: frameworkRef, $options: 'i' },
  };

  if (sector) matchStage.sector = sector;
  if (minQuality) matchStage['narratives.qualityScore'] = { $gte: minQuality };

  const reports = await KnowledgeReportModel.find(matchStage)
    .select('company reportYear sector country narratives')
    .lean();

  const results: Array<{
    company: string;
    reportYear: number;
    sector: string;
    narrative: IExtractedNarrative;
  }> = [];

  for (const report of reports) {
    for (const narrative of report.narratives) {
      if (narrative.frameworkRef.toLowerCase().includes(frameworkRef.toLowerCase())) {
        if (!minQuality || narrative.qualityScore >= minQuality) {
          results.push({
            company: report.company,
            reportYear: report.reportYear,
            sector: report.sector,
            narrative,
          });
        }
      }
    }
  }

  // Sort by quality score descending
  results.sort((a, b) => b.narrative.qualityScore - a.narrative.qualityScore);

  return results.slice(0, 20);
}

// ============================================================
// Query: Similar Companies
// ============================================================

export async function getSimilarCompanies(
  sector: string,
  country?: string,
  limit = 10
) {
  const query: Record<string, unknown> = { sector };
  if (country) query.country = country;

  const reports = await KnowledgeReportModel.find(query)
    .select('company reportYear sector country quality')
    .sort({ 'quality.overallScore': -1 })
    .limit(limit)
    .lean();

  return reports.map((r) => ({
    id: r._id.toString(),
    company: r.company,
    reportYear: r.reportYear,
    sector: r.sector,
    country: r.country,
    quality: r.quality,
  }));
}
