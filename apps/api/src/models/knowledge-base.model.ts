/**
 * Merris Knowledge Base Models
 *
 * 7 collections covering the full ESG knowledge domain:
 * K1: Corporate Disclosures (Phase 2 — PDF ingestion)
 * K2: Climate Science + Physical Data
 * K3: Regulatory + Legal
 * K4: Sustainable Finance + Markets
 * K5: Environmental Science + Biodiversity
 * K6: Supply Chain + Human Rights
 * K7: Research + Thought Leadership
 */

import mongoose, { Schema, Document } from 'mongoose';

// ============================================================
// K1: Corporate Disclosures (metadata only — PDFs ingested via pipeline)
// ============================================================

export interface ICorporateDisclosure extends Document {
  company: string;
  ticker?: string;
  exchange?: string;
  country: string;
  region: string;
  sector: string;
  reportTitle: string;
  reportYear: number;
  reportType: 'sustainability_report' | 'esg_report' | 'climate_report' | 'integrated_report' | 'annual_report';
  sourceUrl?: string;
  pdfDocumentId?: mongoose.Types.ObjectId;
  status: 'pending_download' | 'downloaded' | 'ingested' | 'indexed';
  keyMetrics?: Record<string, any>;
  tags: string[];
  ingested: boolean;
}

