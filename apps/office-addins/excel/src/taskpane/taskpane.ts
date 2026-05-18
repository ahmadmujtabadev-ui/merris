// @ts-nocheck
// Excel add-in taskpane — Merris ESG Agent

import { ensureAuthenticated } from '../../../shared/auth';
import { api, listRecentExecutions } from '../../../shared/api-client';

declare const Office: any;
declare const Excel: any;

// ── State ──────────────────────────────────────────────────────

let engagementId = localStorage.getItem('merris_engagement_id') ?? '';
let engagementName = '';

interface DataPoint {
  _id: string;
  metricName: string;
  value: string | number;
  unit: string;
  frameworkRef: string;
  status: string;
  confidence: string;
}

let dataPoints: DataPoint[] = [];
let selectedDpIds = new Set<string>();

// ── Boot ───────────────────────────────────────────────────────

Office.onReady(async (info: { host: string }) => {
  if (info.host !== 'Excel' && info.host !== 'Workbook') return;
  try { await ensureAuthenticated(); } catch { /* dev */ }
  await loadEngagementSelector();
});

// ── Engagement selector ────────────────────────────────────────

async function loadEngagementSelector() {
  const sel = document.getElementById('engagement-select') as HTMLSelectElement;

  try {
    const data = await api.get<{ engagements: Array<{ id: string; name: string }> }>('/engagements');
    const engagements = (data as any).engagements ?? [];
    sel.innerHTML = '<option value="">— no engagement —</option>' +
      engagements.map((e: any) => `<option value="${e.id}">${e.name}</option>`).join('');
    if (engagementId) {
      sel.value = engagementId;
      const match = engagements.find((e: any) => e.id === engagementId);
      if (match) engagementName = match.name;
    }
  } catch {
    sel.innerHTML = '<option value="">Could not load engagements</option>';
  }

  document.getElementById('btn-select')!.addEventListener('click', () => {
    engagementId = sel.value;
    engagementName = sel.options[sel.selectedIndex]?.text ?? '';
    if (engagementId) localStorage.setItem('merris_engagement_id', engagementId);
    launchApp();
  });
  document.getElementById('btn-skip')!.addEventListener('click', launchApp);

  if (engagementId) launchApp();
}

// ── Main app ───────────────────────────────────────────────────

function launchApp() {
  document.getElementById('screen-selector')!.style.display = 'none';
  const app = document.getElementById('screen-app')!;
  app.style.display = 'flex';
  document.getElementById('header-engagement')!.textContent = engagementName || 'No engagement';

  setupTabs();
  setupDataTab();
  setupInsertTab();
  setupValidateTab();
  loadSheetCompleteness();
}

// ── Tab switching ──────────────────────────────────────────────

function setupTabs() {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.m-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll<HTMLElement>('.m-panel').forEach(p => {
        p.classList.remove('active');
      });
      const panel = document.getElementById('panel-' + tab.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });
}

// ── DATA TAB ──────────────────────────────────────────────────

function setupDataTab() {
  document.getElementById('btn-refresh-dp')!.addEventListener('click', loadDataPoints);
  loadDataPoints();
}

