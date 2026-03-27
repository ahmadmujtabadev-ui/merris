import mongoose, { Schema, Document } from 'mongoose';

// ============================================================
// SlideContent Sub-document
// ============================================================

export interface ISlideContent {
  text?: string;
  dataPoints?: string[];
  chartType?: 'bar' | 'line' | 'pie' | 'waterfall' | 'radar' | 'bubble' | 'sankey' | 'treemap';
  chartData?: unknown;
  tableData?: unknown;
}

const SlideContentSubSchema = new Schema<ISlideContent>(
  {
    text: { type: String },
    dataPoints: [{ type: String }],
    chartType: {
      type: String,
      enum: ['bar', 'line', 'pie', 'waterfall', 'radar', 'bubble', 'sankey', 'treemap'],
    },
    chartData: { type: Schema.Types.Mixed },
    tableData: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

// ============================================================
// SlideSpec Sub-document
// ============================================================

export interface ISlideSpec {
  id: string;
  title: string;
  layout: 'title' | 'kpi_dashboard' | 'chart' | 'comparison' | 'timeline' | 'table' | 'narrative' | 'section_divider';
  content: ISlideContent;
  speakerNotes?: string;
}

const SlideSpecSubSchema = new Schema<ISlideSpec>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    layout: {
      type: String,
      enum: ['title', 'kpi_dashboard', 'chart', 'comparison', 'timeline', 'table', 'narrative', 'section_divider'],
      required: true,
    },
    content: { type: SlideContentSubSchema, default: () => ({}) },
    speakerNotes: { type: String },
  },
  { _id: false },
);

// ============================================================
// Branding Sub-document
// ============================================================

export interface IBranding {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
}

const BrandingSubSchema = new Schema<IBranding>(
  {
    logo: { type: String },
    primaryColor: { type: String },
    secondaryColor: { type: String },
    fontFamily: { type: String },
  },
  { _id: false },
);

// ============================================================
// Presentation Model
// ============================================================

export type DeckType =
  | 'board_pack'
  | 'investor_presentation'
  | 'client_deliverable'
  | 'strategy_deck'
  | 'training_deck'
  | 'due_diligence_summary'
  | 'regulatory_submission';

export interface IPresentation extends Document {
  engagementId: mongoose.Types.ObjectId;
  title: string;
  type: DeckType;
  slides: ISlideSpec[];
  branding: IBranding;
  language: string;
  status: 'draft' | 'final';
  filePath?: string;
  generatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PresentationSchema = new Schema<IPresentation>(
  {
    engagementId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'board_pack',
        'investor_presentation',
        'client_deliverable',
        'strategy_deck',
        'training_deck',
        'due_diligence_summary',
        'regulatory_submission',
      ],
      required: true,
    },
    slides: [SlideSpecSubSchema],
    branding: { type: BrandingSubSchema, default: () => ({}) },
    language: { type: String, default: 'en' },
    status: {
      type: String,
      enum: ['draft', 'final'],
      default: 'draft',
    },
    filePath: { type: String },
    generatedAt: { type: Date },
  },
  { timestamps: true },
);

export const PresentationModel = mongoose.model<IPresentation>('Presentation', PresentationSchema);
