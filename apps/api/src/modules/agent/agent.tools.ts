import mongoose from 'mongoose';
import type { CalculationMethod } from '@merris/shared';
import { DataPointModel, ESGDocumentModel } from '../ingestion/ingestion.model.js';
import { calculate } from '../calculation/calculation.service.js';
import {
  getDisclosuresForFramework,
  queryEmissionFactors,
  getDisclosureById,
} from '../framework/framework.service.js';
import { getCompleteness } from '../data-collection/data-collection.service.js';
import { sendMessage } from '../../lib/claude.js';
import { logger } from '../../lib/logger.js';

// ============================================================
// Types
// ============================================================

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

// ============================================================
// Tool Definitions
// ============================================================

export function getToolDefinitions(): ToolDefinition[] {
  return [
    searchDocumentsTool,
    getDataPointTool,
    calculateTool,
    checkComplianceTool,
    draftDisclosureTool,
    checkConsistencyTool,
    getEmissionFactorTool,
    benchmarkTool,
    generateChartTool,
    createEvidencePackTool,
  ];
}

/**
 * Returns tool definitions in Claude tool_use format (without handler).
 */
export function getToolSchemas() {
  return getToolDefinitions().map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema,
  }));
}

// ============================================================
// 1. search_documents
// ============================================================

const searchDocumentsTool: ToolDefinition = {
  name: 'search_documents',
  description:
    'Search ingested documents for ESG information. Returns matching text snippets and metadata from uploaded documents.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query for ESG information' },
      engagementId: { type: 'string', description: 'Engagement ID to scope the search' },
    },
    required: ['query', 'engagementId'],
  },
  handler: async (input) => {
    const { query, engagementId } = input as { query: string; engagementId: string };

    // Text search over extracted text (vector search stub)
    const documents = await ESGDocumentModel.find({
      engagementId: new mongoose.Types.ObjectId(engagementId),
      status: 'ingested',
      $or: [
        { extractedText: { $regex: new RegExp(query, 'i') } },
        { 'extractedData.metric': { $regex: new RegExp(query, 'i') } },
      ],
    })
      .limit(10)
      .lean();

    if (documents.length === 0) {
      return { results: [], message: 'No documents found matching the query.' };
    }

    return {
      results: documents.map((doc) => ({
        documentId: doc._id.toString(),
        filename: doc.filename,
        format: doc.format,
        matchingMetrics: doc.extractedData.filter((d) =>
          new RegExp(query, 'i').test(d.metric)
        ),
        hasTextMatch: doc.extractedText
          ? new RegExp(query, 'i').test(doc.extractedText)
          : false,
      })),
    };
  },
};

// ============================================================
// 2. get_data_point
// ============================================================

const getDataPointTool: ToolDefinition = {
  name: 'get_data_point',
  description:
    'Retrieve the current value for a specific ESG metric. Returns the data point with its value, unit, confidence, and audit trail.',
  input_schema: {
    type: 'object',
    properties: {
      frameworkRef: { type: 'string', description: 'Framework reference code (e.g. GRI-302-1)' },
      metricName: { type: 'string', description: 'Name of the metric to retrieve' },
      engagementId: { type: 'string', description: 'Engagement ID to scope the query' },
    },
    required: ['frameworkRef', 'metricName', 'engagementId'],
  },
  handler: async (input) => {
    const { frameworkRef, metricName, engagementId } = input as {
      frameworkRef: string;
      metricName: string;
      engagementId: string;
    };

    const dataPoint = await DataPointModel.findOne({
      engagementId: new mongoose.Types.ObjectId(engagementId),
      frameworkRef,
      metricName: { $regex: new RegExp(metricName, 'i') },
    }).lean();

    if (!dataPoint) {
      return {
        found: false,
        message: `No data point found for metric "${metricName}" under framework ref "${frameworkRef}".`,
      };
    }

    return {
      found: true,
      dataPoint: {
        id: dataPoint._id.toString(),
        frameworkRef: dataPoint.frameworkRef,
        metricName: dataPoint.metricName,
        value: dataPoint.value,
        unit: dataPoint.unit,
        period: dataPoint.period,
        confidence: dataPoint.confidence,
        status: dataPoint.status,
        extractionMethod: dataPoint.extractionMethod,
      },
    };
  },
};

