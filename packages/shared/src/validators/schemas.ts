import { z } from 'zod';

// ============================================================
// Auth Schemas — v2
// ============================================================

export const NotificationSettingsSchema = z.object({
  email: z.boolean(),
  inApp: z.boolean(),
  teams: z.boolean(),
});

export const UserPreferencesSchema = z.object({
  language: z.enum(['en', 'ar']),
  timezone: z.string(),
  notifications: NotificationSettingsSchema,
});

export const UserRoleSchema = z.enum([
  'owner',
  'admin',
  'manager',
  'analyst',
  'reviewer',
  'auditor_readonly',
]);

export const PermissionSchema = z.object({
  resource: z.string(),
  actions: z.array(z.enum(['read', 'write', 'delete', 'approve'])),
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  orgId: z.string(),
  role: UserRoleSchema,
  permissions: z.array(PermissionSchema),
  mfaEnabled: z.boolean(),
  ssoProvider: z.string().optional(),
  preferences: UserPreferencesSchema,
});

// ============================================================
// Organization Schemas
// ============================================================

export const OrgTypeSchema = z.enum(['consulting', 'corporate', 'regulator']);

export const PlanTierSchema = z.enum(['starter', 'professional', 'enterprise']);

export const OrgSettingsSchema = z.object({
  language: z.enum(['en', 'ar']),
  timezone: z.string(),
  currency: z.string(),
});

export const BrandingConfigSchema = z.object({
  logo: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
});

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: OrgTypeSchema,
  plan: PlanTierSchema,
  region: z.string(),
  industry: z.string(),
  size: z.string(),
  settings: OrgSettingsSchema,
  branding: BrandingConfigSchema,
});

export const ListingStatusSchema = z.enum(['listed', 'private', 'state_owned', 'sme']);

export const MaturityLevelSchema = z.enum(['none', 'beginner', 'intermediate', 'advanced']);

export const FacilitySchema = z.object({
  name: z.string(),
  type: z.string(),
  country: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  scope1Sources: z.array(z.string()).optional(),
});

export const ReportingHistoryEntrySchema = z.object({
  year: z.number(),
  frameworks: z.array(z.string()),
  url: z.string().optional(),
});

export const OrgProfileSchema = z.object({
  orgId: z.string(),
  legalName: z.string(),
  tradingName: z.string(),
  country: z.string(),
  region: z.string(),
  city: z.string(),
  industryGICS: z.string(),
  subIndustry: z.string(),
  listingStatus: ListingStatusSchema,
  exchange: z.string().optional(),
  employeeCount: z.number(),
  revenueRange: z.string(),
  facilities: z.array(FacilitySchema),
  supplyChainComplexity: z.string(),
  currentFrameworks: z.array(z.string()),
  esgMaturity: MaturityLevelSchema,
  reportingHistory: z.array(ReportingHistoryEntrySchema),
});

// ============================================================
// Engagement Schemas
// ============================================================

export const EngagementStatusSchema = z.enum([
  'setup',
  'data_collection',
  'drafting',
  'review',
  'assurance',
  'completed',
]);

export const ReportTypeSchema = z.enum([
  'sustainability_report',
  'esg_report',
  'tcfd_report',
  'integrated_report',
  'cdp_response',
  'custom',
]);

export const EngagementScopeSchema = z.object({
  reportingPeriod: z.object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  }),
  baselineYear: z.number().optional(),
  reportType: ReportTypeSchema,
  assuranceLevel: z.enum(['none', 'limited', 'reasonable']).optional(),
});

export const EngagementSettingsSchema = z.object({
  clientVisible: z.boolean(),
});

export const EngagementSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  clientOrgId: z.string().optional(),
  name: z.string(),
  scope: EngagementScopeSchema,
  frameworks: z.array(z.string()),
  deadline: z.coerce.date(),
  teamId: z.string(),
  status: EngagementStatusSchema,
  settings: EngagementSettingsSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ============================================================
// Framework Schemas
// ============================================================

export const FrameworkTypeSchema = z.enum(['mandatory', 'voluntary', 'rating', 'taxonomy']);

export const MetricDefinitionSchema = z.object({
  name: z.string(),
  unit: z.string(),
  calculationMethod: z.string().optional(),
  description: z.string(),
});

export const CrossReferenceSchema = z.object({
  frameworkCode: z.string(),
  disclosureCode: z.string(),
  mappingType: z.enum(['equivalent', 'partial', 'related']),
  notes: z.string().optional(),
});

