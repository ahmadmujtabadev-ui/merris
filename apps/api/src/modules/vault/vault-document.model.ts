import mongoose, { Schema, Document } from "mongoose";

export type VaultDocumentStatus =
  | "queued"
  | "parsing"
  | "chunking"
  | "embedding"
  | "indexed"
  | "failed";

export type DocumentClassification =
  | "methodology"
  | "sop"
  | "report"
  | "working_paper"
  | "reference"
  | "email"
  | "unknown";

export interface IVaultDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  vaultId: mongoose.Types.ObjectId;
  filename: string;
  format: string;
  size: number;
  hash: string;
  classification: DocumentClassification;
  uploadSource: "manual" | "sharepoint" | "email" | "api";
  uploaderId: mongoose.Types.ObjectId;
  version: number;
  supersedesId?: mongoose.Types.ObjectId;
  status: VaultDocumentStatus;
  blobUrl?: string;
  localPath?: string;
  pageCount?: number;
  isScanned: boolean;
  ocrUsed: boolean;
  languageDetected: string[];
  provenance: {
    uploadedAt: Date;
    uploadedBy: mongoose.Types.ObjectId;
    sourceSystem?: string;
    originalPath?: string;
  };
  errorMessage?: string;
  pipelineVersion: string;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const VaultDocumentSchema = new Schema<IVaultDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    vaultId: { type: Schema.Types.ObjectId, required: true, index: true },
    filename: { type: String, required: true },
    format: { type: String, required: true },
    size: { type: Number, required: true },
    hash: { type: String, required: true },
    classification: {
      type: String,
      enum: [
        "methodology",
        "sop",
        "report",
        "working_paper",
        "reference",
        "email",
        "unknown",
      ],
      default: "unknown",
    },
    uploadSource: {
      type: String,
      enum: ["manual", "sharepoint", "email", "api"],
      default: "manual",
    },
    uploaderId: { type: Schema.Types.ObjectId, required: true },
    version: { type: Number, default: 1 },
    supersedesId: { type: Schema.Types.ObjectId },
    status: {
      type: String,
      enum: ["queued", "parsing", "chunking", "embedding", "indexed", "failed"],
      default: "queued",
    },
    blobUrl: { type: String },
    localPath: { type: String },
    pageCount: { type: Number },
    isScanned: { type: Boolean, default: false },
    ocrUsed: { type: Boolean, default: false },
    languageDetected: [{ type: String }],
    provenance: {
      uploadedAt: { type: Date, default: Date.now },
      uploadedBy: { type: Schema.Types.ObjectId, required: true },
      sourceSystem: { type: String },
      originalPath: { type: String },
    },
    errorMessage: { type: String },
    pipelineVersion: { type: String, default: "1.0.0" },
    chunkCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

VaultDocumentSchema.index({ workspaceId: 1, vaultId: 1 });
VaultDocumentSchema.index({ workspaceId: 1, hash: 1 });
VaultDocumentSchema.index({ workspaceId: 1, status: 1 });

export const VaultDocumentModel = mongoose.model<IVaultDocument>(
  "VaultDocument",
  VaultDocumentSchema
);
