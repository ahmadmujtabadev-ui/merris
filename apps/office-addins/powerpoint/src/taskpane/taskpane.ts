// @ts-nocheck
/**
 * Merris PowerPoint Add-in Taskpane
 *
 * Insert ESG charts, generate slides from templates, and apply branding.
 */

import { api } from "../../../shared/api-client";
import { ensureAuthenticated } from "../../../shared/auth";
import { AgentPanel } from "../../../shared/agent-panel";

// Import template specs
import kpiDashboard from "../templates/kpi-dashboard.json";
import ghgWaterfall from "../templates/ghg-waterfall.json";
import yoyComparison from "../templates/yoy-comparison.json";
import materialityMatrix from "../templates/materiality-matrix.json";
import complianceStatus from "../templates/compliance-status.json";
import roadmapTimeline from "../templates/roadmap-timeline.json";

// ----- Types -----

interface Engagement {
  id: string;
  name: string;
  client_name: string;
}

interface Metric {
  id: string;
  name: string;
  category: string;
  unit: string;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color?: string;
  }>;
}

interface BrandProfile {
  id: string;
  name: string;
  colors: { primary: string; secondary: string; accent: string; background: string };
  font_heading: string;
  font_body: string;
  logo_url?: string;
}

interface SlideTemplate {
  id: string;
  name: string;
  description: string;
  layout: string;
  placeholders: Array<{
    id: string;
    type: "title" | "chart" | "text" | "image" | "table";
    position: { x: number; y: number; width: number; height: number };
    dataBinding?: string;
  }>;
}

// ----- Template Registry -----

const templateSpecs: Record<string, SlideTemplate> = {
  "kpi-dashboard": kpiDashboard as unknown as SlideTemplate,
  "ghg-waterfall": ghgWaterfall as unknown as SlideTemplate,
  "yoy-comparison": yoyComparison as unknown as SlideTemplate,
  "materiality-matrix": materialityMatrix as unknown as SlideTemplate,
  "compliance-status": complianceStatus as unknown as SlideTemplate,
  "roadmap-timeline": roadmapTimeline as unknown as SlideTemplate,
};

// ----- State -----

let engagements: Engagement[] = [];
let metrics: Metric[] = [];
let brands: BrandProfile[] = [];
let selectedChartData: ChartData | null = null;

// ----- Initialization -----

Office.onReady(async (info) => {
  if (info.host !== Office.HostType.PowerPoint) return;

  await ensureAuthenticated();
  await loadEngagements();
  await loadBrands();

  initTabs();
  initChartPanel();
  initSlidePanel();
  initBrandPanel();

  // Agent panel
  const agentContainer = document.getElementById("agent-container")!;
  new AgentPanel({
    parentElement: agentContainer,
    context: { addin: "powerpoint" },
    onAction: handleAgentAction,
  });
});

// ----- Tab Navigation -----

function initTabs(): void {
  const tabBtns = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  const tabContents = document.querySelectorAll<HTMLElement>(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab!;

      tabBtns.forEach((b) => {
        b.classList.remove("active");
        b.className = b.className.replace("merris-btn-primary", "merris-btn-secondary");
      });
      btn.classList.add("active");
      btn.className = btn.className.replace("merris-btn-secondary", "merris-btn-primary");

      tabContents.forEach((tc) => (tc.style.display = "none"));
      document.getElementById(`${tabId}-panel`)!.style.display = "block";
    });
  });
}

// ----- Data Loading -----

async function loadEngagements(): Promise<void> {
  try {
    const result = await api.get<{ engagements: Engagement[] }>("/engagements");
    engagements = result.engagements;

    const selects = document.querySelectorAll<HTMLSelectElement>(
      "#engagement-select, #slide-engagement"
    );
    selects.forEach((sel) => {
      engagements.forEach((eng) => {
        const opt = document.createElement("option");
        opt.value = eng.id;
        opt.textContent = `${eng.client_name} - ${eng.name}`;
        sel.appendChild(opt);
      });
    });
  } catch (err) {
    console.error("Failed to load engagements:", err);
  }
}

