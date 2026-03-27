import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../lib/logger.js';
import { uploadBlob } from '../../lib/storage.js';
import { sendMessage } from '../../lib/claude.js';
import { createQueue } from '../../lib/queue.js';
import { ESGDocumentModel, DataPointModel } from './ingestion.model.js';
import type { IESGDocument } from './ingestion.model.js';
import { parseFile, type ParsedContent } from './ingestion.parsers.js';
import { normalizeUnit, mapToFramework, assignConfidence } from './ingestion.normalizer.js';

// ============================================================
// Constants
// ============================================================

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const CONTAINER_NAME = 'documents';
const QUEUE_NAME = 'document-processing';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/tiff',
]);

// ============================================================
// Upload Service
// ============================================================

export interface UploadResult {
  document: IESGDocument;
  queued: boolean;
}

export async function uploadDocument(
  engagementId: string,
  orgId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<UploadResult> {
  // Validate mime type
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new UploadError(`Unsupported file type: ${mimeType}`, 400);
  }

  // Compute file hash for deduplication
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Determine format from mime
  const format = getFormatFromMime(mimeType, filename);

  // Store the file
  const blobName = `${orgId}/${engagementId}/${hash}_${filename}`;
  let blobUrl: string | null = null;
  let localPath: string | null = null;

  // Try Azure Blob first, fall back to local
  blobUrl = await uploadBlob(CONTAINER_NAME, blobName, buffer);

  if (!blobUrl) {
    // Local fallback for dev
    localPath = await storeLocally(blobName, buffer);
  }

  // Create document record
  const doc = await ESGDocumentModel.create({
    engagementId,
    orgId,
    filename,
    format,
    size: buffer.length,
    hash,
    uploadSource: 'manual',
    status: 'queued',
    extractedData: [],
    blobUrl,
    localPath,
    uploadedAt: new Date(),
  });

  // Enqueue processing job
  let queued = false;
  const queue = createQueue(QUEUE_NAME);
  if (queue) {
    await queue.add('process-document', {
      documentId: doc._id.toString(),
    });
    queued = true;
  }

  return { document: doc, queued };
}

// ============================================================
// Document Queries
// ============================================================

export async function getDocumentsByEngagement(engagementId: string) {
  const docs = await ESGDocumentModel.find({ engagementId }).sort({ uploadedAt: -1 }).lean();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    engagementId: doc.engagementId.toString(),
    orgId: doc.orgId.toString(),
    filename: doc.filename,
    format: doc.format,
    size: doc.size,
    status: doc.status,
    uploadedAt: doc.uploadedAt,
    processedAt: doc.processedAt,
    extractedDataCount: doc.extractedData.length,
  }));
}

export async function getDocumentById(documentId: string) {
  const doc = await ESGDocumentModel.findById(documentId).lean();
  if (!doc) return null;

  const dataPoints = await DataPointModel.find({ documentId: doc._id }).lean();

  return {
    id: doc._id.toString(),
    engagementId: doc.engagementId.toString(),
    orgId: doc.orgId.toString(),
    filename: doc.filename,
    format: doc.format,
    size: doc.size,
    hash: doc.hash,
    uploadSource: doc.uploadSource,
    status: doc.status,
    extractedData: doc.extractedData,
    extractedText: doc.extractedText,
    vectorEmbeddingId: doc.vectorEmbeddingId,
    errorMessage: doc.errorMessage,
    uploadedAt: doc.uploadedAt,
    processedAt: doc.processedAt,
    dataPoints: dataPoints.map((dp) => ({
      id: dp._id.toString(),
      frameworkRef: dp.frameworkRef,
      metricName: dp.metricName,
      value: dp.value,
      unit: dp.unit,
      confidence: dp.confidence,
      status: dp.status,
      extractionMethod: dp.extractionMethod,
      sourcePage: dp.sourcePage,
      sourceCell: dp.sourceCell,
      auditTrail: dp.auditTrail,
    })),
  };
}

// ============================================================
// Processing Pipeline
// ============================================================

export interface ExtractedPoint {
  metric_name: string;
  value: number | string;
  unit: string;
  framework_ref?: string;
  source_location?: string;
  confidence: number;
  context?: string;
  page?: number;
  cell?: string;
}

