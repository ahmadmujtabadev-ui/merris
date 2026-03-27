import mongoose, { Schema, Document } from 'mongoose';

export interface IEmissionFactor extends Document {
  source: string;
  country: string;
  gridRegion?: string;
  year: number;
  factor: number;
  unit: string;
  scope: 1 | 2 | 3;
  category?: string;
  fuelType?: string;
  activityType?: string;
  notes?: string;
  verified: boolean;
}

const EmissionFactorSchema = new Schema<IEmissionFactor>(
  {
    source: { type: String, required: true, index: true },
    country: { type: String, required: true, index: true },
    gridRegion: { type: String },
    year: { type: Number, required: true, index: true },
    factor: { type: Number, required: true },
    unit: { type: String, required: true },
    scope: { type: Number, enum: [1, 2, 3], required: true },
    category: { type: String, index: true },
    fuelType: { type: String, index: true },
    activityType: { type: String },
    notes: { type: String },
    verified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'emission_factors',
  }
);

// Compound index for common queries
EmissionFactorSchema.index({ country: 1, year: 1, scope: 1 });
EmissionFactorSchema.index({ source: 1, fuelType: 1, year: 1 });

export const EmissionFactor = mongoose.model<IEmissionFactor>(
  'EmissionFactor',
  EmissionFactorSchema
);