// ============================================================
// 3. calculate
// ============================================================

const calculateTool: ToolDefinition = {
  name: 'calculate',
  description:
    'Perform a deterministic ESG calculation using the Merris calculation engine. Supports GHG scopes, energy, water, safety, intensity, climate risk, sustainable finance, and environmental calculations.',
  input_schema: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        description:
          'Calculation method (e.g. ghg_scope1, ghg_scope2_location, energy_total, safety_ltifr, etc.)',
      },
      inputs: {
        type: 'object',
        description: 'Input parameters specific to the calculation method',
      },
      engagementId: { type: 'string', description: 'Engagement ID for audit trail' },
      disclosureRef: { type: 'string', description: 'Disclosure reference for audit trail' },
    },
    required: ['method', 'inputs', 'engagementId', 'disclosureRef'],
  },
  handler: async (input) => {
    const { method, inputs, engagementId, disclosureRef } = input as {
      method: string;
      inputs: Record<string, unknown>;
      engagementId: string;
      disclosureRef: string;
    };

    const result = await calculate({
      method: method as CalculationMethod,
      inputs,
      engagementId,
      disclosureRef,
    });

    return result;
  },
};

// ============================================================
// 4. check_compliance
// ============================================================

const checkComplianceTool: ToolDefinition = {
  name: 'check_compliance',
  description:
    'Check disclosure completion status for a specific framework. Returns per-disclosure completion status.',
  input_schema: {
    type: 'object',
    properties: {
      frameworkCode: { type: 'string', description: 'Framework code (e.g. GRI, SASB, IFRS-S2)' },
      engagementId: { type: 'string', description: 'Engagement ID to check' },
    },
    required: ['frameworkCode', 'engagementId'],
  },
  handler: async (input) => {
    const { frameworkCode, engagementId } = input as {
      frameworkCode: string;
      engagementId: string;
    };

    // Get all disclosures for the framework
    const disclosures = await getDisclosuresForFramework(frameworkCode);

    // Get all data points for this engagement + framework
    const dataPoints = await DataPointModel.find({
      engagementId: new mongoose.Types.ObjectId(engagementId),
      frameworkRef: { $regex: new RegExp(`^${frameworkCode}`, 'i') },
    }).lean();

    const dpMetrics = new Set(dataPoints.map((dp) => dp.metricName.toLowerCase()));

    const disclosureStatus = disclosures.map((disc) => {
      const requiredMetrics = disc.requiredMetrics || [];
      if (requiredMetrics.length === 0) {
        // Narrative disclosure — check if any data point references it
        const hasData = dataPoints.some((dp) =>
          dp.frameworkRef.toLowerCase().includes(disc.code.toLowerCase())
        );
        return {
          code: disc.code,
          name: disc.name,
          topic: disc.topic,
          dataType: disc.dataType,
          status: hasData ? 'complete' : 'missing',
          requiredCount: 1,
          completedCount: hasData ? 1 : 0,
        };
      }

      const completed = requiredMetrics.filter((m) =>
        dpMetrics.has(m.name.toLowerCase())
      ).length;

      return {
        code: disc.code,
        name: disc.name,
        topic: disc.topic,
        dataType: disc.dataType,
        status: completed === requiredMetrics.length ? 'complete' : completed > 0 ? 'partial' : 'missing',
        requiredCount: requiredMetrics.length,
        completedCount: completed,
      };
    });

    const totalDisclosures = disclosureStatus.length;
    const completeCount = disclosureStatus.filter((d) => d.status === 'complete').length;
    const partialCount = disclosureStatus.filter((d) => d.status === 'partial').length;

    return {
      frameworkCode,
      totalDisclosures,
      complete: completeCount,
      partial: partialCount,
      missing: totalDisclosures - completeCount - partialCount,
      completionPercentage:
        totalDisclosures > 0 ? Math.round((completeCount / totalDisclosures) * 100) : 0,
      disclosures: disclosureStatus,
    };
  },
};

