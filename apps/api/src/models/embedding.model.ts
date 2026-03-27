/**
 * Merris Embedding Model
 *
 * Stores TF-IDF sparse vectors for semantic search across all 7 KB domains.
 * Each entry corresponds to one document in a source KB collection.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ============================================================
// Types
// ============================================================

export type KBDomain = 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6' | 'K7';

export const DOMAIN_COLLECTION_MAP: Record<KBDomain, string> = {
  K1: 'kb_corporate_disclosures',
  K2: 'kb_climate_science',
  K3: 'kb_regulatory',
  K4: 'kb_sustainable_finance',
  K5: 'kb_environmental_science',
  K6: 'kb_supply_chain',
  K7: 'kb_research',
};

export const COLLECTION_DOMAIN_MAP: Record<string, KBDomain> = Object.fromEntries(
  Object.entries(DOMAIN_COLLECTION_MAP).map(([k, v]) => [v, k as KBDomain])
) as Record<string, KBDomain>;

export interface IEmbedding extends Document {
  sourceCollection: string;
  sourceId: Types.ObjectId;
  domain: KBDomain;
  text: string;
  textHash: string;
  // TF-IDF sparse vector stored as plain object in MongoDB
  tfidfVector: Record<string, number>;
  // Dense representation (top 500 terms) for fast cosine similarity
  denseTerms: string[];
  denseWeights: number[];
  magnitude: number;
  updatedAt: Date;
}

// ============================================================
// Schema
// ============================================================

const EmbeddingSchema = new Schema<IEmbedding>(
  {
    sourceCollection: { type: String, required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    domain: {
      type: String,
      required: true,
      enum: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7'],
      index: true,
    },
    text: { type: String, required: true },
    textHash: { type: String, required: true },
    tfidfVector: { type: Schema.Types.Mixed, default: {} },
    denseTerms: { type: [String], default: [] },
    denseWeights: { type: [Number], default: [] },
    magnitude: { type: Number, default: 0 },
  },
  { timestamps: true }
);

EmbeddingSchema.index({ sourceCollection: 1, sourceId: 1 }, { unique: true });
EmbeddingSchema.index({ domain: 1, updatedAt: -1 });

export const EmbeddingModel = mongoose.model<IEmbedding>(
  'Embedding',
  EmbeddingSchema,
  'kb_embeddings'
);
