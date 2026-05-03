import { randomUUID } from "crypto";
import { logger } from "../../../lib/logger.js";
import type { ParsedDocument, ParsedElement, ParsedTable } from "../types.js";

type SheetClass = "data_table" | "pivot" | "free_form" | "calculator";

interface SheetAnalysis {
  name: string;
  classification: SheetClass;
  headers: string[];
  rows: string[][];
  formulas: Array<{ cell: string; formula: string }>;
  comments: Array<{ cell: string; text: string }>;
  namedRanges: Array<{ name: string; ref: string }>;
}

export async function parseXlsx(
  buffer: Buffer,
  docId: string,
  workspaceId: string,
  format: "xlsx" | "csv" = "xlsx"
): Promise<Partial<ParsedDocument>> {
  const XLSX = await import("xlsx");

  try {
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellFormula: true,
      cellNF: true,
      cellStyles: false,
      sheetStubs: true,
    });

    const elements: ParsedElement[] = [];
    const tables: ParsedTable[] = [];
    const sheets: SheetAnalysis[] = [];

    const definedNames = workbook.Workbook?.Names || [];
    const globalNamedRanges = definedNames.map((n: any) => ({
      name: n.Name || "",
      ref: n.Ref || "",
    }));

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const jsonData: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as string[][];

      if (jsonData.length === 0) continue;

      const formulas: SheetAnalysis["formulas"] = [];
      const comments: SheetAnalysis["comments"] = [];

      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = sheet[addr];
          if (!cell) continue;
          if (cell.f) {
            formulas.push({ cell: addr, formula: cell.f });
          }
          if (cell.c && cell.c.length > 0) {
            const commentText = cell.c.map((cm: any) => cm.t || "").join(" ");
            if (commentText.trim()) {
              comments.push({ cell: addr, text: commentText.trim() });
            }
          }
        }
      }

      const classification = classifySheet(jsonData, formulas);
      const nonEmptyRows = jsonData.filter((row) =>
        row.some((cell) => String(cell).trim() !== "")
      );

      const headerRowIdx = findHeaderRow(nonEmptyRows);
      const headers = (nonEmptyRows[headerRowIdx] || []).map(String);
      const dataRows = nonEmptyRows.slice(headerRowIdx + 1).map((row) =>
        row.map(String)
      );

      const sheetNamedRanges = globalNamedRanges.filter((n: { name: string; ref: string }) =>
        n.ref.includes(sheetName)
      );

      sheets.push({
        name: sheetName,
        classification,
        headers,
        rows: dataRows,
        formulas,
        comments,
        namedRanges: sheetNamedRanges,
      });
    }

    for (const sheet of sheets) {
      elements.push({
        elementId: randomUUID(),
        type: "heading",
        text: `Sheet: ${sheet.name} [${sheet.classification}]`,
        page: 1,
        metadata: { headingLevel: 1, headingPath: [sheet.name] },
      });

      if (sheet.classification === "data_table" || sheet.classification === "pivot") {
        const tableId = randomUUID();
        const allRows = [sheet.headers, ...sheet.rows];

        tables.push({
          tableId,
          page: 1,
          rows: allRows,
          caption: `${sheet.name} (${sheet.classification})`,
          extractedSchema: {
            columns: sheet.headers.map((h) => ({ name: h })),
          },
        });

        elements.push({
          elementId: tableId,
          type: "table",
          text: allRows.map((r) => r.join(" | ")).join("\n"),
          page: 1,
          metadata: { headingPath: [sheet.name] },
        });
      } else if (sheet.classification === "free_form") {
        for (const row of sheet.rows) {
          const text = row.filter(Boolean).join(" ");
          if (text.trim()) {
            elements.push({
              elementId: randomUUID(),
              type: "paragraph",
              text,
              page: 1,
              metadata: { headingPath: [sheet.name] },
            });
          }
        }
      } else if (sheet.classification === "calculator") {
        const assumptions = sheet.formulas.slice(0, 50).map((f) => {
          const row = parseInt(f.cell.replace(/[A-Z]+/, ""), 10) - 1;
          const label =
            sheet.rows[row]?.[0] || sheet.headers[0] || f.cell;
          return `${label}: =${f.formula}`;
        });

        if (assumptions.length > 0) {
          elements.push({
            elementId: randomUUID(),
            type: "paragraph",
            text: `Model formulas:\n${assumptions.join("\n")}`,
            page: 1,
            metadata: { headingPath: [sheet.name, "Formulas"] },
          });
        }

        if (sheet.namedRanges.length > 0) {
          elements.push({
            elementId: randomUUID(),
            type: "paragraph",
            text: `Named ranges: ${sheet.namedRanges.map((n) => `${n.name}=${n.ref}`).join(", ")}`,
            page: 1,
            metadata: { headingPath: [sheet.name, "Named Ranges"] },
          });
        }
      }

      if (sheet.comments.length > 0) {
        elements.push({
          elementId: randomUUID(),
          type: "footnote",
          text: `Cell comments: ${sheet.comments.map((c) => `[${c.cell}] ${c.text}`).join("; ")}`,
          page: 1,
          metadata: { headingPath: [sheet.name, "Comments"] },
        });
      }
    }

    return {
      docId,
      workspaceId,
      outline: sheets.map((s, i) => ({
        level: 1,
        title: `${s.name} (${s.classification})`,
        pageStart: 1,
        pageEnd: 1,
      })),
      elements,
      tables,
      images: [],
    };
  } catch (error) {
    logger.error("Vault XLSX parsing failed", error);
    throw new Error(`Failed to parse ${format.toUpperCase()} for vault ingestion`);
  }
}

function classifySheet(
  rows: string[][],
  formulas: Array<{ cell: string; formula: string }>
): SheetClass {
  const nonEmpty = rows.filter((r) => r.some((c) => String(c).trim()));
  if (nonEmpty.length < 2) return "free_form";

  const formulaRatio = formulas.length / Math.max(nonEmpty.length, 1);
  if (formulaRatio > 0.5) return "calculator";

  const firstRow = nonEmpty[0] || [];
  const uniqueHeaders = new Set(firstRow.map((c) => String(c).trim()).filter(Boolean));
  const columnCount = firstRow.length;

  if (uniqueHeaders.size >= Math.max(columnCount * 0.7, 2)) {
    const rowWidths = nonEmpty.slice(1, 10).map((r) => r.filter(Boolean).length);
    const avgWidth = rowWidths.reduce((a, b) => a + b, 0) / Math.max(rowWidths.length, 1);
    if (Math.abs(avgWidth - columnCount) <= 2) return "data_table";
    return "pivot";
  }

  return "free_form";
}

function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    const nonEmpty = row.filter((c) => String(c).trim());
    if (nonEmpty.length >= 2) {
      const allText = nonEmpty.every((c) => isNaN(Number(c)) || String(c).trim() === "");
      if (allText) return i;
    }
  }
  return 0;
}
