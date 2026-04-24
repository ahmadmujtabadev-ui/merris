import mongoose from 'mongoose';
import PptxGenJS from 'pptxgenjs';
import type { CHART_NAME } from 'pptxgenjs';
import { PresentationModel, IPresentation, ISlideSpec, IBranding } from './presentation.model.js';
import { getTemplate, SlideTemplate } from './presentation.templates.js';
import { DataPointModel } from '../ingestion/ingestion.model.js';
import { AppError } from '../auth/auth.service.js';

// ============================================================
// Types
// ============================================================

export interface GeneratePresentationInput {
  type: string;
  branding?: IBranding;
  language?: string;
}

// ============================================================
// Data Fetching Helpers
// ============================================================

/**
 * Fetches data points for an engagement that match the given metric bindings.
 * Returns a map of metricName -> value (or "Data pending" if missing).
 */
async function fetchDataForSlide(
  engagementId: string,
  dataBindings: string[],
): Promise<Record<string, string | number>> {
  const result: Record<string, string | number> = {};

  if (dataBindings.length === 0) {
    return result;
  }

  const engObjId = new mongoose.Types.ObjectId(engagementId);

  // Build regex patterns to match metric names
  const regexPatterns = dataBindings.map((binding) => new RegExp(binding, 'i'));

  const dataPoints = await DataPointModel.find({
    engagementId: engObjId,
    $or: regexPatterns.map((pattern) => ({ metricName: { $regex: pattern } })),
    status: { $ne: 'missing' },
  }).lean();

  // Index fetched data by metricName (lowercased binding match)
  for (const binding of dataBindings) {
    const match = dataPoints.find((dp) =>
      dp.metricName.toLowerCase().includes(binding.toLowerCase()),
    );
    result[binding] = match ? match.value : 'Data pending';
  }

  return result;
}

// ============================================================
// Slide Content Builder
// ============================================================

function buildSlideContent(
  template: SlideTemplate,
  data: Record<string, string | number>,
): ISlideSpec {
  const hasData = Object.values(data).some((v) => v !== 'Data pending');

  let text: string;
  if (template.dataBindings.length === 0) {
    text = template.speakerNotesTemplate;
  } else if (!hasData) {
    text = 'Data pending - metrics will be populated when data collection is complete.';
  } else {
    const lines = Object.entries(data).map(
      ([key, value]) => `${key}: ${value}`,
    );
    text = lines.join('\n');
  }

  // Build chart data if chart type specified and data available
  let chartData: unknown = undefined;
  if (template.chartType && hasData) {
    const labels = Object.keys(data).filter((k) => data[k] !== 'Data pending');
    const values = labels.map((k) => (typeof data[k] === 'number' ? data[k] : 0));
    chartData = {
      chartType: template.chartType,
      labels,
      datasets: [{ label: template.title, values }],
    };
  }

  return {
    id: template.id,
    title: template.title,
    layout: template.layout,
    content: {
      text,
      dataPoints: template.dataBindings.filter((b) => data[b] !== undefined && data[b] !== 'Data pending'),
      chartType: template.chartType,
      chartData,
    },
    speakerNotes: template.speakerNotesTemplate,
  };
}

// ============================================================
// PPTX Generation
// ============================================================