const CorporateDisclosureSchema = new Schema<ICorporateDisclosure>(
  {
    company: { type: String, required: true },
    ticker: String,
    exchange: String,
    country: { type: String, required: true, index: true },
    region: { type: String, required: true, index: true },
    sector: { type: String, required: true, index: true },
    reportTitle: { type: String, required: true },
    reportYear: { type: Number, required: true, index: true },
    reportType: { type: String, required: true },
    sourceUrl: String,
    pdfDocumentId: Schema.Types.ObjectId,
    status: { type: String, default: 'pending_download' },
    keyMetrics: Schema.Types.Mixed,
    tags: [String],
    ingested: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CorporateDisclosureSchema.index({ company: 1, reportYear: 1 }, { unique: true });
CorporateDisclosureSchema.index({ company: 'text', reportTitle: 'text' });

export const CorporateDisclosureModel = mongoose.model<ICorporateDisclosure>(
  'CorporateDisclosure', CorporateDisclosureSchema, 'kb_corporate_disclosures'
);

// ============================================================
// K2: Climate Science + Physical Data
// ============================================================

export interface IClimateScienceEntry extends Document {
  source: string;
  category: 'ipcc' | 'iea' | 'ngfs' | 'wri' | 'ghg_protocol' | 'sbti' | 'other';
  subcategory: string;
  title: string;
  description: string;
  data: Record<string, any>;
  year: number;
  verified: boolean;
  tags: string[];
  ingested: boolean;
}

const ClimateScienceSchema = new Schema<IClimateScienceEntry>(
  {
    source: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    subcategory: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    year: { type: Number, required: true },
    verified: { type: Boolean, default: true },
    tags: [String],
    ingested: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ClimateScienceSchema.index({ source: 1, subcategory: 1, title: 1 }, { unique: true });
ClimateScienceSchema.index({ title: 'text', description: 'text' });

export const ClimateScienceModel = mongoose.model<IClimateScienceEntry>(
  'ClimateScience', ClimateScienceSchema, 'kb_climate_science'
);

// ============================================================
// K3: Regulatory + Legal
// ============================================================

export interface IRegulatoryEntry extends Document {
  jurisdiction: string;
  category: 'eu_regulation' | 'gcc_regulation' | 'international_standard' | 'enforcement' | 'guidance';
  name: string;
  shortName: string;
  description: string;
  effectiveDate?: Date;
  applicableTo: string[];
  requirements: Array<{
    article?: string;
    title: string;
    description: string;
    mandatory: boolean;
  }>;
  penalties?: string;
  sourceUrl?: string;
  data: Record<string, any>;
  year: number;
  verified: boolean;
  tags: string[];
  ingested: boolean;
}

const RegulatorySchema = new Schema<IRegulatoryEntry>(
  {
    jurisdiction: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    description: { type: String, required: true },
    effectiveDate: Date,
    applicableTo: [String],
    requirements: [{
      article: String,
      title: { type: String, required: true },
      description: { type: String, required: true },
      mandatory: { type: Boolean, default: true },
    }],
    penalties: String,
    sourceUrl: String,
    data: { type: Schema.Types.Mixed, default: {} },
    year: { type: Number, required: true },
    verified: { type: Boolean, default: true },
    tags: [String],
    ingested: { type: Boolean, default: false },
  },
  { timestamps: true }
);

RegulatorySchema.index({ shortName: 1, jurisdiction: 1 }, { unique: true });
RegulatorySchema.index({ name: 'text', description: 'text' });

export const RegulatoryModel = mongoose.model<IRegulatoryEntry>(
  'Regulatory', RegulatorySchema, 'kb_regulatory'
);

// ============================================================
// K4: Sustainable Finance + Markets
// ============================================================

export interface ISustainableFinanceEntry extends Document {
  source: string;
  category: 'green_bonds' | 'esg_ratings' | 'taxonomy' | 'pcaf' | 'market_data';
  subcategory: string;
  title: string;
  description: string;
  data: Record<string, any>;
  year: number;
  verified: boolean;
  tags: string[];
  ingested: boolean;
}

const SustainableFinanceSchema = new Schema<ISustainableFinanceEntry>(
  {
    source: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    subcategory: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    year: { type: Number, required: true },
    verified: { type: Boolean, default: true },
    tags: [String],
    ingested: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SustainableFinanceSchema.index({ source: 1, subcategory: 1, title: 1 }, { unique: true });

export const SustainableFinanceModel = mongoose.model<ISustainableFinanceEntry>(
  'SustainableFinance', SustainableFinanceSchema, 'kb_sustainable_finance'
);

// ============================================================
// K5: Environmental Science + Biodiversity
// ============================================================

export interface IEnvironmentalScienceEntry extends Document {
  source: string;
  category: 'tnfd' | 'biodiversity' | 'water_pollution' | 'circular_economy' | 'planetary_boundaries';
  subcategory: string;
  title: string;
  description: string;
  data: Record<string, any>;
  year: number;
  verified: boolean;
  tags: string[];
  ingested: boolean;
}

const EnvironmentalScienceSchema = new Schema<IEnvironmentalScienceEntry>(
  {
    source: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    subcategory: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    year: { type: Number, required: true },
    verified: { type: Boolean, default: true },
    tags: [String],
    ingested: { type: Boolean, default: false },
  },
  { timestamps: true }
);

EnvironmentalScienceSchema.index({ source: 1, subcategory: 1, title: 1 }, { unique: true });

export const EnvironmentalScienceModel = mongoose.model<IEnvironmentalScienceEntry>(
  'EnvironmentalScience', EnvironmentalScienceSchema, 'kb_environmental_science'
);

// ============================================================
// K6: Supply Chain + Human Rights
// ============================================================

export interface ISupplyChainEntry extends Document {
  source: string;
  category: 'due_diligence' | 'forced_labour' | 'conflict_minerals' | 'country_risk';
  subcategory: string;
  title: string;
  description: string;
  data: Record<string, any>;
  year: number;
  verified: boolean;
  tags: string[];
  ingested: boolean;
}

const SupplyChainSchema = new Schema<ISupplyChainEntry>(
  {
    source: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    subcategory: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    year: { type: Number, required: true },
    verified: { type: Boolean, default: true },
    tags: [String],
    ingested: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SupplyChainSchema.index({ source: 1, subcategory: 1, title: 1 }, { unique: true });

export const SupplyChainModel = mongoose.model<ISupplyChainEntry>(
  'SupplyChain', SupplyChainSchema, 'kb_supply_chain'
);

// ============================================================
// K7: Research + Thought Leadership
// ============================================================

export interface IResearchEntry extends Document {
  source: string;
  category: 'academic' | 'cop_outcomes' | 'big4_consulting' | 'sector_body';
  authors?: string[];
  title: string;
  publication?: string;
  year: number;
  abstract: string;
  keyFindings: string[];
  relevantSectors: string[];
  data: Record<string, any>;
  citationKey?: string;
  verified: boolean;
  tags: string[];
  ingested: boolean;
}

const ResearchSchema = new Schema<IResearchEntry>(
  {
    source: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    authors: [String],
    title: { type: String, required: true },
    publication: String,
    year: { type: Number, required: true, index: true },
    abstract: { type: String, required: true },
    keyFindings: [String],
    relevantSectors: [String],
    data: { type: Schema.Types.Mixed, default: {} },
    citationKey: String,
    verified: { type: Boolean, default: true },
    tags: [String],
    ingested: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ResearchSchema.index({ title: 1, year: 1 }, { unique: true });
ResearchSchema.index({ title: 'text', abstract: 'text' });

export const ResearchModel = mongoose.model<IResearchEntry>(
  'Research', ResearchSchema, 'kb_research'
);
