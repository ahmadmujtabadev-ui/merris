// @ts-nocheck
// PowerPoint add-in taskpane — Merris ESG Agent

import { ensureAuthenticated } from '../../../shared/auth';
import { api, listRecentExecutions } from '../../../shared/api-client';

declare const Office: any;
declare const PowerPoint: any;

// ── State ──────────────────────────────────────────────────────

let engagementId = localStorage.getItem('merris_engagement_id') ?? '';
let engagementName = '';
let selectedRunContent = '';
let selectedRunName = '';
let selectedDpIds = new Set<string>();
let dpData: Array<{ metric_id: string; metric_name: string; value: string | number | null; unit?: string }> = [];

// ── Boot ───────────────────────────────────────────────────────

Office.onReady(async (info: { host: string }) => {
  if (info.host !== 'PowerPoint') return;

  try { await ensureAuthenticated(); } catch { /* dev mode */ }

  await loadEngagementSelector();
});

// ── Engagement selector ────────────────────────────────────────

async function loadEngagementSelector() {
  const select = document.getElementById('engagement-select') as HTMLSelectElement;

  try {
    const data = await api.get<{ engagements: Array<{ id: string; name: string }> }>('/engagements');
    const engagements = (data as any).engagements ?? [];
    select.innerHTML = '<option value="">— no engagement —</option>' +
      engagements.map((e: any) => `<option value="${e.id}">${e.name}</option>`).join('');

    if (engagementId) {
      select.value = engagementId;
      const match = engagements.find((e: any) => e.id === engagementId);
      if (match) engagementName = match.name;
    }
  } catch {
    select.innerHTML = '<option value="">Could not load engagements</option>';
  }

  document.getElementById('btn-select')!.addEventListener('click', () => {
    engagementId = select.value;
    engagementName = select.options[select.selectedIndex]?.text ?? '';
    if (engagementId) localStorage.setItem('merris_engagement_id', engagementId);
    launchApp();
  });

  document.getElementById('btn-skip')!.addEventListener('click', () => {
    launchApp();
  });

  if (engagementId) launchApp();
}

// ── Main app ───────────────────────────────────────────────────

function launchApp() {
  document.getElementById('screen-selector')!.style.display = 'none';
  const app = document.getElementById('screen-app')!;
  app.style.display = 'flex';

  document.getElementById('header-engagement')!.textContent = engagementName || 'No engagement';

  setupTabs();
  setupSlidesTab();
  setupChartTab();
  setupBrandTab();
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
        p.style.display = 'none';
      });
      const panel = document.getElementById('panel-' + tab.dataset.tab);
      if (panel) { panel.classList.add('active'); panel.style.display = ''; }
    });
  });
}

// ── SLIDES TAB ────────────────────────────────────────────────

function setupSlidesTab() {
  loadRecentRuns();
  document.getElementById('btn-refresh-runs')!.addEventListener('click', loadRecentRuns);
  document.getElementById('btn-close-preview')!.addEventListener('click', closePreview);
  document.getElementById('btn-insert-title-slide')!.addEventListener('click', () => insertSlide('title'));
  document.getElementById('btn-insert-content-slide')!.addEventListener('click', () => insertSlide('content'));
  document.getElementById('btn-insert-both')!.addEventListener('click', () => insertSlide('both'));
}

async function loadRecentRuns() {
  const list = document.getElementById('runs-list')!;
  list.innerHTML = '<div class="m-empty">Loading…</div>';

  try {
    const data = await listRecentExecutions();
    const runs = (data.executions ?? [])
      .filter((e: any) => e.status === 'completed' && e.finalAnswer)
      .slice(0, 8);

    if (runs.length === 0) {
      list.innerHTML = '<div class="m-empty">No completed runs yet.</div>';
      return;
    }

    list.innerHTML = runs.map((run: any) => `
      <div class="m-exec-item" data-id="${run.id}" data-name="${escAttr(run.templateId ?? 'Agent run')}" data-content="${escAttr(run.finalAnswer ?? '')}">
        <div class="m-exec-dot" style="background:#16a34a;"></div>
        <div style="flex:1;min-width:0;">
          <div class="m-exec-name">${escHtml(run.templateId ?? 'Agent run')}</div>
          <div class="m-exec-meta">${formatDate(run.completedAt ?? run.startedAt)} · ${wordCount(run.finalAnswer ?? '')} words</div>
        </div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c4cac4" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>
    `).join('');

    list.querySelectorAll<HTMLElement>('.m-exec-item').forEach(item => {
      item.addEventListener('click', () => {
        selectedRunContent = item.dataset.content ?? '';
        selectedRunName = item.dataset.name ?? 'Agent run';
        showPreview();
      });
    });
  } catch {
    list.innerHTML = '<div class="m-empty">Could not load runs.</div>';
  }
}