async function loadMetrics(engagementId: string): Promise<void> {
  try {
    const result = await api.get<{ metrics: Metric[] }>(
      `/engagements/${engagementId}/metrics`
    );
    metrics = result.metrics;

    const sel = document.getElementById("metric-select") as HTMLSelectElement;
    sel.innerHTML = '<option value="">Select metric...</option>';
    metrics.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.name} (${m.unit})`;
      sel.appendChild(opt);
    });
    sel.disabled = false;
  } catch (err) {
    console.error("Failed to load metrics:", err);
  }
}

async function loadBrands(): Promise<void> {
  try {
    const result = await api.get<{ brands: BrandProfile[] }>("/brands");
    brands = result.brands;

    const sel = document.getElementById("brand-select") as HTMLSelectElement;
    brands.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.name;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load brands:", err);
  }
}

// ----- Chart Panel -----

function initChartPanel(): void {
  const engSelect = document.getElementById("engagement-select") as HTMLSelectElement;
  const metricSelect = document.getElementById("metric-select") as HTMLSelectElement;
  const chartType = document.getElementById("chart-type") as HTMLSelectElement;
  const insertBtn = document.getElementById("insert-chart-btn") as HTMLButtonElement;

  engSelect.addEventListener("change", async () => {
    if (engSelect.value) {
      await loadMetrics(engSelect.value);
    }
  });

  metricSelect.addEventListener("change", async () => {
    if (metricSelect.value) {
      await loadChartPreview(metricSelect.value, chartType.value);
      insertBtn.disabled = false;
    }
  });

  chartType.addEventListener("change", async () => {
    if (metricSelect.value) {
      await loadChartPreview(metricSelect.value, chartType.value);
    }
  });

  insertBtn.addEventListener("click", insertChartOnSlide);
}

async function loadChartPreview(metricId: string, chartType: string): Promise<void> {
  const previewEl = document.getElementById("chart-preview")!;
  previewEl.innerHTML = '<div class="merris-loading"><span class="merris-spinner"></span> Loading...</div>';

  try {
    const result = await api.get<{ chart_data: ChartData; svg: string }>(
      `/metrics/${metricId}/chart?type=${chartType}`
    );
    selectedChartData = result.chart_data;
    previewEl.innerHTML = result.svg;
  } catch (err: any) {
    // Generate a placeholder SVG preview
    selectedChartData = {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [{ label: "Data", data: [25, 40, 35, 60], color: "#1a7a4c" }],
    };
    previewEl.innerHTML = generatePlaceholderSVG(chartType, selectedChartData);
  }
}

function generatePlaceholderSVG(type: string, data: ChartData): string {
  const w = 380;
  const h = 200;
  const maxVal = Math.max(...data.datasets[0].data);
  const barWidth = w / data.labels.length - 10;

  let bars = "";
  data.datasets[0].data.forEach((val, i) => {
    const barH = (val / maxVal) * (h - 40);
    const x = i * (barWidth + 10) + 10;
    const y = h - barH - 20;
    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="#1a7a4c" rx="3" />`;
    bars += `<text x="${x + barWidth / 2}" y="${h - 5}" text-anchor="middle" font-size="11" fill="#757575">${data.labels[i]}</text>`;
  });

  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">${bars}</svg>`;
}