async function loadDataPoints() {
  const list = document.getElementById('dp-list')!;
  list.innerHTML = '<div class="m-empty"><span class="m-spinner"></span> Loading…</div>';

  try {
    if (!engagementId) {
      list.innerHTML = '<div class="m-empty">Connect an engagement to see data points.</div>';
      return;
    }
    const data = await api.get<{ dataPoints: DataPoint[] }>(`/engagements/${engagementId}/data-points`);
    dataPoints = (data as any).dataPoints ?? [];

    document.getElementById('stat-total')!.textContent = String(dataPoints.length);
    const confirmed = dataPoints.filter(d => d.status === 'user_confirmed' || d.status === 'auto_extracted').length;
    document.getElementById('stat-complete')!.textContent = String(confirmed);

    if (dataPoints.length === 0) {
      list.innerHTML = '<div class="m-empty">No data points found. Process a document first.</div>';
      return;
    }

    list.innerHTML = dataPoints.map(dp => `
      <div class="m-dp-item" data-id="${dp._id}">
        <div class="m-dp-check ${selectedDpIds.has(dp._id) ? 'checked' : ''}" data-id="${dp._id}">
          ${selectedDpIds.has(dp._id) ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
        </div>
        <div class="m-dp-metric">${escHtml(dp.metricName)}</div>
        <div class="m-dp-value">${dp.value != null ? escHtml(String(dp.value)) : '—'} <span style="color:var(--text-ter)">${escHtml(dp.unit ?? '')}</span></div>
      </div>
    `).join('');

    list.querySelectorAll<HTMLElement>('.m-dp-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id!;
        if (selectedDpIds.has(id)) selectedDpIds.delete(id);
        else selectedDpIds.add(id);
        loadDataPoints(); // re-render
      });
    });
  } catch (err: any) {
    list.innerHTML = `<div class="m-empty" style="color:#dc2626;">Failed to load: ${escHtml(err.message ?? '')}</div>`;
  }
}

// ── Sheet completeness ─────────────────────────────────────────

async function loadSheetCompleteness() {
  try {
    await Excel.run(async (ctx: any) => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet();
      const used = sheet.getUsedRange();
      used.load('values');
      await ctx.sync();

      const vals = used.values;
      let total = 0; let filled = 0;
      for (const row of vals) {
        for (const cell of row) {
          total++;
          if (cell !== null && cell !== undefined && cell !== '') filled++;
        }
      }
      const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

      const card = document.getElementById('completeness-card')!;
      card.style.display = 'block';
      document.getElementById('completeness-pct')!.textContent = pct + '%';
      (document.getElementById('completeness-bar') as HTMLElement).style.width = pct + '%';
      document.getElementById('completeness-detail')!.textContent = `${filled} / ${total} cells filled`;
    });
  } catch { /* outside Office */ }
}

// ── INSERT TAB ────────────────────────────────────────────────

function setupInsertTab() {
  document.getElementById('btn-insert-table')!.addEventListener('click', () => insertSelectedAsTable());
  document.getElementById('btn-insert-list')!.addEventListener('click', () => insertSelectedAsList());
  document.getElementById('btn-autofill')!.addEventListener('click', () => autoFillSelected());
  document.getElementById('btn-insert-run')!.addEventListener('click', () => insertRunOutput());

  loadRunsForSelect();
}

async function loadRunsForSelect() {
  const sel = document.getElementById('runs-select') as HTMLSelectElement;
  try {
    const data = await listRecentExecutions();
    const runs = (data.executions ?? []).filter((e: any) => e.status === 'completed').slice(0, 10);
    sel.innerHTML = '<option value="">— pick a run —</option>' +
      runs.map((r: any) => `<option value="${escAttr(r.finalAnswer ?? '')}" data-name="${escAttr(r.templateId ?? 'Run')}">${escHtml(r.templateId ?? 'Run')} · ${formatDate(r.completedAt)}</option>`).join('');
  } catch {
    sel.innerHTML = '<option value="">Could not load runs</option>';
  }
}

