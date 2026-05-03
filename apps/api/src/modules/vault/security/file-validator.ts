import { logger } from "../../../lib/logger.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/tab-separated-values",
  "message/rfc822",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "docx", "xlsx", "xls", "csv", "tsv", "pptx",
  "eml", "png", "jpg", "jpeg", "tiff", "webp",
]);

const MAGIC_BYTES: Array<{ ext: string[]; bytes: number[]; offset?: number }> = [
  { ext: ["pdf"], bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { ext: ["docx", "xlsx", "pptx"], bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK (ZIP)
  { ext: ["xls"], bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE2
  { ext: ["png"], bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: ["jpg", "jpeg"], bytes: [0xff, 0xd8, 0xff] },
  { ext: ["tiff"], bytes: [0x49, 0x49, 0x2a, 0x00] }, // little-endian TIFF
  { ext: ["tiff"], bytes: [0x4d, 0x4d, 0x00, 0x2a] }, // big-endian TIFF
  { ext: ["webp"], bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): ValidationResult {
  if (buffer.length === 0) {
    return { valid: false, error: "File is empty" };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Unsupported file extension: .${ext}` };
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    const extAllowed = ALLOWED_EXTENSIONS.has(ext);
    if (!extAllowed) {
      return { valid: false, error: `Unsupported MIME type: ${mimeType}` };
    }
    logger.warn(
      `MIME type ${mimeType} not in whitelist but extension .${ext} is allowed — proceeding`
    );
  }

  // CSV/TSV and EML are text-based — no magic byte check
  if (["csv", "tsv", "eml"].includes(ext)) {
    return { valid: true };
  }

  if (!verifyMagicBytes(buffer, ext)) {
    return {
      valid: false,
      error: `File content does not match expected format for .${ext} — possible file type mismatch`,
    };
  }

  return { valid: true };
}

function verifyMagicBytes(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 4) return false;

  const matchingRules = MAGIC_BYTES.filter((rule) => rule.ext.includes(ext));
  if (matchingRules.length === 0) return true;

  return matchingRules.some((rule) => {
    const offset = rule.offset ?? 0;
    return rule.bytes.every(
      (byte, i) => buffer.length > offset + i && buffer[offset + i] === byte
    );
  });
}