function buildPptxBuffer(
  slides: ISlideSpec[],
  title: string,
  branding: IBranding,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pptx = new (PptxGenJS as any)() as PptxGenJS;

  pptx.title = title;
  pptx.author = 'Merris ESG Platform';

  const primaryColor = branding.primaryColor || '003366';
  const fontFamily = branding.fontFamily || 'Arial';

  for (const slide of slides) {
    const pptxSlide = pptx.addSlide();

    // Title text
    pptxSlide.addText(slide.title, {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.8,
      fontSize: 24,
      bold: true,
      color: primaryColor.replace('#', ''),
      fontFace: fontFamily,
    });

    // Content text
    if (slide.content.text) {
      pptxSlide.addText(slide.content.text, {
        x: 0.5,
        y: 1.3,
        w: 9,
        h: 4,
        fontSize: 14,
        color: '333333',
        fontFace: fontFamily,
        valign: 'top',
      });
    }

    // Add chart if chart data available
    if (slide.content.chartData && slide.content.chartType) {
      const cd = slide.content.chartData as {
        labels: string[];
        datasets: Array<{ label: string; values: number[] }>;
      };

      if (cd.labels && cd.labels.length > 0) {
        const chartTypeMap: Record<string, CHART_NAME> = {
          bar: pptx.ChartType.bar,
          line: pptx.ChartType.line,
          pie: pptx.ChartType.pie,
          radar: pptx.ChartType.radar,
        };

        const pptxChartType = chartTypeMap[slide.content.chartType] || pptx.ChartType.bar;

        pptxSlide.addChart(pptxChartType, [
          {
            name: cd.datasets[0]?.label || 'Data',
            labels: cd.labels,
            values: cd.datasets[0]?.values || [],
          },
        ], {
          x: 0.5,
          y: 1.5,
          w: 9,
          h: 4,
        });
      }
    }

    // Speaker notes
    if (slide.speakerNotes) {
      pptxSlide.addNotes(slide.speakerNotes);
    }
  }

  return pptx.write({ outputType: 'nodebuffer' }) as Promise<Buffer>;
}

// ============================================================
// Service Functions
// ============================================================

export async function generatePresentation(
  engagementId: string,
  input: GeneratePresentationInput,
): Promise<IPresentation> {
  const template = getTemplate(input.type);
  if (!template) {
    throw new AppError(`Unknown deck type: ${input.type}`, 400);
  }

  // Build slides by fetching data for each template slide
  const slides: ISlideSpec[] = [];
  for (const slideTemplate of template.slides) {
    const data = await fetchDataForSlide(engagementId, slideTemplate.dataBindings);
    const slideSpec = buildSlideContent(slideTemplate, data);
    slides.push(slideSpec);
  }

  const branding: IBranding = input.branding || {};
  const title = `${template.name} - ${new Date().toISOString().split('T')[0]}`;

  // Generate PPTX buffer
  const buffer = await buildPptxBuffer(slides, title, branding);

  // Store file path (stub - in production would upload to Azure Blob Storage)
  const filePath = `/tmp/presentations/${new mongoose.Types.ObjectId().toString()}.pptx`;

  // Create presentation record
  const presentation = await PresentationModel.create({
    engagementId: new mongoose.Types.ObjectId(engagementId),
    title,
    type: input.type,
    slides,
    branding,
    language: input.language || 'en',
    status: 'draft',
    filePath,
    generatedAt: new Date(),
  });

  // Store the buffer reference on the document for download
  // In production, this would be uploaded to blob storage
  (presentation as unknown as Record<string, unknown>)._pptxBuffer = buffer;

  return presentation;
}

export async function listPresentations(engagementId: string): Promise<IPresentation[]> {
  return PresentationModel.find({
    engagementId: new mongoose.Types.ObjectId(engagementId),
  })
    .sort({ createdAt: -1 })
    .lean() as unknown as IPresentation[];
}

export async function getPresentation(presentationId: string): Promise<IPresentation> {
  const presentation = await PresentationModel.findById(presentationId);
  if (!presentation) {
    throw new AppError('Presentation not found', 404);
  }
  return presentation;
}

export async function downloadPresentation(presentationId: string): Promise<{ buffer: Buffer; filename: string }> {
  const presentation = await PresentationModel.findById(presentationId);
  if (!presentation) {
    throw new AppError('Presentation not found', 404);
  }

  // Re-generate the PPTX buffer for download
  const branding: IBranding = presentation.branding || {};
  const buffer = await buildPptxBuffer(
    presentation.slides,
    presentation.title,
    branding,
  );

  const filename = `${presentation.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.pptx`;

  return { buffer, filename };
}