export async function processDocument(documentId: string): Promise<void> {
  const doc = await ESGDocumentModel.findById(documentId);
  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  try {
    // Update status to processing
    doc.status = 'processing';
    await doc.save();

    // Step 1: Parse
    const fileBuffer = await getFileBuffer(doc);
    const parsed = await parseFile(fileBuffer, doc.format, doc.filename);

    // Store extracted text
    doc.extractedText = parsed.text;

    // Step 2: Extract ESG data via Claude
    const extractedPoints = await extractESGData(parsed, doc.filename);

    // Step 3: Normalize
    const normalizedPoints = extractedPoints.map((point) => {
      const normalized = normalizeUnit(
        typeof point.value === 'number' ? point.value : parseFloat(String(point.value)) || 0,
        point.unit
      );
      const frameworkRef = point.framework_ref || mapToFramework(point.metric_name);
      const confidence = assignConfidence(point.confidence);

      return {
        ...point,
        value: typeof point.value === 'string' && isNaN(parseFloat(point.value))
          ? point.value
          : normalized.value,
        unit: normalized.unit,
        framework_ref: frameworkRef,
        confidenceLevel: confidence,
        originalConfidence: point.confidence,
      };
    });

    // Step 4: Store data points
    const currentYear = new Date().getFullYear();

    for (const point of normalizedPoints) {
      await DataPointModel.create({
        engagementId: doc.engagementId,
        documentId: doc._id,
        frameworkRef: point.framework_ref,
        metricName: point.metric_name,
        value: point.value,
        unit: point.unit,
        period: { year: currentYear },
        sourceDocumentId: doc._id,
        sourcePage: point.page,
        sourceCell: point.cell,
        confidence: point.confidenceLevel,
        status: 'auto_extracted',
        extractionMethod: 'llm_extract',
        auditTrail: [
          {
            action: 'created',
            timestamp: new Date(),
            notes: `Auto-extracted via LLM from ${doc.filename}`,
            newValue: point.value,
          },
        ],
      });
    }

    // Update document extracted data summary
    doc.extractedData = normalizedPoints.map((p) => ({
      metric: p.metric_name,
      value: p.value,
      unit: p.unit,
      confidence: p.originalConfidence,
      pageRef: p.page,
      cellRef: p.cell,
    }));

    // Step 5: Vector index stub
    doc.vectorEmbeddingId = `vec_${doc._id.toString()}_stub`;

    // Mark as ingested
    doc.status = 'ingested';
    doc.processedAt = new Date();
    await doc.save();

    logger.info(`Document ${documentId} processed successfully, ${normalizedPoints.length} data points extracted`);
  } catch (error) {
    doc.status = 'failed';
    doc.errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    await doc.save();
    logger.error(`Document ${documentId} processing failed`, error);
    throw error;
  }
}

// ============================================================
// Claude Extraction
// ============================================================

const ESG_EXTRACTION_SYSTEM_PROMPT = `You are an ESG data extraction specialist. Your task is to extract ALL ESG-relevant data points from the provided document content.

For each data point found, return a JSON object with:
- metric_name: The name of the ESG metric (e.g., "GHG Emissions Scope 1", "Water Consumption", "Employee Count")
- value: The numerical or text value
- unit: The unit of measurement (e.g., "tCO2e", "m³", "kWh", "employees")
- framework_ref: If identifiable, the framework disclosure code (e.g., "GRI 305-1", "SASB-IF-EU-320a.1")
- source_location: Description of where in the document this was found
- confidence: A score from 0.0 to 1.0 indicating your confidence in the extraction
- context: Brief context about the data point

Return ONLY a JSON array of these objects. If no ESG data points are found, return an empty array [].
Do not include markdown formatting or code fences. Return raw JSON only.`;

export async function extractESGData(
  parsed: ParsedContent,
  filename: string
): Promise<ExtractedPoint[]> {
  // If no text content, return empty
  if (!parsed.text && parsed.tables.length === 0) {
    return [];
  }

  // Build content for Claude
  let content = `Document: ${filename}\n\n`;

  if (parsed.text) {
    // Truncate very long texts to fit context window
    const maxChars = 100000;
    content += parsed.text.length > maxChars
      ? parsed.text.substring(0, maxChars) + '\n\n[Content truncated]'
      : parsed.text;
  }

  if (parsed.tables.length > 0) {
    content += '\n\n--- TABULAR DATA ---\n';
    for (const table of parsed.tables) {
      if (table.sheetName) {
        content += `\nSheet: ${table.sheetName}\n`;
      }
      content += table.headers.join(' | ') + '\n';
      for (const row of table.rows.slice(0, 500)) {
        content += row.join(' | ') + '\n';
      }
    }
  }

  const response = await sendMessage({
    system: ESG_EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
    maxTokens: 8192,
  });

  if (!response) {
    logger.warn(`Claude returned no response for ${filename}`);
    return [];
  }

  try {
    const extracted = JSON.parse(response) as ExtractedPoint[];
    if (!Array.isArray(extracted)) {
      logger.warn(`Claude returned non-array response for ${filename}`);
      return [];
    }
    return extracted;
  } catch {
    logger.warn(`Failed to parse Claude response as JSON for ${filename}`);
    return [];
  }
}

// ============================================================
// Helpers
// ============================================================

async function getFileBuffer(doc: IESGDocument): Promise<Buffer> {
  if (doc.localPath) {
    return fs.readFile(doc.localPath);
  }

  // If blob URL exists, would download from Azure
  // For now, throw if no local file available
  throw new Error(`Cannot retrieve file for document ${doc._id}: no local path or blob access`);
}

async function storeLocally(blobName: string, buffer: Buffer): Promise<string> {
  const filePath = path.join(UPLOADS_DIR, blobName);
  const dir = path.dirname(filePath);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, buffer);

  logger.info(`Stored file locally: ${filePath}`);
  return filePath;
}

function getFormatFromMime(mimeType: string, filename: string): string {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/csv': 'csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/tiff': 'tiff',
  };

  return mimeMap[mimeType] || filename.split('.').pop()?.toLowerCase() || 'unknown';
}

export class UploadError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'UploadError';
  }
}
