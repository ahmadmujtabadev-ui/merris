// src/services/vault/vault.model.ts
//
// Mongoose model for firm-level vaults.

import mongoose, { Schema, Document } from "mongoose";

export interface IVault extends Document {
  orgId: mongoose.Types.ObjectId;
  name: string;
  type: "engagement" | "knowledge" | "firm";
  engagementId?: mongoose.Types.ObjectId;
  description: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const VaultSchema = new Schema<IVault>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["engagement", "knowledge", "firm"],
      required: true,
    },
    engagementId: { type: Schema.Types.ObjectId, index: true },
    description: { type: String, default: "" },
    tags: [String],
  },
  { timestamps: true }
);

VaultSchema.index({ orgId: 1, type: 1 });

export const VaultModel = mongoose.model<IVault>("Vault", VaultSchema);