// ============================================================
// 5. draft_disclosure
// ============================================================

const draftDisclosureTool: ToolDefinition = {
  name: 'draft_disclosure',
  description:
    'Draft a narrative disclosure based on available data points and framework guidance text. Uses AI to generate professional disclosure text.',
  input_schema: {
    type: 'object',
    properties: {
      frameworkRef: { type: 'string', description: 'Framework reference (e.g. GRI)' },
      disclosureCode: { type: 'string', description: 'Disclosure code (e.g. GRI-302-1)' },
      engagementId: { type: 'string', description: 'Engagement ID for data context' },
    },
    required: ['frameworkRef', 'disclosureCode', 'engagementId'],
  },
  handler: async (input) => {
    const { frameworkRef, disclosureCode, engagementId } = input as {
      frameworkRef: string;
      disclosureCode: string;
      engagementId: string;
    };

    // Fetch related data points
    const dataPoints = await DataPointModel.find({
      engagementId: new mongoose.Types.ObjectId(engagementId),
      frameworkRef: { $regex: new RegExp(`^${frameworkRef}`, 'i') },
    }).lean();

    // Try to get disclosure guidance
    let guidanceText = '';
    try {
      const disclosures = await getDisclosuresForFramework(frameworkRef);
      const disc = disclosures.find(
        (d) => d.code.toLowerCase() === disclosureCode.toLowerCase()
      );
      if (disc) {
        guidanceText = disc.guidanceText || '';
      }
    } catch {
      logger.warn(`Could not fetch disclosure guidance for ${disclosureCode}`);
    }

    if (dataPoints.length === 0) {
      return {
        draft: null,
        message: `No data points available for disclosure ${disclosureCode}. Cannot draft without confirmed data.`,
        dataPointCount: 0,
      };
    }

    const dataContext = dataPoints.map((dp) => ({
      metric: dp.metricName,
      value: dp.value,
      unit: dp.unit,
      period: dp.period,
      confidence: dp.confidence,
    }));

    const draftPrompt = `Draft a professional ESG disclosure for ${disclosureCode}.

GUIDANCE: ${guidanceText || 'No specific guidance available.'}

AVAILABLE DATA:
${JSON.stringify(dataContext, null, 2)}

Write a concise, professional disclosure narrative that:
- References only the provided data
- Uses appropriate ESG terminology
- Follows the framework's disclosure requirements
- Cites specific figures and periods`;

    const draft = await sendMessage({
      system: 'You are an expert ESG report writer drafting disclosure narratives.',
      messages: [{ role: 'user', content: draftPrompt }],
      maxTokens: 2048,
    });

    return {
      draft: draft || 'Unable to generate draft at this time.',
      dataPointCount: dataPoints.length,
      disclosureCode,
    };
  },
};

// ============================================================
// 6. check_consistency
// ============================================================

