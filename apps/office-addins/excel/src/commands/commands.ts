/**
 * Merris ESG Agent -- Excel Ribbon Commands
 *
 * These functions are invoked directly from the ribbon buttons in manifest.xml.
 * They run in a hidden browser instance (not the taskpane).
 */

import { autoFillData, validateData } from "../../../shared/api-client";
import { ensureAuthenticated } from "../../../shared/auth";

/* globals Office, Excel */
declare const Office: any;
declare const Excel: any;

// ---- Initialization ----

Office.onReady(async () => {
  try {
    await ensureAuthenticated();
  } catch {
    // Auth not available -- commands will fail gracefully
  }
});

// ---- Auto-Fill Command ----

async function autoFill(event: any): Promise<void> {
  try {
    await Excel.run(async (context: any) => {
      const range = context.workbook.getSelectedRange();
      range.load("values,address,rowCount,columnCount");
      await context.sync();

      const metrics: string[] = [];
      for (const row of range.values) {
        for (const cell of row) {
          if (typeof cell === "string" && cell.trim().length > 0) {
            metrics.push(cell.trim());
          }
        }
      }

      if (metrics.length === 0) {
        event.completed();
        return;
      }

      const result = await autoFillData(metrics);

      let filled = 0;
      for (let i = 0; i < result.data_points.length; i++) {
        const dp = result.data_points[i];
        try {
          const targetCell = range
            .getCell(i % range.rowCount, 0)
            .getOffsetRange(0, 1);
          targetCell.values = [[dp.value !== null ? dp.value : ""]];

          // Color coding by fill type
          switch (dp.fill_type) {
            case "auto-extracted":
              targetCell.format.fill.color = "#065F46";
              targetCell.format.font.color = "#34D399";
              break;
            case "calculated":
              targetCell.format.fill.color = "#1E3A5F";
              targetCell.format.font.color = "#60A5FA";
              break;
            case "needs-input":
              targetCell.format.fill.color = "#7C2D12";
              targetCell.format.font.color = "#FB923C";
              break;
          }

          // Add cell comment with source citation
          if (dp.source) {
            context.workbook.comments.add(
              targetCell,
              `Source: ${dp.source}${dp.confidence ? ` | Confidence: ${dp.confidence}` : ""}\nMetric: ${dp.metric_name}`
            );
          }

          filled++;
        } catch {
          // Skip failed cell operations
        }
      }

      await context.sync();
      console.log(`[Merris] Auto-filled ${filled} data points.`);
    });
  } catch (err: any) {
    console.error("[Merris] Auto-fill error:", err.message || err);
  }

  event.completed();
}

// ---- Validate Data Command ----

async function validateDataCommand(event: any): Promise<void> {
  try {
    await Excel.run(async (context: any) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      const usedRange = sheet.getUsedRange();
      usedRange.load("values,rowCount,columnCount,address");
      await context.sync();

      const values = usedRange.values;
      const headers =
        values.length > 0
          ? values[0].map((h: any, i: number) =>
              typeof h === "string" && h.trim() ? h.trim() : `Column_${i}`
            )
          : [];

      const data: Record<string, unknown>[] = [];
      for (let r = 1; r < values.length; r++) {
        const row: Record<string, unknown> = {};
        for (let c = 0; c < values[r].length; c++) {
          row[headers[c] || `col_${c}`] = values[r][c];
        }
        data.push(row);
      }

      const result = await validateData(data);

      // Clear previous validation formatting
      usedRange.format.fill.clear();
      await context.sync();

      let errors = 0;
      let warnings = 0;

      for (const issue of result.results) {
        try {
          if (issue.cell) {
            const cell = sheet.getRange(issue.cell);
            if (issue.severity === "error") {
              cell.format.fill.color = "#7F1D1D";
              cell.format.font.color = "#F87171";
              errors++;
            } else if (issue.severity === "warning") {
              cell.format.fill.color = "#7C2D12";
              cell.format.font.color = "#FB923C";
              warnings++;
            }

            if (issue.message) {
              context.workbook.comments.add(
                cell,
                `[${issue.severity.toUpperCase()}] ${issue.message}${issue.suggestion ? `\nSuggestion: ${issue.suggestion}` : ""}`
              );
            }
          }
        } catch {
          // Skip failed cell operations
        }
      }

      await context.sync();
      console.log(
        `[Merris] Validation complete: ${errors} error(s), ${warnings} warning(s).`
      );
    });
  } catch (err: any) {
    console.error("[Merris] Validation error:", err.message || err);
  }

  event.completed();
}

// ---- Register commands globally ----

(globalThis as any).autoFill = autoFill;
(globalThis as any).validateData = validateDataCommand;
