import { randomUUID } from "crypto";
import type { ParsedTable } from "../types.js";

export function detectTablesInText(
  text: string,
  page: number
): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const lines = text.split("\n");

  let tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const isTabular = isTableLine(line);

    if (isTabular) {
      tableLines.push(line);
      inTable = true;
    } else if (inTable) {
      if (tableLines.length >= 2) {
        const table = parseTableLines(tableLines, page);
        if (table) tables.push(table);
      }
      tableLines = [];
      inTable = false;
    }
  }

  if (inTable && tableLines.length >= 2) {
    const table = parseTableLines(tableLines, page);
    if (table) tables.push(table);
  }

  return tables;
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const pipeCount = (trimmed.match(/\|/g) || []).length;
  if (pipeCount >= 2) return true;

  const tabCount = (trimmed.match(/\t/g) || []).length;
  if (tabCount >= 2) return true;

  const multiSpaceSegments = trimmed.split(/\s{3,}/).filter(Boolean);
  if (multiSpaceSegments.length >= 3) return true;

  return false;
}

function parseTableLines(lines: string[], page: number): ParsedTable | null {
  const separator = detectSeparator(lines[0] || "");
  const rows = lines.map((line) =>
    line
      .split(separator)
      .map((c) => c.trim())
      .filter((_, i, arr) => i < arr.length || arr[i] !== "")
  );

  const validRows = rows.filter((r) => r.length >= 2);
  if (validRows.length < 2) return null;

  return {
    tableId: randomUUID(),
    page,
    rows: validRows,
  };
}

function detectSeparator(line: string): RegExp {
  if (line.includes("|")) return /\|/;
  if (line.includes("\t")) return /\t/;
  return /\s{3,}/;
}
