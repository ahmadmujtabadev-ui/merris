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
// PowerPoint Parser (basic text extraction)
// ============================================================

export async function parsePptx(_buffer: Buffer): Promise<ParsedContent> {
  // Basic PPTX parsing stub.
  // For full PPTX support, a dedicated library (e.g., pptx-parser) would be needed.
  // PPTX files are ZIP archives containing XML slides.
  // Future implementation: unzip and extract text from slide XML files.
  return {
    text: '[PPTX content - requires specialized parser]',
    tables: [],
    isScanned: false,
    format: 'pptx',
  };
}

// ============================================================
// Image Handler (flagged for Claude Vision)
// ============================================================

export function parseImage(_buffer: Buffer, format: string): ParsedContent {
  return {
    text: '',
    tables: [],
    isScanned: true,
    format,
  };
}

// ============================================================
// Router
// ============================================================

export async function parseFile(buffer: Buffer, mimeType: string, filename: string): Promise<ParsedContent> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return parsePDF(buffer);
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
