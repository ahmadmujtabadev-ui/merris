import { randomUUID } from "crypto";
import { logger } from "../../../lib/logger.js";
import type {
  ParsedDocument,
  ParsedElement,
  ParsedTable,
  ParsedOutlineEntry,
} from "../types.js";

const SCANNED_THRESHOLD = 50;
const VISION_THRESHOLD = 200; // chars/page — trigger vision enhancement for sparse/slide PDFs

export async function parsePDF(
  buffer: Buffer,
  docId: string,
  workspaceId: string
): Promise<Partial<ParsedDocument>> {
  const { PDFParse } = await import("pdf-parse");

  try {
    const uint8 = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    const pdf = new PDFParse(uint8 as unknown as Buffer);
    const textResult = await pdf.getText();
    const pages = textResult.pages;

    const elements: ParsedElement[] = [];
    const outline: ParsedOutlineEntry[] = [];
    const tables: ParsedTable[] = [];
    let isScanned = false;

    const avgCharsPerPage =
      pages.reduce((sum: number, p: { text: string }) => sum + p.text.length, 0) /
      Math.max(pages.length, 1);

    if (avgCharsPerPage < SCANNED_THRESHOLD) {
      isScanned = true;
    }

    // For sparse/image-heavy PDFs (presentations, scanned docs), use Claude Vision
    if (avgCharsPerPage < VISION_THRESHOLD) {
      logger.info(
        `PDF "${docId}" is sparse (${Math.round(avgCharsPerPage)} chars/page) — attempting Claude Vision extraction`
      );
      const visionResult = await parsePDFWithVision(buffer, docId, workspaceId, pages.length);
      if (visionResult.elements && visionResult.elements.length > 5) {
        logger.info(
          `Vision extracted ${visionResult.elements.length} elements for ${docId} (vs ${elements.length} from text)`
        );
        return { ...visionResult, ocrUsed: true };
      }
      logger.warn(`Vision extraction returned few elements for ${docId} — falling back to text`);
    }

    let currentHeadingPath: string[] = [];

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageText = (pages[pageIdx] as { text: string }).text;
      const lines = pageText.split("\n").filter((l: string) => l.trim());

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const isHeading = detectHeading(trimmed);
        const isTableRow = detectTableRow(trimmed);

        if (isHeading) {
          const level = guessHeadingLevel(trimmed);
          currentHeadingPath = currentHeadingPath.slice(0, level - 1);
          currentHeadingPath[level - 1] = trimmed;
          currentHeadingPath = currentHeadingPath.filter(Boolean);

          outline.push({
            level,
            title: trimmed,
            pageStart: pageIdx + 1,
            pageEnd: pageIdx + 1,
          });

          elements.push({
            elementId: randomUUID(),
            type: "heading",
            text: trimmed,
            page: pageIdx + 1,
            metadata: {
              headingLevel: level,
              headingPath: [...currentHeadingPath],
            },
          });
        } else if (isTableRow) {
          const cells = trimmed
            .split(/\t|\s{2,}|\|/)
            .map((c) => c.trim())
            .filter(Boolean);
          const existingTable = tables[tables.length - 1];
          if (
            existingTable &&
            existingTable.page === pageIdx + 1 &&
            Math.abs((existingTable.rows[0]?.length ?? 0) - cells.length) <= 1
          ) {
            existingTable.rows.push(cells);
          } else {
            tables.push({
              tableId: randomUUID(),
              page: pageIdx + 1,
              rows: [cells],
            });
          }
        } else {
          elements.push({
            elementId: randomUUID(),
            type: "paragraph",
            text: trimmed,
            page: pageIdx + 1,
            metadata: {
              headingPath: [...currentHeadingPath],
            },
          });
        }
      }
    }

    for (const table of tables) {
      if (table.rows.length > 1) {
        elements.push({
          elementId: table.tableId,
          type: "table",
          text: table.rows.map((r) => r.join(" | ")).join("\n"),
          page: table.page,
          metadata: { headingPath: [...currentHeadingPath] },
        });
      }
    }

    return {
      docId,
      workspaceId,
      outline,
      elements,
      tables: tables.filter((t) => t.rows.length > 1),
      images: [],
      ocrUsed: false,
    };
  } catch (error) {
    logger.error("Vault PDF parsing failed", error);
    throw new Error("Failed to parse PDF for vault ingestion");
  }
}

