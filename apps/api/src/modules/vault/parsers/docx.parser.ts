import { randomUUID } from "crypto";
import { logger } from "../../../lib/logger.js";
import type {
  ParsedDocument,
  ParsedElement,
  ParsedTable,
  ParsedOutlineEntry,
} from "../types.js";

export async function parseDocx(
  buffer: Buffer,
  docId: string,
  workspaceId: string
): Promise<Partial<ParsedDocument>> {
  const mammoth = await import("mammoth");

  try {
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const html = htmlResult.value;

    const elements: ParsedElement[] = [];
    const outline: ParsedOutlineEntry[] = [];
    const tables: ParsedTable[] = [];
    let currentHeadingPath: string[] = [];

    const headingRegex = /<h(\d)[^>]*>(.*?)<\/h\d>/gi;
    const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
    const tableRegex = /<table[^>]*>(.*?)<\/table>/gis;
    const trRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
    const tdThRegex = /<t[dh][^>]*>(.*?)<\/t[dh]>/gis;

    let match: RegExpExecArray | null;

    match = tableRegex.exec(html);
    while (match) {
      const tableHtml = match[1];
      const rows: string[][] = [];
      let trMatch: RegExpExecArray | null;

      const trRegexLocal = new RegExp(trRegex.source, trRegex.flags);
      trMatch = trRegexLocal.exec(tableHtml);
      while (trMatch) {
        const cells: string[] = [];
        let cellMatch: RegExpExecArray | null;
        const cellRegex = new RegExp(tdThRegex.source, tdThRegex.flags);
        cellMatch = cellRegex.exec(trMatch[1]);
        while (cellMatch) {
          cells.push(stripHtml(cellMatch[1]));
          cellMatch = cellRegex.exec(trMatch[1]);
        }
        if (cells.length > 0) rows.push(cells);
        trMatch = trRegexLocal.exec(tableHtml);
      }

      if (rows.length > 0) {
        const tableId = randomUUID();
        tables.push({ tableId, page: 1, rows });
        elements.push({
          elementId: tableId,
          type: "table",
          text: rows.map((r) => r.join(" | ")).join("\n"),
          page: 1,
          metadata: { headingPath: [...currentHeadingPath] },
        });
      }

      match = tableRegex.exec(html);
    }

    const htmlWithoutTables = html.replace(tableRegex, "");

    const blockRegex = /<(h\d|p|li)[^>]*>(.*?)<\/\1>/gi;
    let blockMatch: RegExpExecArray | null;
    blockMatch = blockRegex.exec(htmlWithoutTables);
    while (blockMatch) {
      const tag = blockMatch[1].toLowerCase();
      const text = stripHtml(blockMatch[2]).trim();
      if (!text) {
        blockMatch = blockRegex.exec(htmlWithoutTables);
        continue;
      }

      if (tag.startsWith("h")) {
        const level = parseInt(tag[1], 10);
        currentHeadingPath = currentHeadingPath.slice(0, level - 1);
        currentHeadingPath[level - 1] = text;
        currentHeadingPath = currentHeadingPath.filter(Boolean);

        outline.push({ level, title: text, pageStart: 1, pageEnd: 1 });
        elements.push({
          elementId: randomUUID(),
          type: "heading",
          text,
          page: 1,
          metadata: {
            headingLevel: level,
            headingPath: [...currentHeadingPath],
          },
        });
      } else if (tag === "li") {
        elements.push({
          elementId: randomUUID(),
          type: "list_item",
          text,
          page: 1,
          metadata: { headingPath: [...currentHeadingPath] },
        });
      } else {
        elements.push({
          elementId: randomUUID(),
          type: "paragraph",
          text,
          page: 1,
          metadata: { headingPath: [...currentHeadingPath] },
        });
      }

      blockMatch = blockRegex.exec(htmlWithoutTables);
    }

    return {
      docId,
      workspaceId,
      outline,
      elements,
      tables,
      images: [],
    };
  } catch (error) {
    logger.error("Vault DOCX parsing failed", error);
    throw new Error("Failed to parse DOCX for vault ingestion");
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
