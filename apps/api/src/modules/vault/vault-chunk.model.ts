import mongoose, { Schema, Document } from "mongoose";

export type ChunkType =
  | "text"
  | "table"
  | "image_description"
  | "heading"
  | "list";

export interface IExtractedEntity {
  type: string;
  value: string;
  normalizedValue?: string;
}

export interface ITableData {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface IBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IVaultChunk extends Document {
  workspaceId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  vaultId: mongoose.Types.ObjectId;
  chunkIndex: number;
  chunkType: ChunkType;
  content: string;
  contextualHeader: string;
  enrichedContent: string;
  pageNumber?: number;
  bbox?: IBoundingBox;
  sectionPath: string[];
  tableData?: ITableData;
  entities: IExtractedEntity[];
  vector: number[];
  embeddingModel: string;
  tokenCount: number;
  pipelineVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

const EntitySubSchema = new Schema(
  {
    type: { type: String, required: true },
    value: { type: String, required: true },
    normalizedValue: { type: String },
  },
  { _id: false }
);

const TableDataSubSchema = new Schema(
  {
    headers: [{ type: String }],
    rows: [[{ type: String }]],
    caption: { type: String },
  },
  { _id: false }
);

const BBoxSubSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false }
);

const VaultChunkSchema = new Schema<IVaultChunk>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "VaultDocument",
      index: true,
    },
    vaultId: { type: Schema.Types.ObjectId, required: true },
    chunkIndex: { type: Number, required: true },
    chunkType: {
      type: String,
      enum: ["text", "table", "image_description", "heading", "list"],
      default: "text",
    },
    content: { type: String, required: true },
    contextualHeader: { type: String, default: "" },
    enrichedContent: { type: String, default: "" },
    pageNumber: { type: Number },
    bbox: BBoxSubSchema,
    sectionPath: [{ type: String }],
    tableData: TableDataSubSchema,
    entities: [EntitySubSchema],
    vector: [{ type: Number }],
    embeddingModel: { type: String, default: "voyage-large-2" },
    tokenCount: { type: Number, default: 0 },
    pipelineVersion: { type: String, default: "1.0.0" },
  },
  { timestamps: true }
);

VaultChunkSchema.index({ workspaceId: 1, vaultId: 1 });
VaultChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });

export const VaultChunkModel = mongoose.model<IVaultChunk>(
  "VaultChunk",
  VaultChunkSchema
);
