/**
 * Dense Embedding Model — Voyage AI vectors for M01-M14 KB documents
 *
 * Separate collection from TF-IDF embeddings (kb_embeddings).
 * Each record = one text chunk from a source document.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IDenseEmbedding extends Document {
  /** Source module folder: M01-M14 */
  module: string;
  /** Original filename (basename) */
  filename: string;
  /** Full relative path within the KB root dir */
  filePath: string;
  /** File type: pdf | xlsx | csv | json | docx */
  fileType: string;
  /** Zero-based chunk index within the document */
  chunkIndex: number;
  /** Total chunks for this document */
  totalChunks: number;
  /** The chunk text that was embedded */
  text: string;
  /** SHA-256 of text (first 16 hex chars) for dedup/staleness detection */
  textHash: string;
  /** voyage-large-2 dense vector (1024 dims) */
  vector: number[];
  /** Voyage AI model used */
  embeddingModel: string;
  createdAt: Date;
  updatedAt: Date;
}

const DenseEmbeddingSchema = new Schema<IDenseEmbedding>(
  {
    module:      { type: String, required: true, index: true },
    filename:    { type: String, required: true },
    filePath:    { type: String, required: true },
    fileType:    { type: String, required: true },
    chunkIndex:  { type: Number, required: true },
    totalChunks: { type: Number, required: true },
    text:        { type: String, required: true },
    textHash:    { type: String, required: true },
    vector:         { type: [Number], required: true },
    embeddingModel: { type: String, required: true, default: 'voyage-large-2' },
  },
  { timestamps: true }
);

// Unique per chunk — allows safe re-runs without duplicates
DenseEmbeddingSchema.index({ filePath: 1, chunkIndex: 1 }, { unique: true });
DenseEmbeddingSchema.index({ module: 1, filename: 1 });
// textHash index for quick staleness check
DenseEmbeddingSchema.index({ textHash: 1 });

export const DenseEmbeddingModel = mongoose.model<IDenseEmbedding>(
  'DenseEmbedding',
  DenseEmbeddingSchema,
  'kb_dense_embeddings'
);