export const DisclosureSchema = z.object({
  id: z.string(),
  frameworkId: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  topic: z.string(),
  dataType: z.enum(['quantitative', 'qualitative', 'narrative', 'table']),
  requiredMetrics: z.array(MetricDefinitionSchema),
  guidanceText: z.string(),
  sectorSpecific: z.boolean(),
  sectors: z.array(z.string()).optional(),
  crossReferences: z.array(CrossReferenceSchema),
});

export const TopicSchema = z.object({
  code: z.string(),
  name: z.string(),
  disclosures: z.array(DisclosureSchema),
});

export const FrameworkStructureSchema = z.object({
  topics: z.array(TopicSchema),
});

export const FrameworkSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  version: z.string(),
  effectiveDate: z.coerce.date(),
  issuingBody: z.string(),
  region: z.string(),
  type: FrameworkTypeSchema,
  structure: FrameworkStructureSchema,
});

export const EmissionFactorSchema = z.object({
  source: z.string(),
  country: z.string(),
  gridRegion: z.string().optional(),
  year: z.number(),
  factor: z.number(),
  unit: z.string(),
  scope: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  category: z.string().optional(),
  fuelType: z.string().optional(),
  activityType: z.string().optional(),
});

// ============================================================
// DataPoint Schemas
// ============================================================

export const DataPointStatusSchema = z.enum([
  'auto_extracted',
  'user_confirmed',
  'user_edited',
  'estimated',
  'missing',
]);

export const ExtractionMethodSchema = z.enum([
  'ocr',
  'table_parse',
  'llm_extract',
  'calculation',
  'manual',
]);

export const AuditEntrySchema = z.object({
  action: z.string(),
  userId: z.string().optional(),
  timestamp: z.coerce.date(),
  previousValue: z.any().optional(),
  newValue: z.any().optional(),
  notes: z.string().optional(),
});

export const DataPointSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  documentId: z.string().optional(),
  frameworkRef: z.string(),
  metricName: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string(),
  period: z.object({
    year: z.number(),
    quarter: z.number().optional(),
  }),
  sourceDocumentId: z.string().optional(),
  sourcePage: z.number().optional(),
  sourceCell: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  status: DataPointStatusSchema,
  extractionMethod: ExtractionMethodSchema,
  auditTrail: z.array(AuditEntrySchema),
});

// ============================================================
// Document Schemas
// ============================================================

export const DocumentStatusSchema = z.enum(['queued', 'processing', 'ingested', 'failed']);

export const ExtractedDataPointSchema = z.object({
  metric: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string(),
  confidence: z.number(),
  pageRef: z.number().optional(),
  cellRef: z.string().optional(),
});

export const ESGDocumentSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  orgId: z.string(),
  filename: z.string(),
  format: z.string(),
  size: z.number(),
  hash: z.string(),
  uploadSource: z.enum(['sharepoint', 'manual', 'email', 'api']),
  status: DocumentStatusSchema,
  extractedData: z.array(ExtractedDataPointSchema),
  extractedText: z.string().optional(),
  vectorEmbeddingId: z.string().optional(),
  uploadedAt: z.coerce.date(),
  processedAt: z.coerce.date().optional(),
});

// ============================================================
// Calculation Schemas
// ============================================================

export const CalculationMethodSchema = z.enum([
  'ghg_scope1',
  'ghg_scope2_location',
  'ghg_scope2_market',
  'ghg_scope3_cat1_spend',
  'ghg_scope3_cat1_supplier',
  'ghg_scope3_cat3',
  'ghg_scope3_cat6',
  'ghg_scope3_cat7',
  'water_consumption',
  'waste_by_type',
  'safety_ltifr',
  'safety_trir',
  'energy_total',
  'intensity_revenue',
  'intensity_employee',
  'yoy_change',
  // Climate Risk (17-21)
  'carbon_budget_remaining',
  'physical_risk_score',
  'stranded_asset_value',
  'carbon_price_impact',
  'sbti_validation',
  // Sustainable Finance (22-26)
  'portfolio_carbon_footprint',
  'portfolio_carbon_intensity',
  'eu_taxonomy_alignment',
  'green_bond_allocation',
  'waci',
  // Environmental (27-29)
  'water_footprint',
  'biodiversity_msa_loss',
  'circular_economy_mci',
]);

export const CalculationRequestSchema = z.object({
  method: CalculationMethodSchema,
  inputs: z.record(z.any()),
  engagementId: z.string(),
  disclosureRef: z.string(),
});

