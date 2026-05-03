import { randomUUID } from "crypto";
import { logger } from "../../../lib/logger.js";
import type {
  ParsedDocument,
  ParsedElement,
  ParsedTable,
  ParsedOutlineEntry,
} from "../types.js";

const SCANNED_THRESHOLD = 50;

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
    let totalText = "";
    let isScanned = false;

    const avgCharsPerPage =
      pages.reduce((sum: number, p: { text: string }) => sum + p.text.length, 0) /
      Math.max(pages.length, 1);
    if (avgCharsPerPage < SCANNED_THRESHOLD) {
      isScanned = true;
    }

    let currentHeadingPath: string[] = [];

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageText = pages[pageIdx].text;
      totalText += pageText + "\n";
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
            Math.abs(existingTable.rows[0]?.length - cells.length) <= 1
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
    };
  } catch (error) {
    logger.error("Vault PDF parsing failed", error);
    throw new Error("Failed to parse PDF for vault ingestion");
  }
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
  if (match) {
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
