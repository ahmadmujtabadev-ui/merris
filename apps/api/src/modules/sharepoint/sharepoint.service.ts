import { logger } from '../../lib/logger.js';
import {
  listDriveItems,
  downloadDriveItem,
  uploadDriveItem,
  createSubscription,
  deleteSubscription,
  renewSubscription,
  type DriveItem,
} from '../../lib/graph.js';
import { uploadDocument } from '../ingestion/ingestion.service.js';
import {
  SharePointConnectionModel,
  SharePointSyncLogModel,
  type ISharePointConnection,
} from './sharepoint.model.js';

// ============================================================
// Constants
// ============================================================

const WEBHOOK_BASE_URL = process.env['WEBHOOK_BASE_URL'] || 'https://api.merris.io';
const SUBSCRIPTION_EXPIRY_DAYS = 29; // Max 30 days for drive subscriptions

// ============================================================
// Connect / Disconnect
// ============================================================

export async function connectFolder(
  orgId: string,
  engagementId: string,
  driveId: string,
  folderId: string
): Promise<ISharePointConnection> {
  // Check for existing active connection
  const existing = await SharePointConnectionModel.findOne({
    engagementId,
    status: 'active',
  });

  if (existing) {
    throw new SharePointError('An active SharePoint connection already exists for this engagement', 409);
  }

  const connection = await SharePointConnectionModel.create({
    orgId,
    driveId,
    folderId,
    engagementId,
    status: 'active',
  });

  // Attempt to create webhook subscription
  try {
    await createWebhookSubscription(connection._id.toString());
  } catch (err) {
    logger.warn('Failed to create webhook subscription, connection still active for manual sync', err);
  }

  logger.info(`SharePoint folder connected: drive=${driveId}, folder=${folderId}, engagement=${engagementId}`);
  return connection;
}

export async function disconnectFolder(engagementId: string): Promise<void> {
  const connection = await SharePointConnectionModel.findOne({
    engagementId,
    status: 'active',
  });

  if (!connection) {
    throw new SharePointError('No active SharePoint connection for this engagement', 404);
  }

  // Remove webhook subscription if exists
  if (connection.webhookSubscriptionId) {
    try {
      await deleteSubscription(connection.webhookSubscriptionId);
    } catch (err) {
      logger.warn('Failed to delete webhook subscription during disconnect', err);
    }
  }

  connection.status = 'disconnected';
  connection.webhookSubscriptionId = undefined;
  connection.webhookExpiration = undefined;
  await connection.save();

  await SharePointSyncLogModel.create({
    connectionId: connection._id,
    action: 'file_deleted',
    status: 'success',
    timestamp: new Date(),
  });

  logger.info(`SharePoint folder disconnected for engagement=${engagementId}`);
}

// ============================================================
// Webhook Subscription
// ============================================================

export async function createWebhookSubscription(connectionId: string): Promise<string> {
  const connection = await SharePointConnectionModel.findById(connectionId);
  if (!connection) {
    throw new SharePointError('Connection not found', 404);
  }

  const resource = `/drives/${connection.driveId}/root:/${connection.folderId}:/children`;
  const notificationUrl = `${WEBHOOK_BASE_URL}/api/v1/sharepoint/webhook`;
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + SUBSCRIPTION_EXPIRY_DAYS);

  const subscription = await createSubscription(
    resource,
    'updated',
    notificationUrl,
    expiration.toISOString()
  );

  connection.webhookSubscriptionId = subscription.id;
  connection.webhookExpiration = expiration;
  await connection.save();

  logger.info(`Webhook subscription created: ${subscription.id} for connection=${connectionId}`);
  return subscription.id;
}

export async function renewWebhookSubscriptions(): Promise<void> {
  const soon = new Date();
  soon.setDate(soon.getDate() + 2); // Renew if expiring within 2 days

  const expiring = await SharePointConnectionModel.find({
    status: 'active',
    webhookSubscriptionId: { $exists: true },
    webhookExpiration: { $lt: soon },
  });

  for (const connection of expiring) {
    try {
      const newExpiration = new Date();
      newExpiration.setDate(newExpiration.getDate() + SUBSCRIPTION_EXPIRY_DAYS);

      await renewSubscription(
        connection.webhookSubscriptionId!,
        newExpiration.toISOString()
      );

      connection.webhookExpiration = newExpiration;
      await connection.save();

      logger.info(`Renewed webhook subscription for connection=${connection._id}`);
    } catch (err) {
      logger.error(`Failed to renew webhook for connection=${connection._id}`, err);
    }
  }
}

// ============================================================
// Webhook Notification Handler
// ============================================================

export interface WebhookNotification {
  subscriptionId: string;
  resource: string;
  changeType: string;
  clientState?: string;
  resourceData?: {
    id: string;
    '@odata.type': string;
    '@odata.id': string;
  };
}

