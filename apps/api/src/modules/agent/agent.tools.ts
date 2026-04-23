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
import { KnowledgeReportModel } from '../../models/knowledge-report.model.js';
import { CorporateDisclosureModel, RegulatoryModel, ClimateScienceModel } from '../../models/knowledge-base.model.js';
import { semanticSearch } from '../knowledge-base/search.service.js';
import { denseSearch } from '../knowledge-base/dense-search.service.js';
import { getEmissionFactorLive } from '../../services/knowledge/apis/climatiq.js';
import { getWaterStress, getClimateVulnerability, getSBTiStatus, getForcedLabourRisk, getProductLabourRisk, getCountryEmissions, getNDCTarget, getCorruptionIndex, getFacilityEmissions, getDeforestationData, getProtectedAreas, getProtectedAreasNear, getKnowTheChainScore, getKnowTheChainSector, getAbatementOptions, getCarbonPrice, getCarbonPriceScenario, getEnergyInstrument, getRECMarketStatus, getDecarbonisationPathway, getAssuranceRequirement, getVerifierChecklist, getPrecedent, getAnomalyCheck, getPartnerInsight } from '../../services/knowledge/apis/datasets.js';
import { getThreatenedSpecies } from '../../services/knowledge/apis/iucn.js';
import { getSpeciesNear, getSpeciesStatus } from '../../services/knowledge/apis/gbif.js';

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
    benchmarkMetricTool,
    retrieveBestDisclosureTool,
    retrieveSimilarCompaniesTool,
    searchKnowledgeTool,
    searchKbDenseTool,
    getRegulatoryContextTool,
    getScientificBasisTool,
    getEmissionFactorLiveTool,
    getWaterStressTool,
    getClimateVulnerabilityTool,
    getSBTiStatusTool,
    getForcedLabourRiskTool,
    getProductLabourRiskTool,
    getThreatenedSpeciesTool,
    getSpeciesNearTool,
    getSpeciesStatusTool,
    getCountryEmissionsTool,
    getNDCTargetTool,
    getCorruptionIndexTool,
    getFacilityEmissionsTool,
    getDeforestationDataTool,
    getProtectedAreasTool,
    getProtectedAreasNearTool,
    getKnowTheChainScoreTool,
    getKnowTheChainSectorTool,
    getAbatementOptionsTool,
    getCarbonPriceTool,
    getEnergyInstrumentTool,
    getRECMarketStatusTool,
    getDecarbonisationPathwayTool,
    getAssuranceRequirementTool,
    getVerifierChecklistTool,
    getPrecedentTool,
    getAnomalyCheckTool,
    getPartnerInsightTool,
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

    // Query K1 knowledge base for reference examples
    let referenceExamples = '';
    try {
      const peerNarratives = await KnowledgeReportModel.find({
        'narratives.frameworkRef': { $regex: new RegExp(disclosureCode.replace(/-/g, '.*'), 'i') },
      })
        .sort({ 'quality.narrativeQuality': -1 })
        .limit(3)
        .lean();

      if (peerNarratives.length > 0) {
        const examples = peerNarratives.flatMap((report) =>
          report.narratives
            .filter((n) => new RegExp(disclosureCode.replace(/-/g, '.*'), 'i').test(n.frameworkRef))
            .map((n) => ({
              company: report.company,
              score: n.qualityScore,
              content: n.content.substring(0, 500),
            }))
        )
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        if (examples.length > 0) {
          referenceExamples = `\n\nREFERENCE EXAMPLES (from high-quality peer disclosures -- use as style/quality guides, do not copy):\n${examples
            .map((ex, i) => `Example ${i + 1} (${ex.company}, score: ${ex.score}/100):\n${ex.content}`)
            .join('\n\n')}`;
        }
      }
    } catch {
      logger.debug('K1 peer narratives not available for draft reference');
    }

    const draftPrompt = `Draft a professional ESG disclosure for ${disclosureCode}.

GUIDANCE: ${guidanceText || 'No specific guidance available.'}

AVAILABLE DATA:
${JSON.stringify(dataContext, null, 2)}
${referenceExamples}

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

// ============================================================
// 11. benchmark_metric (K1 Knowledge Base)
// ============================================================

const benchmarkMetricTool: ToolDefinition = {
  name: 'benchmark_metric',
  description:
    'Compare an ESG metric value against peer companies from the knowledge base. Returns percentile ranking, sector average, and 3-year trend.',
  input_schema: {
    type: 'object',
    properties: {
      metricName: { type: 'string', description: 'The metric to benchmark (e.g., "Scope 1 GHG Emissions")' },
      value: { type: 'number', description: 'The value to compare' },
      unit: { type: 'string', description: 'Unit of measurement' },
      sector: { type: 'string', description: 'Industry sector for peer comparison' },
      country: { type: 'string', description: 'Country code for regional comparison (optional)' },
    },
    required: ['metricName', 'value', 'sector'],
  },
  handler: async (input) => {
    const { metricName, value, unit, sector, country } = input as {
      metricName: string;
      value: number;
      unit?: string;
      sector: string;
      country?: string;
    };

    try {
      const matchFilter: Record<string, any> = {
        sector: { $regex: new RegExp(sector, 'i') },
        'metrics.name': { $regex: new RegExp(metricName, 'i') },
      };
      if (country) {
        matchFilter['country'] = { $regex: new RegExp(country, 'i') };
      }

      const peerReports = await KnowledgeReportModel.find(matchFilter)
        .sort({ reportYear: -1 })
        .limit(50)
        .lean();

      if (peerReports.length === 0) {
        return {
          metricName,
          yourValue: value,
          sector,
          message: 'No peer data available in the knowledge base for this metric and sector.',
          peerCount: 0,
        };
      }

      // Extract metric values from peers
      const peerValues: Array<{ company: string; value: number; year: number }> = [];
      const trendData: Map<number, number[]> = new Map();

      for (const report of peerReports) {
        for (const metric of report.metrics) {
          if (new RegExp(metricName, 'i').test(metric.name) && typeof metric.value === 'number') {
            peerValues.push({ company: report.company, value: metric.value, year: report.reportYear });
            if (!trendData.has(report.reportYear)) trendData.set(report.reportYear, []);
            trendData.get(report.reportYear)!.push(metric.value);
          }
        }
      }

      if (peerValues.length === 0) {
        return { metricName, yourValue: value, sector, message: 'Peer reports found but no numeric values.', peerCount: 0 };
      }

      const numericValues = peerValues.map((p) => p.value).sort((a, b) => a - b);
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const mean = sum / numericValues.length;
      const median = numericValues[Math.floor(numericValues.length / 2)] ?? 0;
      const min = numericValues[0] ?? 0;
      const max = numericValues[numericValues.length - 1] ?? 0;
      const p25 = numericValues[Math.floor(numericValues.length * 0.25)] ?? 0;
      const p75 = numericValues[Math.floor(numericValues.length * 0.75)] ?? 0;

      const belowCount = numericValues.filter((v) => v < value).length;
      const percentileRank = Math.round((belowCount / numericValues.length) * 100);

      // 3-year trend (sector average by year)
      const years = Array.from(trendData.keys()).sort();
      const trend = years.map((y) => {
        const vals = trendData.get(y)!;
        return { year: y, sectorAverage: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) };
      });

      // Named peers (latest year, top 5)
      const latestYear = Math.max(...peerValues.map((p) => p.year));
      const namedPeers = peerValues
        .filter((p) => p.year === latestYear)
        .slice(0, 5)
        .map((p) => ({ company: p.company, value: p.value }));

      return {
        metricName,
        yourValue: value,
        unit: unit || 'not specified',
        sector,
        country: country || 'all',
        peerStats: { mean: Math.round(mean * 100) / 100, median, p25, p75, min, max, sampleSize: numericValues.length },
        percentileRank,
        trend,
        namedPeers,
      };
    } catch (err: any) {
      logger.error('benchmark_metric failed', err);
      return { error: 'Failed to query knowledge base', details: err.message };
    }
  },
};

// ============================================================
// 12. retrieve_best_disclosure (K1 Knowledge Base)
// ============================================================

const retrieveBestDisclosureTool: ToolDefinition = {
  name: 'retrieve_best_disclosure',
  description:
    'Find the highest-quality narrative disclosure example from peer reports for a specific framework reference. Used as a style guide for drafting.',
  input_schema: {
    type: 'object',
    properties: {
      frameworkRef: { type: 'string', description: 'Framework disclosure code (e.g., "GRI 305-1")' },
      sector: { type: 'string', description: 'Industry sector' },
      minQuality: { type: 'number', description: 'Minimum quality score (0-100), default 75' },
    },
    required: ['frameworkRef', 'sector'],
  },
  handler: async (input) => {
    const { frameworkRef, sector, minQuality } = input as {
      frameworkRef: string;
      sector: string;
      minQuality?: number;
    };

    const qualityThreshold = minQuality ?? 75;

    try {
      const refPattern = frameworkRef.replace(/[\s-]+/g, '.*');

      const reports = await KnowledgeReportModel.find({
        sector: { $regex: new RegExp(sector, 'i') },
        'narratives.frameworkRef': { $regex: new RegExp(refPattern, 'i') },
      })
        .sort({ 'quality.narrativeQuality': -1 })
        .limit(10)
        .lean();

      if (reports.length === 0) {
        return {
          frameworkRef,
          sector,
          results: [],
          message: `No disclosures found for ${frameworkRef} in ${sector} sector.`,
        };
      }

      const candidates: Array<{
        company: string;
        reportYear: number;
        qualityScore: number;
        title: string;
        content: string;
        hasQuantitativeData: boolean;
        hasYoYComparison: boolean;
        hasMethodology: boolean;
        wordCount: number;
      }> = [];

      for (const report of reports) {
        for (const narrative of report.narratives) {
          if (
            new RegExp(refPattern, 'i').test(narrative.frameworkRef) &&
            narrative.qualityScore >= qualityThreshold
          ) {
            candidates.push({
              company: report.company,
              reportYear: report.reportYear,
              qualityScore: narrative.qualityScore,
              title: narrative.title,
              content: narrative.content.substring(0, 1000),
              hasQuantitativeData: narrative.hasQuantitativeData,
              hasYoYComparison: narrative.hasYoYComparison,
              hasMethodology: narrative.hasMethodology,
              wordCount: narrative.wordCount,
            });
          }
        }
      }

      candidates.sort((a, b) => b.qualityScore - a.qualityScore);
      const top3 = candidates.slice(0, 3);

      return { frameworkRef, sector, resultCount: top3.length, results: top3 };
    } catch (err: any) {
      logger.error('retrieve_best_disclosure failed', err);
      return { error: 'Failed to query knowledge base', details: err.message };
    }
  },
};

// ============================================================
// 13. retrieve_similar_companies (K1 Knowledge Base)
// ============================================================

const retrieveSimilarCompaniesTool: ToolDefinition = {
  name: 'retrieve_similar_companies',
  description:
    'Find comparable peer companies for benchmarking based on sector, country, and size.',
  input_schema: {
    type: 'object',
    properties: {
      sector: { type: 'string', description: 'Industry sector' },
      country: { type: 'string', description: 'Country code (optional)' },
      region: { type: 'string', description: 'Region (e.g., GCC, EU)' },
    },
    required: ['sector'],
  },
  handler: async (input) => {
    const { sector, country, region } = input as {
      sector: string;
      country?: string;
      region?: string;
    };

    try {
      // Query K1 catalog for companies in same sector + region
      const catalogFilter: Record<string, any> = {
        sector: { $regex: new RegExp(sector, 'i') },
      };
      if (country) catalogFilter['country'] = { $regex: new RegExp(country, 'i') };
      if (region) catalogFilter['region'] = { $regex: new RegExp(region, 'i') };

      const catalogEntries = await CorporateDisclosureModel.find(catalogFilter)
        .sort({ reportYear: -1 })
        .limit(20)
        .lean();

      if (catalogEntries.length === 0) {
        return { sector, region: region || 'all', peers: [], message: 'No peer companies found in the K1 catalog for this sector/region.' };
      }

      // De-duplicate by company name (keep latest year)
      const seen = new Map<string, (typeof catalogEntries)[0]>();
      for (const entry of catalogEntries) {
        const key = entry.company.toLowerCase();
        if (!seen.has(key)) seen.set(key, entry);
      }

      const uniqueCompanies = Array.from(seen.values()).slice(0, 10);

      const peers: Array<{
        company: string;
        country: string;
        region: string;
        sector: string;
        latestReportYear: number;
        status: string;
        keyMetrics?: Array<{ name: string; value: number | string; unit: string }>;
        overallQualityScore?: number;
        sourceUrl?: string;
      }> = [];

      for (const entry of uniqueCompanies) {
        const peer: (typeof peers)[0] = {
          company: entry.company,
          country: entry.country,
          region: entry.region,
          sector: entry.sector,
          latestReportYear: entry.reportYear,
          status: entry.status,
          sourceUrl: (entry as any).sourceUrl || undefined,
        };

        // For ingested reports, include key metrics summary
        if (entry.status === 'ingested' || entry.status === 'indexed') {
          try {
            const report = await KnowledgeReportModel.findOne({
              company: entry.company,
              reportYear: entry.reportYear,
            }).lean();

            if (report) {
              peer.keyMetrics = report.metrics.slice(0, 5).map((m) => ({
                name: m.name,
                value: m.value,
                unit: m.unit,
              }));
              peer.overallQualityScore = report.quality.overallScore;
            }
          } catch {
            // Knowledge report not available yet
          }
        }

        peers.push(peer);
      }

      return { sector, region: region || 'all', country: country || 'all', peerCount: peers.length, peers };
    } catch (err: any) {
      logger.error('retrieve_similar_companies failed', err);
      return { error: 'Failed to query knowledge base', details: err.message };
    }
  },
};

// ============================================================
// 14. search_knowledge (Semantic Search across all KB domains)
// ============================================================

const searchKnowledgeTool: ToolDefinition = {
  name: 'search_knowledge',
  description:
    'Semantic search across the Merris knowledge base. Searches climate science, regulations, sustainable finance, environmental data, supply chain, and research. Returns the most relevant entries.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (natural language)' },
      domains: {
        type: 'array',
        items: { type: 'string', enum: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7'] },
        description: 'Limit to specific domains (optional)',
      },
      limit: { type: 'number', description: 'Max results (default 5)' },
    },
    required: ['query'],
  },
  handler: async (input) => {
    const query = input['query'] as string;
    const domains = input['domains'] as string[] | undefined;
    const limit = (input['limit'] as number) || 5;

    try {
      const results = await semanticSearch({ query, domains, limit });

      return {
        found: results.length,
        results: results.map((r) => ({
          title: r.title,
          domain: r.domain,
          source: r.source,
          score: r.score,
          description: r.description?.substring(0, 300),
          year: r.year,
          collection: r.collection,
          sourceUrl: (r as any).data?.sourceUrl || (r as any).sourceUrl || undefined,
          id: r.id,
          ingested: r.ingested,
        })),
      };
    } catch (err: any) {
      logger.error('search_knowledge failed', err);
      return { error: 'Semantic search failed', details: err.message };
    }
  },
};

// ============================================================
// 14b. search_kb_dense (Voyage AI dense search across M01-M14 docs)
// ============================================================

const searchKbDenseTool: ToolDefinition = {
  name: 'search_kb_dense',
  description:
    'Semantic search using dense Voyage AI vectors across the full M01-M14 knowledge base (9000+ documents: regulatory PDFs, emission factor tables, framework guides, case law, research papers, jurisdiction data, XLSX templates). Use this when search_knowledge returns no results or the user asks about specific standards, regulations, benchmarks, or sector data.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language search query' },
      modules: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M11','M12','M13','M14'],
        },
        description: 'Limit to specific KB modules (optional). M01=regulatory, M02=frameworks, M03=emission-factors, M04=benchmarks, M05=climate, M06=carbon-markets, M07=environmental, M08=social, M09=financial, M10=sector, M11=jurisdictions, M12=templates, M13=caselaw, M14=research',
      },
      limit: { type: 'number', description: 'Max results (default 5, max 20)' },
    },
    required: ['query'],
  },
  handler: async (input) => {
    const query   = input['query'] as string;
    const modules = input['modules'] as string[] | undefined;
    const limit   = Math.min((input['limit'] as number) || 5, 20);

    try {
      const results = await denseSearch({ query, modules, limit, minScore: 0.25 });

      if (results.length === 0) {
        return {
          found: 0,
          message: 'No relevant chunks found. The dense KB may not be embedded yet, or try a broader query.',
        };
      }

      return {
        found: results.length,
        results: results.map((r) => ({
          module:     r.module,
          filename:   r.filename,
          fileType:   r.fileType,
          chunkIndex: r.chunkIndex,
          score:      r.score,
          excerpt:    r.text.substring(0, 600),
        })),
      };
    } catch (err: any) {
      logger.error('search_kb_dense failed', err);
      return { error: 'Dense KB search failed', details: err.message };
    }
  },
};

// ============================================================
// 15. get_regulatory_context (K3 Regulatory Search)
// ============================================================

const getRegulatoryContextTool: ToolDefinition = {
  name: 'get_regulatory_context',
  description:
    'Find relevant regulatory requirements, legal obligations, or compliance guidance for a specific topic or jurisdiction.',
  input_schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Topic to search for (e.g., "carbon reporting", "water disclosure")' },
      jurisdiction: { type: 'string', description: 'Jurisdiction filter (e.g., EU, Saudi Arabia, Qatar, UAE)' },
    },
    required: ['topic'],
  },
  handler: async (input) => {
    const topic = input['topic'] as string;
    const jurisdiction = input['jurisdiction'] as string | undefined;

    try {
      // Direct MongoDB query on K3 for jurisdiction-specific results
      const directFilter: Record<string, any> = {};
      if (jurisdiction) {
        directFilter['jurisdiction'] = { $regex: new RegExp(jurisdiction, 'i') };
      }

      const directResults = await RegulatoryModel.find(directFilter)
        .lean();

      // Also run semantic search on K3
      const semanticResults = await semanticSearch({
        query: `${topic}${jurisdiction ? ' ' + jurisdiction : ''}`,
        domains: ['K3'],
        limit: 10,
      });

      // Merge: prefer semantic results but include jurisdiction-filtered direct results
      const semanticIds = new Set(semanticResults.map((r) => r.id));

      const directMatches = directResults
        .filter((d: any) => !semanticIds.has(d._id.toString()))
        .filter((d: any) => {
          const text = `${d.name} ${d.description} ${d.requirements?.map((r: any) => r.title + ' ' + r.description).join(' ') || ''}`.toLowerCase();
          return text.includes(topic.toLowerCase());
        })
        .slice(0, 5)
        .map((d: any) => ({
          id: d._id.toString(),
          name: d.name,
          shortName: d.shortName,
          jurisdiction: d.jurisdiction,
          description: d.description?.substring(0, 300),
          category: d.category,
          year: d.year,
          requirementCount: d.requirements?.length || 0,
          score: 0.5, // Direct match gets moderate score
          ingested: d.ingested === true,
        }));

      return {
        topic,
        jurisdiction: jurisdiction || 'all',
        semanticResults: semanticResults.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description?.substring(0, 300),
          source: r.source,
          score: r.score,
          year: r.year,
          ingested: r.ingested,
        })),
        directMatches,
        totalFound: semanticResults.length + directMatches.length,
      };
    } catch (err: any) {
      logger.error('get_regulatory_context failed', err);
      return { error: 'Regulatory search failed', details: err.message };
    }
  },
};

// ============================================================
// 16. get_scientific_basis (K2 Climate Science Search)
// ============================================================

const getScientificBasisTool: ToolDefinition = {
  name: 'get_scientific_basis',
  description:
    'Find climate science data, IPCC findings, emission factors, or environmental benchmarks to support ESG claims.',
  input_schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Topic to search for (e.g., "water stress GCC", "emission factors electricity")' },
      dataType: {
        type: 'string',
        enum: ['emission_factors', 'scenarios', 'projections', 'benchmarks'],
        description: 'Type of scientific data to find',
      },
    },
    required: ['topic'],
  },
  handler: async (input) => {
    const topic = input['topic'] as string;
    const dataType = input['dataType'] as string | undefined;

    try {
      // Direct MongoDB query on K2
      const directFilter: Record<string, any> = {};
      if (dataType) {
        // Map dataType to K2 subcategories
        const subcategoryMap: Record<string, string[]> = {
          emission_factors: ['emission_factors', 'ghg_protocol'],
          scenarios: ['scenarios', 'pathways', 'rcp', 'ssp'],
          projections: ['projections', 'forecasts', 'trends'],
          benchmarks: ['benchmarks', 'targets', 'thresholds'],
        };
        const subcategories = subcategoryMap[dataType] || [];
        if (subcategories.length > 0) {
          directFilter['subcategory'] = { $regex: new RegExp(subcategories.join('|'), 'i') };
        }
      }

      const directResults = await ClimateScienceModel.find(directFilter)
        .lean();

      // Semantic search on K2
      const searchQuery = dataType ? `${topic} ${dataType}` : topic;
      const semanticResults = await semanticSearch({
        query: searchQuery,
        domains: ['K2'],
        limit: 10,
      });

      const semanticIds = new Set(semanticResults.map((r) => r.id));

      const directMatches = directResults
        .filter((d: any) => !semanticIds.has(d._id.toString()))
        .filter((d: any) => {
          const text = `${d.title} ${d.description}`.toLowerCase();
          return topic.toLowerCase().split(/\s+/).some((word) => text.includes(word));
        })
        .slice(0, 5)
        .map((d: any) => ({
          id: d._id.toString(),
          title: d.title,
          description: d.description?.substring(0, 300),
          source: d.source,
          category: d.category,
          subcategory: d.subcategory,
          year: d.year,
          score: 0.5,
          ingested: d.ingested === true,
        }));

      return {
        topic,
        dataType: dataType || 'all',
        semanticResults: semanticResults.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description?.substring(0, 300),
          source: r.source,
          score: r.score,
          year: r.year,
          ingested: r.ingested,
        })),
        directMatches,
        totalFound: semanticResults.length + directMatches.length,
      };
    } catch (err: any) {
      logger.error('get_scientific_basis failed', err);
      return { error: 'Scientific data search failed', details: err.message };
    }
  },
};

// ============================================================
// 17. get_emission_factor_live (Climatiq API)
// ============================================================

const getEmissionFactorLiveTool: ToolDefinition = {
  name: 'get_emission_factor_live',
  description:
    'Look up real-time emission factors from the Climatiq database (70,000+ factors). Use this when you need a specific emission factor for a country, activity, or fuel type that may not be in the static database.',
  input_schema: {
    type: 'object',
    properties: {
      activity: {
        type: 'string',
        description: 'Activity description (e.g., "electricity", "natural gas combustion", "diesel fuel")',
      },
      country: {
        type: 'string',
        description: 'Country code or name (e.g., "QA", "Qatar", "US")',
      },
      year: {
        type: 'number',
        description: 'Year for the emission factor (optional)',
      },
      category: {
        type: 'string',
        description: 'Category filter (e.g., "Fuel", "Electricity", "Transport")',
      },
    },
    required: ['activity'],
  },
  handler: async (input) => {
    return getEmissionFactorLive(input as any);
  },
};

// ============================================================
// 18. get_water_stress (WRI Aqueduct 4.0)
// ============================================================

const getWaterStressTool: ToolDefinition = {
  name: 'get_water_stress',
  description:
    'Look up country-level water stress data from WRI Aqueduct 4.0. Returns water stress score (0-5), depletion score, and risk label for a given country.',
  input_schema: {
    type: 'object',
    properties: {
      country: { type: 'string', description: 'Country name (e.g., "Saudi Arabia", "Qatar")' },
      countryCode: { type: 'string', description: 'ISO 2-letter country code (e.g., "SA", "QA")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getWaterStress(input as { country?: string; countryCode?: string });
  },
};

// ============================================================
// 19. get_climate_vulnerability (ND-GAIN)
// ============================================================

const getClimateVulnerabilityTool: ToolDefinition = {
  name: 'get_climate_vulnerability',
  description:
    'Look up climate vulnerability and readiness data from the ND-GAIN Country Index. Returns ND-GAIN score, vulnerability score, readiness score, and global ranking for a given country.',
  input_schema: {
    type: 'object',
    properties: {
      country: { type: 'string', description: 'Country name (e.g., "Saudi Arabia", "Qatar")' },
      countryCode: { type: 'string', description: 'ISO 2-letter country code (e.g., "SA", "QA")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getClimateVulnerability(input as { country?: string; countryCode?: string });
  },
};

// ============================================================
// 20. get_sbti_status (SBTi Companies Taking Action)
// ============================================================

const getSBTiStatusTool: ToolDefinition = {
  name: 'get_sbti_status',
  description:
    'Look up Science Based Targets initiative (SBTi) commitment status for companies. Search by company name, sector, or country. Returns target status, classification, and net-zero commitment details.',
  input_schema: {
    type: 'object',
    properties: {
      companyName: { type: 'string', description: 'Company name to search (e.g., "SABIC", "Shell")' },
      sector: { type: 'string', description: 'Industry sector filter (e.g., "Oil & Gas", "Steel")' },
      country: { type: 'string', description: 'Country code filter (e.g., "SA", "GB")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getSBTiStatus(input as { companyName?: string; sector?: string; country?: string });
  },
};

// ============================================================
// 21. get_forced_labour_risk (Walk Free Global Slavery Index)
// ============================================================

const getForcedLabourRiskTool: ToolDefinition = {
  name: 'get_forced_labour_risk',
  description:
    'Look up forced labour / modern slavery risk data for a country from the Walk Free Global Slavery Index 2023. Returns prevalence per 1000 people, estimated victims, vulnerability score, government response score, and import risk value.',
  input_schema: {
    type: 'object',
    properties: {
      country: { type: 'string', description: 'Country name (e.g., "Qatar", "Saudi Arabia")' },
      countryCode: { type: 'string', description: 'ISO 2-letter country code (e.g., "QA", "SA")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getForcedLabourRisk(input as { country?: string; countryCode?: string });
  },
};

// ============================================================
// 22. get_product_labour_risk (US DOL ILAB)
// ============================================================

const getProductLabourRiskTool: ToolDefinition = {
  name: 'get_product_labour_risk',
  description:
    'Search for goods/products produced with forced or child labour from the US DOL ILAB List of Goods 2024. Filter by product name, country, or sector. Covers steel, electronics, textiles, agriculture, mining, and construction materials.',
  input_schema: {
    type: 'object',
    properties: {
      product: { type: 'string', description: 'Product or good name (e.g., "Steel", "Cotton", "Bricks")' },
      country: { type: 'string', description: 'Country of origin (e.g., "China", "India")' },
      sector: { type: 'string', description: 'Industry sector (e.g., "Manufacturing", "Mining", "Agriculture")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getProductLabourRisk(input as { product?: string; country?: string; sector?: string });
  },
};

// ============================================================
// 23. get_threatened_species (IUCN Red List)
// ============================================================

const getThreatenedSpeciesTool: ToolDefinition = {
  name: 'get_threatened_species',
  description:
    'Look up threatened species count for a country from the IUCN Red List. Returns total threatened species, breakdown by group (mammals, birds, reptiles, amphibians, fish, plants), and IUCN category counts when API token is available.',
  input_schema: {
    type: 'object',
    properties: {
      country: { type: 'string', description: 'Country name (e.g., "Qatar", "Saudi Arabia")' },
      countryCode: { type: 'string', description: 'ISO 2-letter country code (e.g., "QA", "SA", "AE")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getThreatenedSpecies(input as { country?: string; countryCode?: string });
  },
};

// ============================================================
// 24. get_species_near (GBIF)
// ============================================================

const getSpeciesNearTool: ToolDefinition = {
  name: 'get_species_near',
  description:
    'Find species observed near a geographic location using GBIF (Global Biodiversity Information Facility). Returns unique species list with occurrence counts within a given radius.',
  input_schema: {
    type: 'object',
    properties: {
      lat: { type: 'number', description: 'Latitude of the location' },
      lon: { type: 'number', description: 'Longitude of the location' },
      radiusKm: { type: 'number', description: 'Search radius in kilometers (default 50)' },
    },
    required: ['lat', 'lon'],
  },
  handler: async (input) => {
    return getSpeciesNear(input as { lat: number; lon: number; radiusKm?: number });
  },
};

// ============================================================
// 25. get_species_status (GBIF)
// ============================================================

const getSpeciesStatusTool: ToolDefinition = {
  name: 'get_species_status',
  description:
    'Get taxonomic details for a species from GBIF. Returns scientific name, kingdom, phylum, class, order, family, and taxonomic status.',
  input_schema: {
    type: 'object',
    properties: {
      speciesName: { type: 'string', description: 'Species name to look up (e.g., "Dugong dugon", "Oryx leucoryx")' },
    },
    required: ['speciesName'],
  },
  handler: async (input) => {
    return getSpeciesStatus(input as { speciesName: string });
  },
};

// ============================================================
// 26. get_deforestation_data (Global Forest Watch)
// ============================================================

const getDeforestationDataTool: ToolDefinition = {
  name: 'get_deforestation_data',
  description:
    'Get country-level deforestation data from Global Forest Watch (GFW 2023). Returns tree cover loss (ha), primary forest loss (ha), and CO2 from loss (Mt).',
  input_schema: {
    type: 'object',
    properties: {
      countryCode: { type: 'string', description: 'ISO 3166-1 alpha-2 country code (e.g., "BR", "ID")' },
      country: { type: 'string', description: 'Country name (e.g., "Brazil", "Indonesia")' },
      year: { type: 'number', description: 'Data year (e.g., 2023)' },
    },
    required: [],
  },
  handler: async (input) => {
    return getDeforestationData(input as { countryCode?: string; country?: string; year?: number });
  },
};

// ============================================================
// 27. get_protected_areas (UNEP Protected Planet)
// ============================================================

const getProtectedAreasTool: ToolDefinition = {
  name: 'get_protected_areas',
  description:
    'Get protected areas for a country from UNEP Protected Planet. Returns IUCN category, area (km2), coordinates, marine status, and proximity to industrial zones.',
  input_schema: {
    type: 'object',
    properties: {
      countryCode: { type: 'string', description: 'ISO 3166-1 alpha-2 country code (e.g., "QA", "AE", "SA", "OM")' },
      country: { type: 'string', description: 'Country name (e.g., "Qatar", "UAE", "Saudi Arabia", "Oman")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getProtectedAreas(input as { countryCode?: string; country?: string });
  },
};

// ============================================================
// 28. get_protected_areas_near (UNEP Protected Planet - proximity)
// ============================================================

const getProtectedAreasNearTool: ToolDefinition = {
  name: 'get_protected_areas_near',
  description:
    'Find protected areas near a geographic coordinate. Returns protected areas within a given radius (default 200km), sorted by distance.',
  input_schema: {
    type: 'object',
    properties: {
      lat: { type: 'number', description: 'Latitude of the point to search near' },
      lon: { type: 'number', description: 'Longitude of the point to search near' },
      radiusKm: { type: 'number', description: 'Search radius in kilometres (default: 200)' },
    },
    required: ['lat', 'lon'],
  },
  handler: async (input) => {
    return getProtectedAreasNear(input as { lat: number; lon: number; radiusKm?: number });
  },
};

// ============================================================
// 29. get_knowthechain_score (KnowTheChain)
// ============================================================

const getKnowTheChainScoreTool: ToolDefinition = {
  name: 'get_knowthechain_score',
  description:
    'Get KnowTheChain forced-labour benchmark scores for a company. Returns overall score and theme scores (commitment, traceability, purchasing, recruitment, worker_voice, monitoring, remedy).',
  input_schema: {
    type: 'object',
    properties: {
      company: { type: 'string', description: 'Company name (e.g., "Apple", "Nestle", "Adidas")' },
    },
    required: ['company'],
  },
  handler: async (input) => {
    return getKnowTheChainScore(input as { company?: string });
  },
};

// ============================================================
// 30. get_knowthechain_sector (KnowTheChain - sector benchmark)
// ============================================================

const getKnowTheChainSectorTool: ToolDefinition = {
  name: 'get_knowthechain_sector',
  description:
    'Get KnowTheChain benchmark scores for all companies in a sector. Returns companies ranked by overall score. Sectors: ICT, Food & Beverage, Apparel.',
  input_schema: {
    type: 'object',
    properties: {
      sector: { type: 'string', description: 'Sector name (e.g., "ICT", "Food & Beverage", "Apparel")' },
    },
    required: ['sector'],
  },
  handler: async (input) => {
    return getKnowTheChainSector(input as { sector: string });
  },
};

// ============================================================
// 31. get_country_emissions (EDGAR)
// ============================================================

const getCountryEmissionsTool: ToolDefinition = {
  name: 'get_country_emissions',
  description:
    'Look up national greenhouse gas emissions from the EDGAR database. Returns total GHG (MtCO2e), CO2, and sector breakdown (energy, industrial, waste, agriculture) for a given country and year.',
  input_schema: {
    type: 'object',
    properties: {
      country: { type: 'string', description: 'Country name (e.g., "Saudi Arabia", "Qatar")' },
      countryCode: { type: 'string', description: 'ISO 2-letter country code (e.g., "SA", "QA")' },
      year: { type: 'number', description: 'Emissions year (default 2023)' },
      sector: { type: 'string', description: 'Filter by sector (e.g., "total")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getCountryEmissions(input as { countryCode?: string; country?: string; year?: number; sector?: string });
  },
};

// ============================================================
// 32. get_ndc_target (Climate Watch / UNFCCC)
// ============================================================

const getNDCTargetTool: ToolDefinition = {
  name: 'get_ndc_target',
  description:
    'Look up a country\'s Paris Agreement Nationally Determined Contribution (NDC) target. Returns NDC version, target type, target value, base year, target year, and sectors covered.',
  input_schema: {
    type: 'object',
    properties: {
      country: { type: 'string', description: 'Country name (e.g., "Saudi Arabia", "Qatar")' },
      countryCode: { type: 'string', description: 'ISO 2-letter country code (e.g., "SA", "QA")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getNDCTarget(input as { countryCode?: string; country?: string });
  },
};

// ============================================================
// 33. get_corruption_index (Transparency International CPI)
// ============================================================

const getCorruptionIndexTool: ToolDefinition = {
  name: 'get_corruption_index',
  description:
    'Look up a country\'s Corruption Perceptions Index (CPI) score and global rank from Transparency International. Score is 0-100 where 100 is very clean.',
  input_schema: {
    type: 'object',
    properties: {
      country: { type: 'string', description: 'Country name (e.g., "Saudi Arabia", "Qatar")' },
      countryCode: { type: 'string', description: 'ISO 2-letter country code (e.g., "SA", "QA")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getCorruptionIndex(input as { countryCode?: string; country?: string });
  },
};

// ============================================================
// 34. get_facility_emissions (Climate TRACE)
// ============================================================

const getFacilityEmissionsTool: ToolDefinition = {
  name: 'get_facility_emissions',
  description:
    'Look up sector-level industrial emissions from Climate TRACE for GCC countries. Returns emissions (MtCO2e) by sector (electricity, oil & gas, refining, petrochemicals, steel, cement, aluminium).',
  input_schema: {
    type: 'object',
    properties: {
      country: { type: 'string', description: 'Country name (e.g., "Saudi Arabia", "Qatar")' },
      countryCode: { type: 'string', description: 'ISO 2-letter country code (e.g., "SA", "QA")' },
      sector: { type: 'string', description: 'Sector name (e.g., "electricity_generation", "oil_and_gas_production")' },
      year: { type: 'number', description: 'Emissions year (default 2023)' },
    },
    required: [],
  },
  handler: async (input) => {
    return getFacilityEmissions(input as { countryCode?: string; country?: string; sector?: string; year?: number });
  },
};

// ============================================================
// 35. get_assurance_requirement (Assurance Standards KB)
// ============================================================

const getAssuranceRequirementTool: ToolDefinition = {
  name: 'get_assurance_requirement',
  description:
    'Look up assurance requirements for a given ESG reporting framework. Returns applicable assurance standards, what verifiers check, triggers for qualification, and evidence requirements. Frameworks: CSRD/ESRS, GRI, ISSB, GHG Protocol, CDP, TCFD, EU ETS, CBAM, Saudi Exchange ESG, ADX ESG, QSE ESG.',
  input_schema: {
    type: 'object',
    properties: {
      framework: { type: 'string', description: 'ESG framework name (e.g., "CSRD/ESRS", "GRI", "ISSB", "GHG Protocol", "CDP", "TCFD")' },
      jurisdiction: { type: 'string', description: 'Optional jurisdiction filter (e.g., "EU", "GCC")' },
    },
    required: ['framework'],
  },
  handler: async (input) => {
    return getAssuranceRequirement(input as { framework: string; jurisdiction?: string });
  },
};

// ============================================================
// 36. get_verifier_checklist (Assurance Standards KB)
// ============================================================

const getVerifierChecklistTool: ToolDefinition = {
  name: 'get_verifier_checklist',
  description:
    'Get the full verifier checklist for a specific assurance standard. Returns what verifiers check, triggers for qualified opinions, and evidence requirements. Standard codes: ISAE_3000, ISAE_3410, EU_AVR, AA1000AS_v3, ISO_14064_3, CSRD_ASSURANCE, CBAM_VERIFICATION, GCC_ASSURANCE.',
  input_schema: {
    type: 'object',
    properties: {
      standardCode: { type: 'string', description: 'Assurance standard code (e.g., "ISAE_3000", "ISAE_3410", "CSRD_ASSURANCE")' },
    },
    required: ['standardCode'],
  },
  handler: async (input) => {
    return getVerifierChecklist(input as { standardCode: string });
  },
};

// ============================================================
// 37. get_abatement_options (Abatement Technologies KB)
// ============================================================

const getAbatementOptionsTool: ToolDefinition = {
  name: 'get_abatement_options',
  description:
    'Look up ranked abatement technologies with costs ($/tCO2e), abatement potential (%), TRL, and CAPEX for a given sector. Covers steel, petrochemicals, oil & gas, cement, aluminium. Optionally filter by region (GCC, EU, Global).',
  input_schema: {
    type: 'object',
    properties: {
      sector: { type: 'string', description: 'Industry sector (e.g., "steel", "cement", "oil_and_gas", "petrochemicals", "aluminium")' },
      region: { type: 'string', description: 'Region filter (e.g., "GCC", "EU", "Global")' },
    },
    required: ['sector'],
  },
  handler: async (input) => {
    return getAbatementOptions(input as { sector: string; region?: string });
  },
};

// ============================================================
// 38. get_carbon_price (Carbon Pricing KB)
// ============================================================

const getCarbonPriceTool: ToolDefinition = {
  name: 'get_carbon_price',
  description:
    'Look up current and projected carbon pricing (ETS, carbon tax, CBAM) by jurisdiction or scheme type. Also supports IEA NZE/APS and NGFS scenario pricing with year-by-year projections. For scenarios, provide the scenario parameter.',
  input_schema: {
    type: 'object',
    properties: {
      jurisdiction: { type: 'string', description: 'Jurisdiction (e.g., "European Union", "Saudi Arabia", "China", "Global (IEA NZE)")' },
      scheme_type: { type: 'string', description: 'Scheme type filter (e.g., "ETS", "carbon_tax", "CBAM", "scenario", "proposed")' },
      scenario: { type: 'string', description: 'For scenario lookup: scenario name (e.g., "NZE", "APS", "NGFS")' },
      year: { type: 'number', description: 'For scenario lookup: target year for price projection (e.g., 2030, 2040, 2050)' },
    },
    required: [],
  },
  handler: async (input) => {
    const { scenario, year, ...rest } = input as { jurisdiction?: string; scheme_type?: string; scenario?: string; year?: number };
    if (scenario) {
      return getCarbonPriceScenario({ scenario, year });
    }
    return getCarbonPrice(rest);
  },
};

// ============================================================
// 39. get_energy_instrument (Energy Instruments KB)
// ============================================================

const getEnergyInstrumentTool: ToolDefinition = {
  name: 'get_energy_instrument',
  description:
    'Look up renewable energy instruments (I-REC, EU GO, US REC, PPA) by type or country. Returns GHG Protocol qualification status, Scope 2 method applicability, and GCC market availability.',
  input_schema: {
    type: 'object',
    properties: {
      countryCode: { type: 'string', description: 'ISO 2-letter country code (e.g., "SA", "AE", "QA")' },
      instrumentType: { type: 'string', description: 'Instrument type (e.g., "I-REC", "EU_GO", "US_REC", "PPA_physical", "PPA_virtual", "country_status")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getEnergyInstrument(input as { countryCode?: string; instrumentType?: string });
  },
};

// ============================================================
// 40. get_rec_market_status (REC Market Status by country)
// ============================================================

const getRECMarketStatusTool: ToolDefinition = {
  name: 'get_rec_market_status',
  description:
    'Get the renewable energy certificate market status for a specific country. Returns GHG Protocol qualifying instruments available, country-specific status, and Scope 2 market-based method applicability. Critical for GCC companies needing Scope 2 market-based reporting.',
  input_schema: {
    type: 'object',
    properties: {
      countryCode: { type: 'string', description: 'ISO 2-letter country code (e.g., "SA", "AE", "QA", "BH", "OM", "KW")' },
    },
    required: ['countryCode'],
  },
  handler: async (input) => {
    return getRECMarketStatus(input as { countryCode: string });
  },
};

// ============================================================
// 41. get_decarbonisation_pathway (Sector Pathways KB)
// ============================================================

const getDecarbonisationPathwayTool: ToolDefinition = {
  name: 'get_decarbonisation_pathway',
  description:
    'Look up sector decarbonisation pathways from IEA NZE, SBTi, and TPI. Returns intensity milestones (2025-2050), key levers, and base year intensity. Covers steel, cement, petrochemicals, oil & gas, power, aluminium.',
  input_schema: {
    type: 'object',
    properties: {
      sector: { type: 'string', description: 'Industry sector (e.g., "steel", "cement", "petrochemicals", "oil_and_gas", "power", "aluminium")' },
      source: { type: 'string', description: 'Pathway source filter (e.g., "IEA_NZE", "SBTi", "TPI")' },
    },
    required: ['sector'],
  },
  handler: async (input) => {
    return getDecarbonisationPathway(input as { sector: string; source?: string });
  },
};

// ============================================================
// 42. get_precedent (Precedent Case Library)
// ============================================================

const getPrecedentTool: ToolDefinition = {
  name: 'get_precedent',
  description:
    'Search landmark ESG precedent cases including greenwashing enforcement, litigation outcomes, and regulatory actions. Returns case details, jurisdiction, outcome, and relevance to current advisory context.',
  input_schema: {
    type: 'object',
    properties: {
      caseType: { type: 'string', description: 'Type of case (e.g., "greenwashing", "enforcement", "litigation", "regulatory_action")' },
      sector: { type: 'string', description: 'Industry sector filter' },
      jurisdiction: { type: 'string', description: 'Jurisdiction filter (e.g., "EU", "US", "UK", "AU")' },
    },
    required: [],
  },
  handler: async (input) => {
    return getPrecedent(input as { caseType?: string; sector?: string; jurisdiction?: string });
  },
};

// ============================================================
// 43. get_anomaly_check (Sector Benchmark Anomaly Detection)
// ============================================================

const getAnomalyCheckTool: ToolDefinition = {
  name: 'get_anomaly_check',
  description:
    'Check if a reported metric value is within expected range for a given sector. Returns whether the value is normal, borderline, or anomalous compared to sector benchmarks, with explanation and typical range.',
  input_schema: {
    type: 'object',
    properties: {
      sector: { type: 'string', description: 'Industry sector (e.g., "steel", "cement", "oil_and_gas")' },
      metric: { type: 'string', description: 'Metric name (e.g., "scope1_intensity", "water_intensity", "ltifr")' },
      value: { type: 'number', description: 'The reported metric value to check' },
    },
    required: ['sector', 'metric', 'value'],
  },
  handler: async (input) => {
    return getAnomalyCheck(input as { sector: string; metric: string; value: number });
  },
};

// ============================================================
// 44. get_partner_insight (Partner-Level Strategic Intelligence)
// ============================================================

const getPartnerInsightTool: ToolDefinition = {
  name: 'get_partner_insight',
  description:
    'Retrieve partner-level strategic insight for a specific ESG domain topic. Returns senior advisory perspective on market dynamics, regulatory trajectory, competitive positioning, and strategic recommendations.',
  input_schema: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: 'ESG domain (e.g., "climate", "governance", "supply_chain", "reporting", "finance")' },
      topic: { type: 'string', description: 'Specific topic within the domain (e.g., "carbon_border_adjustment", "board_composition", "scope3_strategy")' },
    },
    required: ['domain'],
  },
  handler: async (input) => {
    return getPartnerInsight(input as { domain: string; topic?: string });
  },
};
