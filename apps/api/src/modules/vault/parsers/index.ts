import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { logger } from "../../../lib/logger.js";
import { parsePDF } from "./pdf.parser.js";
import { parseDocx } from "./docx.parser.js";
import { parseXlsx } from "./xlsx.parser.js";
import { parseCsv } from "./csv.parser.js";
import { parsePptx } from "./pptx.parser.js";
import { parseImage } from "./image.parser.js";
import { parseEmail } from "./email.parser.js";
import type { ParsedDocument, ParsedSource } from "../types.js";

export interface ParseFileOptions {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  workspaceId: string;
  uploadedBy: string;
}

export async function parseFile(
  opts: ParseFileOptions
): Promise<ParsedDocument> {
  const { buffer, filename, mimeType, workspaceId, uploadedBy } = opts;
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const docId = randomUUID();

  const source: ParsedSource = {
    filename,
    mimeType,
    sizeBytes: buffer.length,
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    languageDetected: [],
  };

  let partial: Partial<ParsedDocument>;

  if (mimeType === "application/pdf" || ext === "pdf") {
    partial = await parsePDF(buffer, docId, workspaceId);
  } else if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    partial = await parseDocx(buffer, docId, workspaceId);
  } else if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ext === "xlsx" ||
    ext === "xls"
  ) {
    partial = await parseXlsx(buffer, docId, workspaceId, "xlsx");
  } else if (mimeType === "text/csv" || ext === "csv") {
    partial = await parseCsv(buffer, docId, workspaceId);
  } else if (ext === "tsv") {
    partial = await parseCsv(buffer, docId, workspaceId);
  } else if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  ) {
    partial = await parsePptx(buffer, docId, workspaceId);
  } else if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "tiff", "webp"].includes(ext)) {
    partial = await parseImage(buffer, mimeType, docId, workspaceId);
  } else if (mimeType === "message/rfc822" || ext === "eml") {
    partial = await parseEmail(buffer, docId, workspaceId);
  } else {
    logger.warn(`Vault parser: unsupported format ${mimeType} (${ext}), treating as raw text`);
    partial = {
      docId,
      workspaceId,
      outline: [],
      elements: [
        {
          elementId: randomUUID(),
          type: "paragraph",
          text: buffer.toString("utf-8").slice(0, 100_000),
          page: 1,
        },
      ],
      tables: [],
      images: [],
    };
  }

  return {
    docId: partial.docId || docId,
    workspaceId: partial.workspaceId || workspaceId,
    source,
    classification: partial.classification || {
      docClass: "unknown",
      confidence: 0,
    },
    outline: partial.outline || [],
    elements: partial.elements || [],
    tables: partial.tables || [],
    images: partial.images || [],
  };
}
