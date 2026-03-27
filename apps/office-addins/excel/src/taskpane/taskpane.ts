/**
 * Merris ESG Agent -- Excel Taskpane
 *
 * Initializes Office.js and renders the three panels:
 * 1. Agent Chat
 * 2. Data Completeness Summary
 * 3. Suggested Actions
 */

import { AgentPanel } from "../../../shared/agent-panel";
import { ensureAuthenticated } from "../../../shared/auth";
import { api } from "../../../shared/api-client";
import "../../../shared/styles.css";

/* globals Office, Excel */
declare const Office: any;
declare const Excel: any;

let agentPanel: AgentPanel | null = null;

// ---- Initialization ----

Office.onReady(async (info: { host: string }) => {
  if (info.host === "Excel" || info.host === "Workbook") {
    try {
      await ensureAuthenticated();
    } catch {
      // Auth not available in dev -- continue anyway
    }
    setupTabs();
    initAgentPanel();
    loadCompleteness();
    setupActionButtons();
  }
});

// ---- Tab navigation ----

function setupTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>(".merris-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const panels = document.querySelectorAll<HTMLElement>(".merris-panel");
      panels.forEach((p) => p.classList.remove("active"));

      const target = tab.getAttribute("data-tab");
      const panel = document.getElementById(`panel-${target}`);
      if (panel) panel.classList.add("active");
    });
  });
}

// ---- Agent Chat ----

function initAgentPanel(): void {
  const container = document.getElementById("panel-agent");
  if (!container) return;

  agentPanel = new AgentPanel({
    parentElement: container,
    context: { host: "excel" },
    onAction: handleAgentAction,
  });
}

function handleAgentAction(action: {
  type: string;
  payload: Record<string, unknown>;
}): void {
  switch (action.type) {
    case "fill_cells":
      if (action.payload.data) {
        fillCellsFromPayload(
          action.payload.data as Array<{
            cell: string;
            value: string | number;
            fill_type: string;
          }>
        );
      }
      break;
    case "highlight_errors":
      break;
    default:
      console.log("Unknown agent action:", action.type);
  }
}

// ---- Data Completeness ----

async function loadCompleteness(): Promise<void> {
  const container = document.getElementById("completeness-stats");
  if (!container) return;

  try {
    await Excel.run(async (context: any) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      const usedRange = sheet.getUsedRange();
      usedRange.load("values");
      await context.sync();

      const values = usedRange.values;
      let totalCells = 0;
      let filledCells = 0;

      for (const row of values) {
        for (const cell of row) {
          totalCells++;
          if (cell !== null && cell !== undefined && cell !== "") {
            filledCells++;
          }
        }
      }

      const pct =
        totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

      container.innerHTML = `
        <div class="merris-card">
          <div class="merris-card-header">Overall Completeness: ${pct}%</div>
          <div class="merris-progress">
            <div class="merris-progress-bar" style="width: ${pct}%"></div>
          </div>
          <p style="margin-top:8px; font-size:13px; color:var(--merris-text-secondary);">
            ${filledCells} / ${totalCells} cells populated
          </p>
        </div>
        <div class="merris-card">
          <div class="merris-card-header">Category Breakdown</div>
          <p style="font-size:13px; color:var(--merris-text-secondary);">
            Select a range containing metric labels to see category-level breakdown.
          </p>
        </div>
      `;
    });
  } catch {
    container.innerHTML = `
      <div class="merris-card">
        <p style="text-align:center; color:var(--merris-text-secondary); padding:16px 0;">
          Open a worksheet with ESG data to see completeness stats.
        </p>
      </div>
    `;
  }
}

// ---- Action buttons ----