function showPreview() {
  document.getElementById('slide-empty')!.style.display = 'none';
  const preview = document.getElementById('slide-preview')!;
  preview.style.display = 'block';
  document.getElementById('preview-run-name')!.textContent = selectedRunName;
  document.getElementById('preview-content')!.textContent =
    selectedRunContent.slice(0, 1000) + (selectedRunContent.length > 1000 ? '\n\n[… truncated]' : '');
}

function closePreview() {
  document.getElementById('slide-preview')!.style.display = 'none';
  document.getElementById('slide-empty')!.style.display = '';
  selectedRunContent = '';
}

async function insertSlide(mode: 'title' | 'content' | 'both') {
  if (!selectedRunContent) return;

  const btnId = mode === 'title' ? 'btn-insert-title-slide'
    : mode === 'content' ? 'btn-insert-content-slide'
    : 'btn-insert-both';
  const btn = document.getElementById(btnId) as HTMLButtonElement;
  const origText = btn.textContent!;
  btn.disabled = true;
  btn.textContent = 'Inserting…';

  try {
    await PowerPoint.run(async (context: any) => {
      const slides = context.presentation.slides;

      if (mode === 'title' || mode === 'both') {
        slides.add();
        await context.sync();
        const titleSlide = slides.getItemAt(slides.getCount().value - 1);
        addTitleShapes(titleSlide, selectedRunName, engagementName || 'ESG Report');
        await context.sync();
      }

      if (mode === 'content' || mode === 'both') {
        slides.add();
        await context.sync();
        const contentSlide = slides.getItemAt(slides.getCount().value - 1);
        addContentShapes(contentSlide, selectedRunName, selectedRunContent);
        await context.sync();
      }
    });

    showToast('Slide inserted successfully', true);
    closePreview();
  } catch (err: any) {
    showToast('Insert failed: ' + (err.message ?? 'unknown error'), false);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

function addTitleShapes(slide: any, title: string, subtitle: string) {
  // Title text box — large, centered
  slide.shapes.addTextBox(title, { left: 60, top: 120, width: 580, height: 80 } as any);
  slide.shapes.addTextBox(subtitle, { left: 60, top: 210, width: 580, height: 40 } as any);
  // Footer badge
  slide.shapes.addTextBox('Generated by Merris ESG · ' + new Date().toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }),
    { left: 60, top: 400, width: 580, height: 24 } as any);
}

function addContentShapes(slide: any, title: string, body: string) {
  slide.shapes.addTextBox(title, { left: 60, top: 30, width: 580, height: 50 } as any);

  // Build bullet list from content lines
  const lines = body.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .slice(0, 20);
  const bulletText = lines.map(l => (l.startsWith('-') ? l : '• ' + l)).join('\n');

  slide.shapes.addTextBox(bulletText, { left: 60, top: 90, width: 580, height: 330 } as any);
}

// ── CHART TAB ─────────────────────────────────────────────────

function setupChartTab() {
  loadDataPoints();
  document.getElementById('btn-refresh-dp')!.addEventListener('click', loadDataPoints);
  document.getElementById('btn-insert-chart')!.addEventListener('click', insertChart);
}

async function loadDataPoints() {
  const list = document.getElementById('dp-list')!;
  list.innerHTML = '<div class="m-empty">Loading…</div>';
  selectedDpIds.clear();
  updateChartBtn();

  if (!engagementId) {
    list.innerHTML = '<div class="m-empty">Connect to an engagement to load data points.</div>';
    return;
  }

  try {
    const data = await api.get<any>(`/engagements/${engagementId}/data-points`);
    dpData = (data.dataPoints ?? data.data_points ?? []).slice(0, 20);

    if (dpData.length === 0) {
      list.innerHTML = '<div class="m-empty">No data points found.</div>';
      return;
    }

    list.innerHTML = dpData.map(dp => `
      <div class="m-dp-item" data-id="${escAttr(dp.metric_id)}" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--border);cursor:pointer;">
        <div class="m-dp-check" id="chk-${escAttr(dp.metric_id)}" style="width:14px;height:14px;border:1.5px solid var(--border);border-radius:3px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"></div>
        <div style="flex:1;font-size:11px;color:var(--text);">${escHtml(dp.metric_name)}</div>
        <div style="font-size:10px;font-family:monospace;color:var(--text-sec);">${dp.value != null ? String(dp.value) : '—'} ${dp.unit ?? ''}</div>
      </div>
    `).join('');

    list.querySelectorAll<HTMLElement>('.m-dp-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id!;
        const chk = document.getElementById('chk-' + id)!;
        if (selectedDpIds.has(id)) {
          selectedDpIds.delete(id);
          chk.style.background = '';
          chk.style.borderColor = 'var(--border)';
          chk.innerHTML = '';
        } else {
          selectedDpIds.add(id);
          chk.style.background = 'var(--primary)';
          chk.style.borderColor = 'var(--primary)';
          chk.innerHTML = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
        }
        updateChartBtn();
      });
    });
  } catch {
    list.innerHTML = '<div class="m-empty">Could not load data points.</div>';
  }
}

