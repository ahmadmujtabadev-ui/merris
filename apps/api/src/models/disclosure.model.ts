import mongoose, { Schema, Document } from 'mongoose';

/**
 * Standalone Disclosure model — allows querying disclosures independently
 * of the framework document (e.g. "find all Scope 1 disclosures across frameworks").
 * Populated from framework JSON during seeding.
 */

export interface IDisclosure extends Document {
  id: string;
  frameworkId: string;
  frameworkCode: string;
  code: string;
  name: string;
  description: string;
  topic: string;
  dataType: 'quantitative' | 'qualitative' | 'narrative' | 'table';
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
    mappingType: 'equivalent' | 'partial' | 'related';
    notes?: string;
  }>;
}

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
    frameworkCode: { type: String, required: true },
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

const DisclosureSchema = new Schema<IDisclosure>(
  {
    id: { type: String, required: true, unique: true },
    frameworkId: { type: String, required: true, index: true },
    frameworkCode: { type: String, required: true, index: true },
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
  {
    timestamps: true,
    collection: 'disclosures',
  }
);

// Text index for searching disclosures by name/description
DisclosureSchema.index({ name: 'text', description: 'text' });

export const Disclosure = mongoose.model<IDisclosure>(
  'Disclosure',
  DisclosureSchema
);
