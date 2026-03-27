import mongoose, { Schema, Document } from 'mongoose';

// ============================================================
// SharePointConnection Model
// ============================================================

export interface ISharePointConnection extends Document {
  orgId: mongoose.Types.ObjectId;
  driveId: string;
  folderId: string;
  engagementId: mongoose.Types.ObjectId;
  status: 'active' | 'disconnected' | 'error';
  webhookSubscriptionId?: string;
  webhookExpiration?: Date;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SharePointConnectionSchema = new Schema<ISharePointConnection>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    driveId: { type: String, required: true },
    folderId: { type: String, required: true },
    engagementId: { type: Schema.Types.ObjectId, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'disconnected', 'error'],
      default: 'active',
    },
    webhookSubscriptionId: { type: String },
    webhookExpiration: { type: Date },
    lastSync: { type: Date },
  },
  { timestamps: true }
);

SharePointConnectionSchema.index({ engagementId: 1, status: 1 });

export const SharePointConnectionModel = mongoose.model<ISharePointConnection>(
  'SharePointConnection',
  SharePointConnectionSchema
);

// ============================================================
// SharePointSyncLog Model
// ============================================================

export interface ISharePointSyncLog extends Document {
  connectionId: mongoose.Types.ObjectId;
  action: 'file_added' | 'file_updated' | 'file_deleted' | 'full_sync' | 'webhook_received';
  fileId?: string;
  fileName?: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  timestamp: Date;
}

const SharePointSyncLogSchema = new Schema<ISharePointSyncLog>(
  {
    connectionId: { type: Schema.Types.ObjectId, required: true, ref: 'SharePointConnection', index: true },
    action: {
      type: String,
      enum: ['file_added', 'file_updated', 'file_deleted', 'full_sync', 'webhook_received'],
      required: true,
    },
    fileId: { type: String },
    fileName: { type: String },
    status: {
      type: String,
      enum: ['success', 'failed', 'skipped'],
      required: true,
    },
    error: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

SharePointSyncLogSchema.index({ connectionId: 1, timestamp: -1 });

export const SharePointSyncLogModel = mongoose.model<ISharePointSyncLog>(
  'SharePointSyncLog',
  SharePointSyncLogSchema
);