function updateChartBtn() {
  const btn = document.getElementById('btn-insert-chart') as HTMLButtonElement;
  btn.disabled = selectedDpIds.size === 0;
}

async function insertChart() {
  const btn = document.getElementById('btn-insert-chart') as HTMLButtonElement;
  const status = document.getElementById('chart-status')!;
  const chartType = (document.getElementById('chart-type-select') as HTMLSelectElement).value;

  btn.disabled = true;
  btn.innerHTML = '<span class="m-spinner"></span> Inserting…';
  status.textContent = '';

  try {
    const selected = dpData.filter(dp => selectedDpIds.has(dp.metric_id));
    const labels = selected.map(dp => dp.metric_name.slice(0, 20));
    const values = selected.map(dp => Number(dp.value) || 0);

    // Build an SVG chart and insert as image
    const svg = buildChartSVG(chartType, labels, values, selected.map(dp => dp.unit ?? ''));

    await PowerPoint.run(async (context: any) => {
      const slide = context.presentation.getSelectedSlides().getItemAt(0);
      const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
      const base64 = await blobToBase64(svgBlob);
      (slide.shapes as any).addImage(base64);
      await context.sync();
    });

    status.innerHTML = '<span style="color:var(--green);font-size:11px;font-weight:600;">✓ Chart inserted on slide</span>';
  } catch (err: any) {
    status.innerHTML = `<span style="color:var(--red);font-size:11px;">Error: ${escHtml(err.message ?? 'unknown')}</span>`;
  } finally {
    btn.disabled = selectedDpIds.size === 0;
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Insert chart on slide`;
  }
}

function buildChartSVG(type: string, labels: string[], values: number[], units: string[]): string {
  const W = 420, H = 220;
  const PAD = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const max = Math.max(...values, 1);

  const COLORS = ['#0b5142', '#16a34a', '#15803d', '#166534', '#065f46'];

  if (type === 'pie' && values.length > 0) {
    return buildPieSVG(W, H, labels, values, COLORS);
  }

  // Bar chart (default for bar/waterfall; line for line)
  const barW = Math.min(chartW / labels.length - 8, 40);
  let bars = '';
  let xLabels = '';
  let yLabels = '';

  // Y axis labels
  for (let i = 0; i <= 4; i++) {
    const val = (max * i) / 4;
    const y = PAD.top + chartH - (chartH * i) / 4;
    yLabels += `<text x="${PAD.left - 6}" y="${y + 4}" text-anchor="end" font-size="9" fill="#9aa0a6">${formatNum(val)}</text>`;
    bars += `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + chartW}" y2="${y}" stroke="#e8eae8" stroke-width="1"/>`;
  }

  labels.forEach((label, i) => {
    const x = PAD.left + (chartW / labels.length) * i + (chartW / labels.length - barW) / 2;
    const barH = (values[i] / max) * chartH;
    const y = PAD.top + chartH - barH;
    const color = COLORS[i % COLORS.length];

    if (type === 'line') {
      if (i > 0) {
        const px = PAD.left + (chartW / labels.length) * (i - 1) + chartW / labels.length / 2;
        const py = PAD.top + chartH - (values[i - 1] / max) * chartH;
        const cx = PAD.left + (chartW / labels.length) * i + chartW / labels.length / 2;
        const cy = y;
        bars += `<line x1="${px}" y1="${py}" x2="${cx}" y2="${cy}" stroke="${COLORS[0]}" stroke-width="2"/>`;
      }
      bars += `<circle cx="${PAD.left + (chartW / labels.length) * i + chartW / labels.length / 2}" cy="${y}" r="4" fill="${color}"/>`;
    } else {
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="3"/>`;
    }

    const labelX = PAD.left + (chartW / labels.length) * i + chartW / labels.length / 2;
    xLabels += `<text x="${labelX}" y="${H - PAD.bottom + 14}" text-anchor="middle" font-size="9" fill="#5f6368">${escHtml(label.slice(0, 12))}</text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:white;border-radius:8px;">
    <rect width="${W}" height="${H}" fill="white" rx="8"/>
    ${bars}${yLabels}${xLabels}
    <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + chartH}" stroke="#e8eae8" stroke-width="1"/>
  </svg>`;
}

function buildPieSVG(W: number, H: number, labels: string[], values: number[], colors: string[]): string {
  const cx = W / 2, cy = H / 2 - 10, r = Math.min(W, H) / 2 - 30;
  const total = values.reduce((a, b) => a + b, 0);
  let startAngle = -Math.PI / 2;
  let slices = '';
  let legend = '';

  values.forEach((val, i) => {
    const angle = (val / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    slices += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z" fill="${colors[i % colors.length]}"/>`;
    legend += `<rect x="10" y="${10 + i * 16}" width="10" height="10" fill="${colors[i % colors.length]}" rx="2"/>
      <text x="24" y="${19 + i * 16}" font-size="9" fill="#5f6368">${escHtml(labels[i].slice(0, 18))}</text>`;
    startAngle = endAngle;
  });

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="white" rx="8"/>
    ${slices}${legend}
  </svg>`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toFixed(0);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── BRAND TAB ─────────────────────────────────────────────────

let brands: any[] = [];

function setupBrandTab() {
  loadBrands();

  document.getElementById('brand-select')!.addEventListener('change', (e) => {
    const sel = e.target as HTMLSelectElement;
    const brand = brands.find(b => b.id === sel.value);
    const preview = document.getElementById('brand-preview')!;
    const applyBtn = document.getElementById('btn-apply-brand') as HTMLButtonElement;

    if (brand) {
      preview.style.display = 'block';
      applyBtn.disabled = false;
      // Swatches
      const swatches = document.getElementById('brand-swatches')!;
      swatches.innerHTML = Object.entries(brand.colors ?? {}).slice(0, 4).map(([, c]) =>
        `<div class="m-swatch" style="background:${c};" title="${c}"></div>`
      ).join('');
      document.getElementById('brand-font-heading')!.textContent = brand.font_heading ?? '—';
      document.getElementById('brand-font-body')!.textContent = brand.font_body ?? '—';
    } else {
      preview.style.display = 'none';
      applyBtn.disabled = true;
    }
  });

  document.getElementById('btn-apply-brand')!.addEventListener('click', () => {
    const sel = document.getElementById('brand-select') as HTMLSelectElement;
    const brand = brands.find(b => b.id === sel.value);
    if (brand) applyBranding(brand.colors?.primary ?? '#0b5142', brand.font_body ?? 'Segoe UI');
  });

  document.getElementById('btn-apply-merris')!.addEventListener('click', () => {
    applyBranding('#0b5142', 'Segoe UI');
  });
}

async function loadBrands() {
  const sel = document.getElementById('brand-select') as HTMLSelectElement;
  try {
    const data = await api.get<{ brands: any[] }>('/brands');
    brands = data.brands ?? [];
    if (brands.length === 0) {
      sel.innerHTML = '<option value="">No brand profiles found</option>';
    } else {
      sel.innerHTML = '<option value="">— select brand —</option>' +
        brands.map(b => `<option value="${b.id}">${escHtml(b.name)}</option>`).join('');
    }
  } catch {
    sel.innerHTML = '<option value="">Could not load brands</option>';
  }
}

async function applyBranding(primaryColor: string, fontName: string) {
  const btn = document.getElementById('btn-apply-brand') as HTMLButtonElement;
  const merrisBtn = document.getElementById('btn-apply-merris') as HTMLButtonElement;
  const status = document.getElementById('brand-status')!;
  btn.disabled = true;
  merrisBtn.disabled = true;
  status.innerHTML = '<span class="m-spinner"></span> Applying branding…';

  try {
    await PowerPoint.run(async (context: any) => {
      const slides = context.presentation.slides;
      slides.load('items');
      await context.sync();

      for (const slide of slides.items) {
        slide.shapes.load('items');
        await context.sync();

        for (const shape of slide.shapes.items) {
          try {
            if (shape.textFrame) {
              shape.textFrame.load('textRange');
              await context.sync();
              const tf = shape.textFrame.textRange;
              if (tf && tf.font) {
                tf.font.color = primaryColor;
                tf.font.name = fontName;
              }
            }
          } catch { /* some shapes may not have textFrame */ }
        }
      }

      await context.sync();
    });

    status.innerHTML = '<span style="color:var(--green);font-weight:600;">✓ Branding applied to all slides</span>';
  } catch (err: any) {
    status.innerHTML = `<span style="color:var(--red);">Error: ${escHtml(err.message ?? 'unknown')}</span>`;
  } finally {
    btn.disabled = false;
    merrisBtn.disabled = false;
  }
}

// ── Helpers ────────────────────────────────────────────────────

function showToast(msg: string, ok: boolean) {
  const existing = document.getElementById('merris-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'merris-toast';
  el.className = 'm-toast';
  el.style.background = ok ? 'var(--green)' : 'var(--red)';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s: string): string {
  return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;').slice(0, 4000);
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