async function parsePDFWithVision(
  buffer: Buffer,
  docId: string,
  workspaceId: string,
  pageCount: number
): Promise<Partial<ParsedDocument>> {
  try {
    const { getClient } = await import("../../../lib/claude.js");
    const client = getClient();

    if (!client) {
      logger.warn("Claude client unavailable — PDF Vision skipped");
      return { docId, workspaceId, outline: [], elements: [], tables: [], images: [] };
    }

    const base64 = buffer.toString("base64");
    const pageLimitNote =
      pageCount > 30
        ? ` (Note: this document has ${pageCount} pages; focus on the most content-rich pages)`
        : "";

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            } as any,
            {
              type: "text",
              text: `Extract ALL content from this PDF document page by page.${pageLimitNote}

For EVERY page output:
PAGE N:
[All visible text, headings, bullet points — verbatim]
[Every statistic, percentage, or number with its full context — e.g., "85% of CxOs increased sustainability investment in 2024"]
[For charts/graphs: title, what metric it shows, all labeled values and percentages]
[For tables: all rows and columns with values]
[Every recommendation, conclusion, and key insight]

Use "## " prefix for headings and "- " prefix for bullet points. Preserve all data exactly as shown. Be exhaustive — every number and recommendation matters.`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const fullText = textBlock && "text" in textBlock ? textBlock.text : "";

    if (!fullText.trim()) {
      return { docId, workspaceId, outline: [], elements: [], tables: [], images: [] };
    }

    return parseVisionOutput(fullText, docId, workspaceId);
  } catch (error) {
    logger.warn("PDF Claude Vision extraction failed", error);
    return { docId, workspaceId, outline: [], elements: [], tables: [], images: [] };
  }
}

function parseVisionOutput(
  fullText: string,
  docId: string,
  workspaceId: string
): Partial<ParsedDocument> {
  const elements: ParsedElement[] = [];
  const outline: ParsedOutlineEntry[] = [];

  // Split on PAGE N: markers
  const pagePattern = /^PAGE\s+(\d+)\s*:/m;
  const parts = fullText.split(pagePattern);

  // parts is: [pre-content, pageNum, content, pageNum, content, ...]
  const pages: Array<{ page: number; content: string }> = [];

  if (parts.length <= 1) {
    // No PAGE markers found — treat entire output as single page
    pages.push({ page: 1, content: fullText.trim() });
  } else {
    let i = 1;
    while (i < parts.length - 1) {
      const pageNum = parseInt(parts[i] ?? "1", 10);
      const content = (parts[i + 1] ?? "").trim();
      if (content) pages.push({ page: pageNum, content });
      i += 2;
    }
  }

  for (const { page, content } of pages) {
    const lines = content.split("\n");
    let currentPath: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
        const text = trimmed.replace(/^#+\s*/, "");
        const level = trimmed.startsWith("### ") ? 3 : 2;
        currentPath = [text];
        outline.push({ level, title: text, pageStart: page, pageEnd: page });
        elements.push({
          elementId: randomUUID(),
          type: "heading",
          text,
          page,
          metadata: { headingLevel: level, headingPath: [...currentPath] },
        });
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
        elements.push({
          elementId: randomUUID(),
          type: "list_item",
          text: trimmed.replace(/^[-•]\s+/, ""),
          page,
          metadata: { headingPath: [...currentPath] },
        });
      } else if (trimmed.length > 0) {
        elements.push({
          elementId: randomUUID(),
          type: "paragraph",
          text: trimmed,
          page,
          metadata: { headingPath: [...currentPath] },
        });
      }
    }
  }

  return {
    docId,
    workspaceId,
    outline,
    elements,
    tables: [],
    images: [{ imageId: randomUUID(), page: 1, ocrText: fullText }],
    ocrUsed: true,
  };
}

function detectHeading(line: string): boolean {
  if (line.length > 200) return false;
  if (line.length < 3) return false;
  if (/^\d+(\.\d+)*\s+[A-Z]/.test(line)) return true;
  if (line === line.toUpperCase() && line.length < 80 && /[A-Z]/.test(line))
    return true;
  if (/^(Chapter|Section|Part|Appendix)\s/i.test(line)) return true;
  return false;
}

function guessHeadingLevel(line: string): number {
  const match = line.match(/^(\d+(?:\.\d+)*)/);
  if (match?.[1]) {
    const parts = match[1].split(".");
    return Math.min(parts.length, 4);
  }
  if (line === line.toUpperCase()) return 1;
  return 2;
}

function detectTableRow(line: string): boolean {
  const tabCount = (line.match(/\t/g) || []).length;
  if (tabCount >= 2) return true;
  const pipeCount = (line.match(/\|/g) || []).length;
  if (pipeCount >= 2) return true;
  const multiSpaceSegments = line.split(/\s{3,}/).filter(Boolean);
  if (multiSpaceSegments.length >= 3) return true;
  return false;
}
