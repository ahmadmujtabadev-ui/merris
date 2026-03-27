import mongoose, { Schema, Document } from 'mongoose';

// ============================================================
// Subdocument Schemas
// ============================================================

const MetricDefinitionSchema = new Schema(
  {
    name: { type: String, required: true },
    unit: { type: String, required: true },
    calculationMethod: { type: String },
    description: { type: String, required: true },
  },
  { _id: false }
);

const CrossReferenceSchema = new Schema(
  {
    frameworkCode: { type: String, required: true, index: true },
    disclosureCode: { type: String, required: true },
    mappingType: {
      type: String,
      enum: ['equivalent', 'partial', 'related'],
      required: true,
    },
    notes: { type: String },
  },
  { _id: false }
);

const DisclosureSubSchema = new Schema(
  {
    id: { type: String, required: true },
    frameworkId: { type: String, required: true },
    code: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    topic: { type: String, required: true, index: true },
    dataType: {
      type: String,
      enum: ['quantitative', 'qualitative', 'narrative', 'table'],
      required: true,
    },
    requiredMetrics: [MetricDefinitionSchema],
    guidanceText: { type: String, required: true },
    sectorSpecific: { type: Boolean, default: false },
    sectors: [{ type: String }],
    crossReferences: [CrossReferenceSchema],
  },
  { _id: false }
);

const TopicSubSchema = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    disclosures: [DisclosureSubSchema],
  },
  { _id: false }
);

// ============================================================
// Framework Schema
// ============================================================

export interface IFramework extends Document {
  id: string;
  code: string;
  name: string;
  version: string;
  effectiveDate: Date;
  issuingBody: string;
  region: string;
  type: 'mandatory' | 'voluntary' | 'rating' | 'taxonomy';
  structure: {
    topics: Array<{
      code: string;
      name: string;
      disclosures: Array<{
        id: string;
        frameworkId: string;
        code: string;
        name: string;
        description: string;
        topic: string;
        dataType: string;
        requiredMetrics: Array<{
          name: string;
          unit: string;
          calculationMethod?: string;
          description: string;
        }>;
        guidanceText: string;
        sectorSpecific: boolean;
        sectors?: string[];
        crossReferences: Array<{
          frameworkCode: string;
          disclosureCode: string;
          mappingType: string;
          notes?: string;
        }>;
      }>;
    }>;
  };
}

const FrameworkSchema = new Schema<IFramework>(
  {
    id: { type: String, required: true, unique: true },
    code: { type: String, required: true, index: true },
    name: { type: String, required: true },
    version: { type: String, required: true },
    effectiveDate: { type: Date, required: true },
    issuingBody: { type: String, required: true },
    region: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['mandatory', 'voluntary', 'rating', 'taxonomy'],
      required: true,
    },
    structure: {
      topics: [TopicSubSchema],
    },
  },
  {
    timestamps: true,
    collection: 'frameworks',
  }
);

// Compound index for code + version uniqueness
FrameworkSchema.index({ code: 1, version: 1 }, { unique: true });

export const Framework = mongoose.model<IFramework>(
  'Framework',
  FrameworkSchema
);