export const CalculationResultSchema = z.object({
  method: CalculationMethodSchema,
  result: z.union([z.number(), z.record(z.any())]),
  unit: z.string(),
  inputs: z.record(z.any()),
  emissionFactors: z.array(EmissionFactorSchema).optional(),
  methodology: z.string(),
  uncertainty: z.number().optional(),
  auditTrail: z.string(),
});

// ============================================================
// Agent Schemas
// ============================================================

export const ToolCallSchema = z.object({
  name: z.string(),
  input: z.record(z.any()),
  output: z.any().optional(),
});

export const AgentMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.coerce.date(),
  toolCalls: z.array(ToolCallSchema).optional(),
});

export const DataCompletenessReportSchema = z.object({
  totalRequired: z.number(),
  completed: z.number(),
  missing: z.number(),
  byFramework: z.array(z.object({
    frameworkCode: z.string(),
    total: z.number(),
    completed: z.number(),
  })),
});

export const AgentContextSchema = z.object({
  engagementId: z.string(),
  orgProfile: OrgProfileSchema,
  activeFrameworks: z.array(FrameworkSchema),
  dataCompleteness: DataCompletenessReportSchema,
  currentStage: EngagementStatusSchema,
  userRole: UserRoleSchema,
  conversationHistory: z.array(AgentMessageSchema).optional(),
});

// ============================================================
// Report Schemas
// ============================================================

export const ReportStatusSchema = z.enum([
  'draft',
  'in_review',
  'partner_approved',
  'client_approved',
  'final',
]);

export const ReviewCommentSchema = z.object({
  userId: z.string(),
  content: z.string(),
  timestamp: z.coerce.date(),
  resolved: z.boolean(),
});

export const ReportSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  frameworkRef: z.string().optional(),
  disclosures: z.array(z.string()),
  content: z.string().optional(),
  dataPoints: z.array(z.string()),
  status: z.enum(['pending', 'drafted', 'reviewed', 'approved']),
  reviewComments: z.array(ReviewCommentSchema).optional(),
});

export const ReportSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  title: z.string(),
  type: ReportTypeSchema,
  language: z.enum(['en', 'ar', 'bilingual']),
  status: ReportStatusSchema,
  structure: z.array(ReportSectionSchema),
  generatedAt: z.coerce.date().optional(),
  exportFormats: z.array(z.enum(['docx', 'pdf', 'html'])),
});

// ============================================================
// Presentation Schemas
// ============================================================

export const DeckTypeSchema = z.enum([
  'board_pack',
  'investor_presentation',
  'client_deliverable',
  'strategy_deck',
  'training_deck',
  'due_diligence_summary',
  'regulatory_submission',
]);

export const ChartTypeSchema = z.enum([
  'bar',
  'line',
  'pie',
  'waterfall',
  'radar',
  'bubble',
  'sankey',
  'treemap',
]);

export const SlideLayoutSchema = z.enum([
  'title',
  'kpi_dashboard',
  'chart',
  'comparison',
  'timeline',
  'table',
  'narrative',
  'section_divider',
]);

export const SlideContentSchema = z.object({
  text: z.string().optional(),
  dataPoints: z.array(z.string()).optional(),
  chartType: ChartTypeSchema.optional(),
  chartData: z.any().optional(),
  tableData: z.any().optional(),
});

export const SlideSpecSchema = z.object({
  id: z.string(),
  title: z.string(),
  layout: SlideLayoutSchema,
  content: SlideContentSchema,
  speakerNotes: z.string().optional(),
});

export const PresentationSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  title: z.string(),
  type: DeckTypeSchema,
  slides: z.array(SlideSpecSchema),
  branding: BrandingConfigSchema,
  status: z.enum(['draft', 'final']),
  generatedAt: z.coerce.date().optional(),
});

// ============================================================
// Workflow Schemas
// ============================================================

export const WorkflowTriggerSchema = z.object({
  event: z.string(),
  action: z.string(),
  target: z.string().optional(),
});

export const WorkflowStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'active', 'completed', 'skipped']),
  approvers: z.array(z.string()),
  requiredApprovals: z.number(),
  autoTransition: z.boolean(),
  triggers: z.array(WorkflowTriggerSchema),
});

export const WorkflowDefinitionSchema = z.object({
  engagementId: z.string(),
  stages: z.array(WorkflowStageSchema),
  currentStage: z.string(),
});
