import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger.js';

// ============================================================
// File Parsing Types
// ============================================================

export interface ParsedContent {
  text: string;
  tables: Array<{
    sheetName?: string;
    headers: string[];
    rows: string[][];
  }>;
  pageCount?: number;
  isScanned: boolean;
  format: string;
}

// ============================================================
// PDF Parser
// ============================================================

export async function parsePDF(buffer: Buffer): Promise<ParsedContent> {
  const { PDFParse } = await import('pdf-parse');

  try {
    // pdfjs-dist v5+ requires Uint8Array, not Buffer
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const pdf = new PDFParse(uint8 as unknown as Buffer);
    const textResult = await pdf.getText();
    const text = textResult.pages.map((p) => p.text).join('\n').trim();
    const pageCount = textResult.pages.length;
    const isScanned = text.length < 50; // Sparse text indicates scanned document

    return {
      text,
      tables: [],
      pageCount,
      isScanned,
      format: 'pdf',
    };
  } catch (error) {
    logger.error('PDF parsing failed', error);
    throw new Error('Failed to parse PDF file');
  }
}

// ============================================================
// Scanned PDF — Claude document understanding fallback
// ============================================================

export async function parsePDFWithClaude(buffer: Buffer, pageCount?: number): Promise<ParsedContent> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    return { text: '', tables: [], isScanned: true, format: 'pdf', pageCount };
  }
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
            } as unknown as Anthropic.TextBlockParam,
            {
              type: 'text',
              text: 'Extract ALL text, numbers, table data, headings, and ESG metrics from this PDF. Return only the raw extracted content.',
            },
          ],
        },
      ],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    logger.info(`Claude PDF extraction: ${text.length} chars`);
    return { text, tables: [], isScanned: true, format: 'pdf', pageCount };
  } catch (error) {
    logger.error('Claude PDF document extraction failed', error);
    return { text: '', tables: [], isScanned: true, format: 'pdf', pageCount };
  }
}

// ============================================================
// Excel / CSV Parser
// ============================================================

export async function parseExcel(buffer: Buffer, format: 'xlsx' | 'csv'): Promise<ParsedContent> {
  const XLSX = await import('xlsx');

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const tables: ParsedContent['tables'] = [];
    const textParts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const jsonData: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
      }) as string[][];

      if (jsonData.length === 0) continue;

      const headers = (jsonData[0] || []).map(String);
      const rows = jsonData.slice(1).map((row) => row.map(String));

      tables.push({ sheetName, headers, rows });

      // Build text representation
      textParts.push(`Sheet: ${sheetName}`);
      textParts.push(headers.join('\t'));
      for (const row of rows) {
        textParts.push(row.join('\t'));
      }
    }

    return {
      text: textParts.join('\n'),
      tables,
      isScanned: false,
      format,
    };
  } catch (error) {
    logger.error('Excel/CSV parsing failed', error);
    throw new Error(`Failed to parse ${format.toUpperCase()} file`);
  }
}

// ============================================================
// Word Document Parser
// ============================================================

export async function parseDocx(buffer: Buffer): Promise<ParsedContent> {
  const mammoth = await import('mammoth');

  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    return {
      text,
      tables: [],
      isScanned: false,
      format: 'docx',
    };
  } catch (error) {
    logger.error('DOCX parsing failed', error);
    throw new Error('Failed to parse Word document');
  }
}

// ============================================================
// PowerPoint Parser — extracts text from slide XML via JSZip
// ============================================================

export async function parsePptx(buffer: Buffer): Promise<ParsedContent> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);

    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)![0], 10);
        const numB = parseInt(b.match(/\d+/)![0], 10);
        return numA - numB;
      });

    const textParts: string[] = [];
    for (const slideFile of slideFiles) {
      const xml = await zip.files[slideFile]!.async('text');
      // Extract text from <a:t> elements
      const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? [];
      const slideText = matches
        .map((m) => m.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
        .join(' ');
      if (slideText) textParts.push(slideText);
    }

    return {
      text: textParts.join('\n\n'),
      tables: [],
      isScanned: false,
      format: 'pptx',
    };
  } catch (error) {
    logger.error('PPTX parsing failed', error);
    return { text: '', tables: [], isScanned: false, format: 'pptx' };
  }
}

// ============================================================
// Image Handler — uses Claude Vision to extract text
// ============================================================

type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

const IMAGE_MEDIA_TYPES: Record<string, ImageMediaType> = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif:  'image/gif',
};

export async function parseImage(buffer: Buffer, format: string): Promise<ParsedContent> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    logger.warn('ANTHROPIC_API_KEY not set — cannot use Claude Vision for image extraction');
    return { text: '', tables: [], isScanned: true, format };
  }

  const mediaType = IMAGE_MEDIA_TYPES[format.toLowerCase()] ?? 'image/png';

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as ImageMediaType, data: buffer.toString('base64') },
            } as unknown as Anthropic.Messages.ImageBlockParam,
            {
              type: 'text',
              text: 'Extract ALL text, numbers, table values, headings, and labels from this image. Include every data point visible. Return only the extracted content, no explanations.',
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    logger.info(`Claude Vision extracted ${text.length} chars from image`);
    return { text, tables: [], isScanned: true, format };
  } catch (error) {
    logger.error('Claude Vision image extraction failed', error);
    return { text: '', tables: [], isScanned: true, format };
  }
}

// ============================================================
// Router
// ============================================================

export async function parseFile(buffer: Buffer, mimeType: string, filename: string): Promise<ParsedContent> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    const result = await parsePDF(buffer);
    // Scanned PDF — fallback to Claude's native PDF document understanding
    if (result.isScanned || result.text.length < 100) {
      logger.info('PDF appears scanned — attempting Claude document fallback');
      const visionResult = await parsePDFWithClaude(buffer, result.pageCount);
      if (visionResult.text.length > result.text.length) {
        return visionResult;
      }
    }
    return result;
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    ext === 'xlsx'
  ) {
    return parseExcel(buffer, 'xlsx');
  }

  if (mimeType === 'text/csv' || ext === 'csv') {
    return parseExcel(buffer, 'csv');
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    return parseDocx(buffer);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    ext === 'pptx'
  ) {
    return parsePptx(buffer);
  }

  if (mimeType.startsWith('image/')) {
    return parseImage(buffer, ext);
  }

  throw new Error(`Unsupported file format: ${mimeType} (${ext})`);
}