const checkConsistencyTool: ToolDefinition = {
  name: 'check_consistency',
  description:
    'Scan a report draft for inconsistencies by cross-referencing extracted numbers against confirmed data points.',
  input_schema: {
    type: 'object',
    properties: {
      reportId: { type: 'string', description: 'Report or engagement ID to check' },
    },
    required: ['reportId'],
  },
  handler: async (input) => {
    const { reportId } = input as { reportId: string };

    // Use reportId as engagementId for cross-referencing
    let engagementObjId: mongoose.Types.ObjectId;
    try {
      engagementObjId = new mongoose.Types.ObjectId(reportId);
    } catch {
      return { error: 'Invalid report/engagement ID format.' };
    }

    const dataPoints = await DataPointModel.find({
      engagementId: engagementObjId,
    }).lean();

    if (dataPoints.length === 0) {
      return { issues: [], message: 'No data points found for consistency check.' };
    }

    // Check for internal consistency issues
    const issues: Array<{
      type: string;
      metric: string;
      details: string;
    }> = [];

    // Check for duplicate metrics with different values
    const metricValues = new Map<string, Array<{ value: number | string; id: string; period: { year: number; quarter?: number } }>>();
    for (const dp of dataPoints) {
      const key = `${dp.frameworkRef}::${dp.metricName}`;
      if (!metricValues.has(key)) {
        metricValues.set(key, []);
      }
      metricValues.get(key)!.push({
        value: dp.value,
        id: dp._id.toString(),
        period: dp.period,
      });
    }

    for (const [key, entries] of metricValues) {
      // Check same period, different values
      const byPeriod = new Map<string, typeof entries>();
      for (const e of entries) {
        const periodKey = `${e.period.year}-${e.period.quarter || 'annual'}`;
        if (!byPeriod.has(periodKey)) {
          byPeriod.set(periodKey, []);
        }
        byPeriod.get(periodKey)!.push(e);
      }

      for (const [period, periodEntries] of byPeriod) {
        if (periodEntries.length > 1) {
          const uniqueValues = new Set(periodEntries.map((e) => String(e.value)));
          if (uniqueValues.size > 1) {
            issues.push({
              type: 'conflicting_values',
              metric: key,
              details: `Multiple different values found for period ${period}: ${Array.from(uniqueValues).join(', ')}`,
            });
          }
        }
      }
    }

    // Check for missing estimated values that reference low confidence
    const lowConfidence = dataPoints.filter((dp) => dp.confidence === 'low');
    if (lowConfidence.length > 0) {
      issues.push({
        type: 'low_confidence_data',
        metric: 'multiple',
        details: `${lowConfidence.length} data points have low confidence and may need verification.`,
      });
    }

    return {
      totalDataPoints: dataPoints.length,
      issuesFound: issues.length,
      issues,
    };
  },
};

// ============================================================
// 7. get_emission_factor
// ============================================================

const getEmissionFactorTool: ToolDefinition = {
  name: 'get_emission_factor',
  description:
    'Look up emission factors by country, source, year, and fuel type from the Merris emission factor database.',
  input_schema: {
    type: 'object',
    properties: {
      country: { type: 'string', description: 'Country name (e.g. Saudi Arabia, UAE)' },
      source: { type: 'string', description: 'Data source (e.g. IEA, EPA)' },
      year: { type: 'number', description: 'Year of the emission factor' },
      fuelType: { type: 'string', description: 'Fuel type (e.g. natural_gas, diesel)' },
    },
    required: ['country'],
  },
  handler: async (input) => {
    const { country, source, year, fuelType } = input as {
      country: string;
      source?: string;
      year?: number;
      fuelType?: string;
    };

    const factors = await queryEmissionFactors({
      country,
      source,
      year,
      fuelType,
    });

    if (factors.length === 0) {
      return {
        found: false,
        message: `No emission factors found for country "${country}"${source ? `, source "${source}"` : ''}${year ? `, year ${year}` : ''}${fuelType ? `, fuel type "${fuelType}"` : ''}.`,
      };
    }

    return {
      found: true,
      count: factors.length,
      factors: factors.map((f) => ({
        source: f.source,
        country: f.country,
        year: f.year,
        factor: f.factor,
        unit: f.unit,
        scope: f.scope,
        category: f.category,
        fuelType: f.fuelType,
      })),
    };
  },
};

// ============================================================
// 8. benchmark
// ============================================================

const benchmarkTool: ToolDefinition = {
  name: 'benchmark',
  description:
    'Compare a metric value against industry peers. Returns percentile ranking and peer statistics (stub — returns simulated benchmark data).',
  input_schema: {
    type: 'object',
    properties: {
      metricName: { type: 'string', description: 'Name of the ESG metric' },
      value: { type: 'number', description: 'Current value to benchmark' },
      sector: { type: 'string', description: 'Industry sector for peer comparison' },
      region: { type: 'string', description: 'Geographic region for peer comparison' },
    },
    required: ['metricName', 'value', 'sector', 'region'],
  },
  handler: async (input) => {
    const { metricName, value, sector, region } = input as {
      metricName: string;
      value: number;
      sector: string;
      region: string;
    };

    // Stub benchmark data — to be replaced with real peer database
    return {
      metricName,
      yourValue: value,
      sector,
      region,
      peerStats: {
        mean: value * 1.1,
        median: value * 1.05,
        p25: value * 0.8,
        p75: value * 1.3,
        min: value * 0.5,
        max: value * 2.0,
        sampleSize: 42,
      },
      percentileRank: 55,
      rating: 'average',
      note: 'Benchmark data is simulated. Real peer comparison database coming soon.',
    };
  },
};

