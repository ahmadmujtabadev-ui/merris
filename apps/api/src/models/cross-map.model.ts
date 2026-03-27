import mongoose, { Schema, Document } from 'mongoose';

export interface ICrossMapEntry {
  gri_code: string;
  gri_name: string;
  target_code: string;
  target_name: string;
  mapping: 'equivalent' | 'partial' | 'related';
  notes?: string;
}

export interface ICrossFrameworkMap extends Document {
  sourceFramework: string;
  targetFramework: string;
  version: string;
  lastUpdated: Date;
  description: string;
  notes?: string;
  mappings: ICrossMapEntry[];
}

const CrossMapEntrySchema = new Schema(
  {
    gri_code: { type: String, required: true },
    gri_name: { type: String, required: true },
    target_code: { type: String, required: true },
    target_name: { type: String, required: true },
    mapping: {
      type: String,
      enum: ['equivalent', 'partial', 'related'],
      required: true,
    },
    notes: { type: String },
  },
  { _id: false }
);

const CrossFrameworkMapSchema = new Schema<ICrossFrameworkMap>(
  {
    sourceFramework: { type: String, required: true, index: true },
    targetFramework: { type: String, required: true, index: true },
    version: { type: String, required: true },
    lastUpdated: { type: Date, required: true },
    description: { type: String, required: true },
    notes: { type: String },
    mappings: [CrossMapEntrySchema],
  },
  {
    timestamps: true,
    collection: 'cross_framework_maps',
  }
);

// Compound unique index
CrossFrameworkMapSchema.index(
  { sourceFramework: 1, targetFramework: 1, version: 1 },
  { unique: true }
);

export const CrossFrameworkMap = mongoose.model<ICrossFrameworkMap>(
  'CrossFrameworkMap',
  CrossFrameworkMapSchema
);
