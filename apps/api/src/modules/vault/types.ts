export interface ParsedSource {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedBy: string;
  uploadedAt: string;
  languageDetected: string[];
}

export interface ParsedClassification {
  docClass:
    | "methodology"
    | "sop"
    | "report"
    | "working_paper"
    | "reference"
    | "email"
    | "unknown";
  confidence: number;
}

export interface ParsedOutlineEntry {
  level: number;
  title: string;
  pageStart: number;
  pageEnd: number;
}

export interface ParsedElement {
  elementId: string;
  type:
    | "heading"
    | "paragraph"
    | "table"
    | "list_item"
    | "image"
    | "caption"
    | "footnote";
  text: string;
  page: number;
  bbox?: [number, number, number, number];
  metadata?: {
    headingLevel?: number;
    headingPath?: string[];
    listDepth?: number;
  };
}

export interface ParsedTable {
  tableId: string;
  page: number;
  rows: string[][];
  caption?: string;
  extractedSchema?: {
    columns: Array<{ name: string; type?: string }>;
  };
}

export interface ParsedImage {
  imageId: string;
  page: number;
  ocrText?: string;
  caption?: string;
  buffer?: Buffer;
}

export interface ParsedDocument {
  docId: string;
  workspaceId: string;
  source: ParsedSource;
  classification: ParsedClassification;
  outline: ParsedOutlineEntry[];
  elements: ParsedElement[];
  tables: ParsedTable[];
  images: ParsedImage[];
  ocrUsed?: boolean;
}

export interface ChunkInput {
  content: string;
  chunkType: "text" | "table" | "image_description" | "heading" | "list";
  pageNumber?: number;
  bbox?: [number, number, number, number];
  sectionPath: string[];
  tableData?: {
    headers: string[];
    rows: string[][];
    caption?: string;
  };
  tokenCount: number;
}

export interface EnrichedChunk extends ChunkInput {
  contextualHeader: string;
  enrichedContent: string;
}

export interface EmbeddedChunk extends EnrichedChunk {
  vector: number[];
  embeddingModel: string;
}

export const PIPELINE_VERSION = "1.0.0";
export const VAULT_QDRANT_COLLECTION = "vault_dense";
export const VAULT_VECTOR_SIZE = 1024;
export const VAULT_QUEUE_NAME = "vault-processing";
