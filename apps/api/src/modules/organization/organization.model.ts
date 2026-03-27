import mongoose, { Schema, Document } from 'mongoose';

// ============================================================
// OrgProfile Model
// ============================================================

export interface IOrgProfile extends Document {
  orgId: mongoose.Types.ObjectId;
  legalName: string;
  tradingName: string;
  country: string;
  region: string;
  city: string;
  industryGICS: string;
  subIndustry: string;
  listingStatus: 'listed' | 'private' | 'state_owned' | 'sme';
  exchange?: string;
  employeeCount: number;
  revenueRange: string;
  facilities: Array<{
    name: string;
    type: string;
    country: string;
    coordinates?: { lat: number; lng: number };
    scope1Sources?: string[];
  }>;
  supplyChainComplexity: string;
  currentFrameworks: string[];
  esgMaturity: 'none' | 'beginner' | 'intermediate' | 'advanced';
  reportingHistory: Array<{
    year: number;
    frameworks: string[];
    url?: string;
  }>;
  hasEuOperations: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrgProfileSchema = new Schema<IOrgProfile>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
    legalName: { type: String, required: true, trim: true },
    tradingName: { type: String, required: true, trim: true },
    country: { type: String, required: true },
    region: { type: String, required: true },
    city: { type: String, required: true },
    industryGICS: { type: String, required: true },
    subIndustry: { type: String, required: true },
    listingStatus: {
      type: String,
      enum: ['listed', 'private', 'state_owned', 'sme'],
      required: true,
    },
    exchange: { type: String },
    employeeCount: { type: Number, required: true },
    revenueRange: { type: String, required: true },
    facilities: [
      {
        name: { type: String, required: true },
        type: { type: String, required: true },
        country: { type: String, required: true },
        coordinates: {
          lat: { type: Number },
          lng: { type: Number },
        },
        scope1Sources: [{ type: String }],
      },
    ],
    supplyChainComplexity: { type: String, required: true },
    currentFrameworks: [{ type: String }],
    esgMaturity: {
      type: String,
      enum: ['none', 'beginner', 'intermediate', 'advanced'],
      required: true,
    },
    reportingHistory: [
      {
        year: { type: Number, required: true },
        frameworks: [{ type: String }],
        url: { type: String },
      },
    ],
    hasEuOperations: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const OrgProfileModel = mongoose.model<IOrgProfile>('OrgProfile', OrgProfileSchema);

// ============================================================
// FrameworkRecommendation Model
// ============================================================

export interface IFrameworkRecommendation extends Document {
  orgId: mongoose.Types.ObjectId;
  recommendations: Array<{
    framework: string;
    category: 'mandatory' | 'recommended' | 'optional';
    reason: string;
    regulation?: string;
  }>;
  selections: {
    selected: string[];
    deselected: string[];
    confirmedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FrameworkRecommendationSchema = new Schema<IFrameworkRecommendation>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
    recommendations: [
      {
        framework: { type: String, required: true },
        category: {
          type: String,
          enum: ['mandatory', 'recommended', 'optional'],
          required: true,
        },
        reason: { type: String, required: true },
        regulation: { type: String },
      },
    ],
    selections: {
      selected: [{ type: String }],
      deselected: [{ type: String }],
      confirmedAt: { type: Date },
    },
  },
  { timestamps: true }
);

export const FrameworkRecommendationModel = mongoose.model<IFrameworkRecommendation>(
  'FrameworkRecommendation',
  FrameworkRecommendationSchema
);