export async function handleWebhookNotification(
  notifications: WebhookNotification[]
): Promise<void> {
  for (const notification of notifications) {
    const connection = await SharePointConnectionModel.findOne({
      webhookSubscriptionId: notification.subscriptionId,
      status: 'active',
    });

    if (!connection) {
      logger.warn(`No active connection for subscription ${notification.subscriptionId}`);
      continue;
    }

    await SharePointSyncLogModel.create({
      connectionId: connection._id,
      action: 'webhook_received',
      status: 'success',
      timestamp: new Date(),
    });

    try {
      // List current files in the folder to find changes
      const items = await listDriveItems(connection.driveId, connection.folderId);

      for (const item of items) {
        if (item.file) {
          await downloadAndIngest(connection, item);
        }
      }
    } catch (err) {
      logger.error(`Error processing webhook notification for connection=${connection._id}`, err);

      await SharePointSyncLogModel.create({
        connectionId: connection._id,
        action: 'webhook_received',
        fileId: notification.resourceData?.id,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date(),
      });
    }
  }
}

// ============================================================
// Manual Sync
// ============================================================

export async function syncFolder(connectionId: string): Promise<{ synced: number; skipped: number }> {
  const connection = await SharePointConnectionModel.findById(connectionId);
  if (!connection) {
    throw new SharePointError('Connection not found', 404);
  }

  if (connection.status !== 'active') {
    throw new SharePointError('Connection is not active', 400);
  }

  let synced = 0;
  let skipped = 0;

  try {
    const items = await listDriveItems(connection.driveId, connection.folderId);

    for (const item of items) {
      if (!item.file) {
        skipped++;
        continue;
      }

      try {
        await downloadAndIngest(connection, item);
        synced++;

        await SharePointSyncLogModel.create({
          connectionId: connection._id,
          action: 'file_added',
          fileId: item.id,
          fileName: item.name,
          status: 'success',
          timestamp: new Date(),
        });
      } catch (err) {
        skipped++;
        await SharePointSyncLogModel.create({
          connectionId: connection._id,
          action: 'file_added',
          fileId: item.id,
          fileName: item.name,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    await SharePointSyncLogModel.create({
      connectionId: connection._id,
      action: 'full_sync',
      status: 'success',
      timestamp: new Date(),
    });

    connection.lastSync = new Date();
    await connection.save();
  } catch (err) {
    await SharePointSyncLogModel.create({
      connectionId: connection._id,
      action: 'full_sync',
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date(),
    });

    throw err;
  }

  return { synced, skipped };
}

// ============================================================
// Upload to SharePoint
// ============================================================

export async function uploadToSharePoint(
  driveId: string,
  folderId: string,
  file: Buffer,
  fileName: string
): Promise<{ webUrl: string }> {
  const result = await uploadDriveItem(driveId, folderId, fileName, file);
  logger.info(`Uploaded ${fileName} to SharePoint drive=${driveId}, folder=${folderId}`);
  return { webUrl: result.webUrl };
}

// ============================================================
// Status
// ============================================================

export async function getConnectionStatus(engagementId: string) {
  const connection = await SharePointConnectionModel.findOne({
    engagementId,
  }).sort({ updatedAt: -1 }).lean();

  if (!connection) {
    return { connected: false, connection: null, recentLogs: [] };
  }

  const recentLogs = await SharePointSyncLogModel.find({
    connectionId: connection._id,
  })
    .sort({ timestamp: -1 })
    .limit(20)
    .lean();

  return {
    connected: connection.status === 'active',
    connection: {
      id: connection._id.toString(),
      driveId: connection.driveId,
      folderId: connection.folderId,
      status: connection.status,
      webhookActive: !!connection.webhookSubscriptionId,
      webhookExpiration: connection.webhookExpiration,
      lastSync: connection.lastSync,
      createdAt: connection.createdAt,
    },
    recentLogs: recentLogs.map((log) => ({
      id: log._id.toString(),
      action: log.action,
      fileId: log.fileId,
      fileName: log.fileName,
      status: log.status,
      error: log.error,
      timestamp: log.timestamp,
    })),
  };
}

// ============================================================
// Helpers
// ============================================================

async function downloadAndIngest(
  connection: ISharePointConnection,
  item: DriveItem
): Promise<void> {
  const buffer = await downloadDriveItem(connection.driveId, item.id);
  const mimeType = item.file?.mimeType || 'application/octet-stream';

  await uploadDocument(
    connection.engagementId.toString(),
    connection.orgId.toString(),
    item.name,
    buffer,
    mimeType
  );

  logger.info(`Ingested SharePoint file: ${item.name} (${item.id}) for engagement=${connection.engagementId}`);
}

// ============================================================
// Error Class
// ============================================================

export class SharePointError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'SharePointError';
  }
}