// ============================================================
// 9. generate_chart
// ============================================================

const generateChartTool: ToolDefinition = {
  name: 'generate_chart',
  description:
    'Generate a Recharts-compatible chart specification from provided data. Returns JSON that the frontend can render directly.',
  input_schema: {
    type: 'object',
    properties: {
      chartType: {
        type: 'string',
        description: 'Chart type: bar, line, pie, waterfall, radar, bubble, sankey, treemap',
      },
      data: {
        type: 'object',
        description: 'Data to visualize (array of data points or object)',
      },
      title: { type: 'string', description: 'Chart title' },
    },
    required: ['chartType', 'data', 'title'],
  },
  handler: async (input) => {
    const { chartType, data, title } = input as {
      chartType: string;
      data: unknown;
      title: string;
    };

    // Generate Recharts-compatible spec
    return {
      spec: {
        type: chartType,
        title,
        data,
        config: {
          responsive: true,
          legend: true,
          tooltip: true,
          colors: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
        },
      },
    };
  },
};

// ============================================================
// 10. create_evidence_pack
// ============================================================

const createEvidencePackTool: ToolDefinition = {
  name: 'create_evidence_pack',
  description:
    'Create an evidence pack linking a disclosure to its source evidence. Traces data points back to source documents to build a verifiable evidence chain.',
  input_schema: {
    type: 'object',
    properties: {
      disclosureId: { type: 'string', description: 'Disclosure ID to create evidence pack for' },
      engagementId: { type: 'string', description: 'Engagement ID to scope evidence search' },
    },
    required: ['disclosureId', 'engagementId'],
  },
  handler: async (input) => {
    const { disclosureId, engagementId } = input as {
      disclosureId: string;
      engagementId: string;
    };

    // Get disclosure info
    let disclosure;
    try {
      disclosure = await getDisclosureById(disclosureId);
    } catch {
      return { error: `Disclosure not found: ${disclosureId}` };
    }

    // Find data points linked to this disclosure's framework
    const frameworkCode =
      (disclosure as unknown as { frameworkCode?: string }).frameworkCode || '';
    const dataPoints = await DataPointModel.find({
      engagementId: new mongoose.Types.ObjectId(engagementId),
      frameworkRef: { $regex: new RegExp(`^${frameworkCode}`, 'i') },
    }).lean();

    // Trace back to source documents
    const evidenceChain: Array<{
      dataPoint: { metric: string; value: number | string; unit: string };
      sourceDocument?: { id: string; filename: string; page?: number; cell?: string };
    }> = [];

    for (const dp of dataPoints) {
      const entry: (typeof evidenceChain)[0] = {
        dataPoint: {
          metric: dp.metricName,
          value: dp.value,
          unit: dp.unit,
        },
      };

      if (dp.sourceDocumentId) {
        const doc = await ESGDocumentModel.findById(dp.sourceDocumentId).lean();
        if (doc) {
          entry.sourceDocument = {
            id: doc._id.toString(),
            filename: doc.filename,
            page: dp.sourcePage,
            cell: dp.sourceCell,
          };
        }
      }

      evidenceChain.push(entry);
    }

    return {
      disclosureId,
      disclosureCode: disclosure.code,
      disclosureName: disclosure.name,
      evidenceChain,
      totalDataPoints: evidenceChain.length,
      withSourceDocuments: evidenceChain.filter((e) => e.sourceDocument).length,
    };
  },
};