async function insertChartOnSlide(): Promise<void> {
  const statusEl = document.getElementById("chart-status")!;
  const previewEl = document.getElementById("chart-preview")!;
  const svgContent = previewEl.innerHTML;

  if (!svgContent) return;

  statusEl.innerHTML = '<div class="merris-loading"><span class="merris-spinner"></span> Inserting...</div>';

  try {
    // Convert SVG to base64 for insertion
    const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
    const base64 = await blobToBase64(svgBlob);

    await PowerPoint.run(async (context) => {
      const slide = context.presentation.getSelectedSlides().getItemAt(0);
      // addImage may not be in all type definition versions; cast to any
      (slide.shapes as any).addImage(base64);
      await context.sync();
    });

    statusEl.innerHTML = '<div class="merris-badge merris-badge-success">Chart inserted</div>';
  } catch (err: any) {
    statusEl.innerHTML = `<div class="merris-error-msg">Error: ${err.message}</div>`;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the data URL prefix to get raw base64
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ----- Slide Panel -----

function initSlidePanel(): void {
  const templateSelect = document.getElementById("template-select") as HTMLSelectElement;
  const generateBtn = document.getElementById("generate-slide-btn") as HTMLButtonElement;
  const engSelect = document.getElementById("slide-engagement") as HTMLSelectElement;

  templateSelect.addEventListener("change", () => {
    const templateId = templateSelect.value;
    const previewEl = document.getElementById("template-preview")!;

    if (templateId && templateSpecs[templateId]) {
      const spec = templateSpecs[templateId];
      previewEl.style.display = "block";
      document.getElementById("template-name")!.textContent = spec.name;
      document.getElementById("template-desc")!.textContent = spec.description;
    } else {
      previewEl.style.display = "none";
    }

    generateBtn.disabled = !(templateId && engSelect.value);
  });

  engSelect.addEventListener("change", () => {
    generateBtn.disabled = !(templateSelect.value && engSelect.value);
  });

  generateBtn.addEventListener("click", generateSlide);
}

async function generateSlide(): Promise<void> {
  const statusEl = document.getElementById("slide-status")!;
  const templateId = (document.getElementById("template-select") as HTMLSelectElement).value;
  const engagementId = (document.getElementById("slide-engagement") as HTMLSelectElement).value;

  statusEl.innerHTML = '<div class="merris-loading"><span class="merris-spinner"></span> Generating...</div>';

  try {
    // Fetch populated slide data from API
    const result = await api.post<{ slide_xml: string; title: string }>("/slides/generate", {
      template_id: templateId,
      engagement_id: engagementId,
    });

    await PowerPoint.run(async (context) => {
      // Add a new slide
      const slides = context.presentation.slides;
      slides.add();
      await context.sync();

      // Get the newly added slide (last one)
      const newSlide = slides.getItemAt(slides.getCount().value - 1);

      // Add title shape
      newSlide.shapes.addTextBox(result.title, {
        left: 50,
        top: 20,
        width: 600,
        height: 50,
      } as any);

      await context.sync();
    });

    statusEl.innerHTML = '<div class="merris-badge merris-badge-success">Slide generated</div>';
  } catch (err: any) {
    statusEl.innerHTML = `<div class="merris-error-msg">Error: ${err.message}</div>`;
  }
}

// ----- Branding Panel -----

function initBrandPanel(): void {
  const brandSelect = document.getElementById("brand-select") as HTMLSelectElement;
  const applyBtn = document.getElementById("apply-brand-btn") as HTMLButtonElement;

  brandSelect.addEventListener("change", () => {
    const brand = brands.find((b) => b.id === brandSelect.value);
    const previewEl = document.getElementById("brand-preview")!;

    if (brand) {
      previewEl.style.display = "block";
      document.getElementById("brand-name")!.textContent = brand.name;

      const colorsEl = document.getElementById("brand-colors")!;
      colorsEl.innerHTML = "";
      for (const [name, color] of Object.entries(brand.colors)) {
        const swatch = document.createElement("div");
        swatch.style.cssText = `width:32px;height:32px;border-radius:4px;background:${color};border:1px solid #e0e0e0;`;
        swatch.title = `${name}: ${color}`;
        colorsEl.appendChild(swatch);
      }

      document.getElementById("brand-font")!.textContent =
        `${brand.font_heading} / ${brand.font_body}`;

      applyBtn.disabled = false;
    } else {
      previewEl.style.display = "none";
      applyBtn.disabled = true;
    }
  });

  applyBtn.addEventListener("click", applyBranding);
}

async function applyBranding(): Promise<void> {
  const statusEl = document.getElementById("brand-status")!;
  const brandId = (document.getElementById("brand-select") as HTMLSelectElement).value;
  const brand = brands.find((b) => b.id === brandId);

  if (!brand) return;

  statusEl.innerHTML = '<div class="merris-loading"><span class="merris-spinner"></span> Applying branding...</div>';

  try {
    await PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      slides.load("items");
      await context.sync();

      for (const slide of slides.items) {
        slide.shapes.load("items");
        await context.sync();

        for (const shape of slide.shapes.items) {
          if (shape.type === PowerPoint.ShapeType.textBox ||
              (shape.type as string) === "AutoShape") {
            shape.textFrame.load("textRange");
            await context.sync();

            // Apply font styling
            const textRange = shape.textFrame.textRange;
            textRange.font.color = brand.colors.primary;
            textRange.font.name = brand.font_body;
          }
        }
      }

      await context.sync();
    });

    statusEl.innerHTML = '<div class="merris-badge merris-badge-success">Branding applied to all slides</div>';
  } catch (err: any) {
    statusEl.innerHTML = `<div class="merris-error-msg">Error: ${err.message}</div>`;
  }
}

// ----- Agent Action Handler -----

function handleAgentAction(action: { type: string; payload: Record<string, unknown> }): void {
  switch (action.type) {
    case "insert_chart":
      if (action.payload.metric_id) {
        const metricSel = document.getElementById("metric-select") as HTMLSelectElement;
        metricSel.value = action.payload.metric_id as string;
        metricSel.dispatchEvent(new Event("change"));
      }
      break;
    case "generate_slide":
      if (action.payload.template_id) {
        const tmplSel = document.getElementById("template-select") as HTMLSelectElement;
        tmplSel.value = action.payload.template_id as string;
        tmplSel.dispatchEvent(new Event("change"));
      }
      break;
    case "apply_branding":
      if (action.payload.brand_id) {
        const brandSel = document.getElementById("brand-select") as HTMLSelectElement;
        brandSel.value = action.payload.brand_id as string;
        brandSel.dispatchEvent(new Event("change"));
      }
      break;
  }
}