function setupActionButtons(): void {
  const btnAutofill = document.getElementById("btn-autofill");
  if (btnAutofill) {
    btnAutofill.addEventListener("click", async () => {
      try {
        await Excel.run(async (context: any) => {
          const range = context.workbook.getSelectedRange();
          range.load("values,address");
          await context.sync();

          const metrics = range.values
            .flat()
            .filter((v: any) => typeof v === "string" && v.trim().length > 0);

          if (metrics.length === 0) {
            showNotification("Select cells containing metric names first.");
            return;
          }

          const result = await api.post<{ data_points: any[] }>(
            "/agent/auto-fill",
            { metrics }
          );

          await fillCellsFromDataPoints(context, range, result.data_points);
          await context.sync();
          showNotification(
            `Auto-filled ${result.data_points.length} data points.`
          );
        });
      } catch (err: any) {
        showNotification(`Auto-fill error: ${err.message || "Unknown error"}`);
      }
    });
  }

  const btnValidate = document.getElementById("btn-validate");
  if (btnValidate) {
    btnValidate.addEventListener("click", async () => {
      try {
        await Excel.run(async (context: any) => {
          const sheet = context.workbook.worksheets.getActiveWorksheet();
          const usedRange = sheet.getUsedRange();
          usedRange.load("values");
          await context.sync();

          const data = usedRange.values.map((row: any[]) => {
            const obj: Record<string, unknown> = {};
            row.forEach((cell, i) => {
              obj[`col_${i}`] = cell;
            });
            return obj;
          });

          const result = await api.post<{ results: any[] }>(
            "/agent/validate",
            { data }
          );

          const sheet2 = context.workbook.worksheets.getActiveWorksheet();
          for (const issue of result.results) {
            if (issue.cell) {
              const cell = sheet2.getRange(issue.cell);
              if (issue.severity === "error") {
                cell.format.fill.color = "#F87171";
              } else if (issue.severity === "warning") {
                cell.format.fill.color = "#FB923C";
              }
            }
          }

          await context.sync();
          showNotification(
            `Validation complete: ${result.results.length} issues found.`
          );
        });
      } catch (err: any) {
        showNotification(
          `Validation error: ${err.message || "Unknown error"}`
        );
      }
    });
  }
}

// ---- Helpers ----

async function fillCellsFromPayload(
  data: Array<{ cell: string; value: string | number; fill_type: string }>
): Promise<void> {
  await Excel.run(async (context: any) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    for (const item of data) {
      const cell = sheet.getRange(item.cell);
      cell.values = [[item.value]];
      applyFillColor(cell, item.fill_type);
    }
    await context.sync();
  });
}

async function fillCellsFromDataPoints(
  context: any,
  selectionRange: any,
  dataPoints: any[]
): Promise<void> {
  for (let i = 0; i < dataPoints.length; i++) {
    const dp = dataPoints[i];
    try {
      const targetCell = selectionRange
        .getCell(i % selectionRange.rowCount, 0)
        .getOffsetRange(0, 1);
      targetCell.values = [[dp.value !== null ? dp.value : ""]];
      applyFillColor(targetCell, dp.fill_type);

      if (dp.source) {
        context.workbook.comments.add(
          targetCell,
          `Source: ${dp.source}${dp.confidence ? ` (${dp.confidence} confidence)` : ""}`
        );
      }
    } catch {
      // Skip if range calculation fails
    }
  }
}

function applyFillColor(cell: any, fillType: string): void {
  switch (fillType) {
    case "auto-extracted":
      cell.format.fill.color = "#065F46";
      cell.format.font.color = "#34D399";
      break;
    case "calculated":
      cell.format.fill.color = "#1E3A5F";
      cell.format.font.color = "#60A5FA";
      break;
    case "needs-input":
      cell.format.fill.color = "#7C2D12";
      cell.format.font.color = "#FB923C";
      break;
  }
}

function showNotification(message: string): void {
  console.log("[Merris]", message);
  const existing = document.getElementById("merris-notification");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = "merris-notification";
  el.style.cssText = `
    position: fixed; bottom: 16px; left: 16px; right: 16px;
    padding: 10px 14px; background: var(--merris-bg-secondary);
    border: 1px solid var(--merris-border); border-radius: var(--merris-radius);
    color: var(--merris-text); font-size: 13px; z-index: 1000;
    box-shadow: var(--merris-shadow);
  `;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