async function insertSelectedAsTable() {
  const selected = dataPoints.filter(dp => selectedDpIds.has(dp._id));
  if (selected.length === 0) { showToast('Select data points in the Data tab first.', false); return; }

  const btn = document.getElementById('btn-insert-table') as HTMLButtonElement;
  btn.disabled = true; btn.textContent = 'Inserting…';

  try {
    await Excel.run(async (ctx: any) => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet();
      const sel = ctx.workbook.getSelectedRange();
      sel.load('address,rowIndex,columnIndex');
      await ctx.sync();

      const startRow = sel.rowIndex;
      const startCol = sel.columnIndex;

      // Header row
      const headers = sheet.getRangeByIndexes(startRow, startCol, 1, 5);
      headers.values = [['Metric', 'Value', 'Unit', 'Framework', 'Status']];
      headers.format.fill.color = '#0B5142';
      headers.format.font.color = '#FFFFFF';
      headers.format.font.bold = true;

      // Data rows
      const dataRows = selected.map(dp => [
        dp.metricName, dp.value ?? '', dp.unit ?? '', dp.frameworkRef ?? '', dp.status ?? '',
      ]);
      const dataRange = sheet.getRangeByIndexes(startRow + 1, startCol, dataRows.length, 5);
      dataRange.values = dataRows;

      // Alternating row color
      for (let i = 0; i < dataRows.length; i++) {
        const row = sheet.getRangeByIndexes(startRow + 1 + i, startCol, 1, 5);
        row.format.fill.color = i % 2 === 0 ? '#F0F6F0' : '#FFFFFF';
      }

      // Auto-fit columns
      for (let c = startCol; c < startCol + 5; c++) {
        sheet.getRangeByIndexes(startRow, c, dataRows.length + 1, 1).format.autofitColumns();
      }

      await ctx.sync();
    });
    showToast(`✓ Inserted table with ${selected.length} rows`, true);
  } catch (err: any) {
    showToast('Insert failed: ' + (err.message ?? ''), false);
  } finally {
    btn.disabled = false; btn.textContent = 'Insert as table';
  }
}

async function insertSelectedAsList() {
  const selected = dataPoints.filter(dp => selectedDpIds.has(dp._id));
  if (selected.length === 0) { showToast('Select data points first.', false); return; }

  try {
    await Excel.run(async (ctx: any) => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet();
      const sel = ctx.workbook.getSelectedRange();
      sel.load('rowIndex,columnIndex');
      await ctx.sync();

      for (let i = 0; i < selected.length; i++) {
        const dp = selected[i];
        const row = sheet.getRangeByIndexes(sel.rowIndex + i, sel.columnIndex, 1, 3);
        row.values = [[dp.metricName, dp.value ?? '', dp.unit ?? '']];
      }
      await ctx.sync();
    });
    showToast(`✓ Inserted ${selected.length} rows`, true);
  } catch (err: any) {
    showToast('Insert failed: ' + (err.message ?? ''), false);
  }
}

async function autoFillSelected() {
  const btn = document.getElementById('btn-autofill') as HTMLButtonElement;
  btn.disabled = true; btn.textContent = 'Filling…';
  try {
    await Excel.run(async (ctx: any) => {
      const range = ctx.workbook.getSelectedRange();
      range.load('values,rowIndex,columnIndex');
      await ctx.sync();

      const metrics = range.values.flat().filter((v: any) => typeof v === 'string' && v.trim().length > 0);
      if (metrics.length === 0) { showToast('Select cells with metric names first.', false); return; }

      const result = await api.post<{ data_points: any[] }>('/agent/auto-fill', { metrics });
      const dps = result.data_points ?? [];

      for (let i = 0; i < dps.length; i++) {
        const dp = dps[i];
        if (dp.value != null) {
          const cell = ctx.workbook.worksheets.getActiveWorksheet().getRangeByIndexes(range.rowIndex + i, range.columnIndex + 1, 1, 1);
          cell.values = [[dp.value]];
          cell.format.fill.color = dp.fill_type === 'auto-extracted' ? '#F0F6F0' : '#FFFBEB';
        }
      }
      await ctx.sync();
      showToast(`✓ Auto-filled ${dps.length} values`, true);
    });
  } catch (err: any) {
    showToast('Auto-fill failed: ' + (err.message ?? ''), false);
  } finally {
    btn.disabled = false; btn.textContent = 'Auto-fill selected cells';
  }
}

async function insertRunOutput() {
  const sel = document.getElementById('runs-select') as HTMLSelectElement;
  const content = sel.value;
  const name = sel.options[sel.selectedIndex]?.dataset.name ?? 'Run output';
  if (!content) { showToast('Select a workflow run first.', false); return; }

  try {
    await Excel.run(async (ctx: any) => {
      // Create a new sheet for the run output
      const sheetName = name.slice(0, 30).replace(/[\\\/\*\?\[\]]/g, '-');
      let sheet: any;
      try {
        sheet = ctx.workbook.worksheets.add(sheetName);
      } catch {
        sheet = ctx.workbook.worksheets.getActiveWorksheet();
      }

      const lines = content.split('\n').slice(0, 500);
      const rows = lines.map((line: string) => [line]);
      if (rows.length > 0) {
        const range = sheet.getRangeByIndexes(0, 0, rows.length, 1);
        range.values = rows;
        range.format.autofitColumns();
      }

      sheet.activate();
      await ctx.sync();
    });
    showToast('✓ Run output inserted as new sheet', true);
  } catch (err: any) {
    showToast('Insert failed: ' + (err.message ?? ''), false);
  }
}

// ── VALIDATE TAB ──────────────────────────────────────────────

function setupValidateTab() {
  document.getElementById('btn-validate')!.addEventListener('click', runValidation);
  document.getElementById('btn-clear-highlights')!.addEventListener('click', clearHighlights);
}

async function runValidation() {
  const btn = document.getElementById('btn-validate') as HTMLButtonElement;
  const results = document.getElementById('validation-results')!;
  btn.disabled = true; btn.textContent = 'Validating…';
  results.innerHTML = '<div class="m-empty"><span class="m-spinner"></span></div>';

  try {
    await Excel.run(async (ctx: any) => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet();
      const used = sheet.getUsedRange();
      used.load('values,address');
      await ctx.sync();

      const data = used.values.map((row: any[]) => {
        const obj: Record<string, unknown> = {};
        row.forEach((cell, i) => { obj[`col_${i}`] = cell; });
        return obj;
      });

      const result = await api.post<{ results: any[] }>('/agent/validate', { data });
      const issues = result.results ?? [];

      if (issues.length === 0) {
        results.innerHTML = '<div class="m-empty" style="color:var(--green);">✓ No issues found.</div>';
        return;
      }

      // Highlight cells
      for (const issue of issues) {
        if (issue.cell) {
          const cell = sheet.getRange(issue.cell);
          cell.format.fill.color = issue.severity === 'error' ? '#FEE2E2' : '#FEF3C7';
        }
      }
      await ctx.sync();

      results.innerHTML = issues.slice(0, 15).map((i: any) => `
        <div class="m-card" style="margin:6px 10px;padding:8px 12px;border-left:3px solid ${i.severity === 'error' ? 'var(--red)' : 'var(--amber)'};">
          <div style="font-size:10px;font-weight:700;font-family:monospace;color:${i.severity === 'error' ? 'var(--red)' : 'var(--amber)'};">${i.cell ?? ''}</div>
          <div style="font-size:11px;margin-top:2px;">${escHtml(i.message ?? '')}</div>
          ${i.suggestion ? `<div style="font-size:10px;color:var(--text-sec);margin-top:3px;">${escHtml(i.suggestion)}</div>` : ''}
        </div>
      `).join('');
    });
  } catch (err: any) {
    results.innerHTML = `<div class="m-empty" style="color:#dc2626;">Validation failed: ${escHtml(err.message ?? '')}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Validate active sheet';
  }
}

async function clearHighlights() {
  try {
    await Excel.run(async (ctx: any) => {
      const sheet = ctx.workbook.worksheets.getActiveWorksheet();
      const used = sheet.getUsedRange();
      used.format.fill.clear();
      await ctx.sync();
    });
    showToast('✓ Highlights cleared', true);
  } catch { /* silently fail */ }
}

// ── Helpers ────────────────────────────────────────────────────

function showToast(msg: string, ok: boolean) {
  const existing = document.getElementById('merris-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'merris-toast';
  el.className = 'm-toast';
  el.style.background = ok ? '#15803d' : '#dc2626';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s: string): string {
  return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;').slice(0, 3000);
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
}
