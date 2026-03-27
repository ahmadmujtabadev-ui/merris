import { Client } from '@microsoft/microsoft-graph-client';
import { logger } from './logger.js';

const AZURE_TENANT_ID = process.env['AZURE_TENANT_ID'];
const AZURE_CLIENT_ID = process.env['AZURE_CLIENT_ID'];
const AZURE_CLIENT_SECRET = process.env['AZURE_CLIENT_SECRET'];

let graphClient: Client | null = null;

/**
 * Placeholder auth token provider.
 * In production, this will use MSAL to obtain tokens via client credentials flow.
 */
async function getAccessToken(): Promise<string> {
  // TODO: Implement MSAL client credentials flow
  throw new Error('Graph auth not yet implemented');
}

export function getGraphClient(): Client | null {
  if (graphClient) return graphClient;

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    logger.warn('Azure AD credentials not set — Graph client unavailable');
    return null;
  }

  graphClient = Client.init({
    authProvider: async (done) => {
      try {
        const token = await getAccessToken();
        done(null, token);
      } catch (error) {
        done(error as Error, null);
      }
    },
  });

  return graphClient;
}

// ============================================================
// Types
// ============================================================

export interface DriveItem {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  lastModifiedDateTime: string;
  file?: {
    mimeType: string;
  };
  folder?: {
    childCount: number;
  };
}

export interface GraphSubscription {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  expirationDateTime: string;
}

// ============================================================
// Drive Items
// ============================================================

/**
 * List items in a SharePoint drive folder.
 * GET /drives/{driveId}/items/{folderId}/children
 */
export async function listDriveItems(driveId: string, folderId: string): Promise<DriveItem[]> {
  const client = getGraphClient();
  if (!client) {
    throw new Error('Graph client not configured');
  }

  const response = await client
    .api(`/drives/${driveId}/items/${folderId}/children`)
    .get();

  return (response.value || []) as DriveItem[];
}

/**
 * Download a drive item's content as a Buffer.
 * GET /drives/{driveId}/items/{itemId}/content
 */
export async function downloadDriveItem(driveId: string, itemId: string): Promise<Buffer> {
  const client = getGraphClient();
  if (!client) {
    throw new Error('Graph client not configured');
  }

  const stream = await client
    .api(`/drives/${driveId}/items/${itemId}/content`)
    .getStream();

  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Upload a file to a SharePoint drive folder.
 * PUT /drives/{driveId}/items/{folderId}:/{fileName}:/content
 */
export async function uploadDriveItem(
  driveId: string,
  folderId: string,
  fileName: string,
  content: Buffer
): Promise<DriveItem> {
  const client = getGraphClient();
  if (!client) {
    throw new Error('Graph client not configured');
  }

  const response = await client
    .api(`/drives/${driveId}/items/${folderId}:/${fileName}:/content`)
    .putStream(content);

  return response as DriveItem;
}

// ============================================================
// Subscriptions (Webhooks)
// ============================================================

/**
 * Create a webhook subscription for drive changes.
 * POST /subscriptions
 */
export async function createSubscription(
  resource: string,
  changeType: string,
  notificationUrl: string,
  expirationDateTime: string
): Promise<GraphSubscription> {
  const client = getGraphClient();
  if (!client) {
    throw new Error('Graph client not configured');
  }

  const response = await client
    .api('/subscriptions')
    .post({
      changeType,
      notificationUrl,
      resource,
      expirationDateTime,
    });

  return response as GraphSubscription;
}

/**
 * Delete a webhook subscription.
 * DELETE /subscriptions/{id}
 */
export async function deleteSubscription(subscriptionId: string): Promise<void> {
  const client = getGraphClient();
  if (!client) {
    throw new Error('Graph client not configured');
  }

  await client
    .api(`/subscriptions/${subscriptionId}`)
    .delete();
}

/**
 * Renew a webhook subscription with a new expiration date.
 * PATCH /subscriptions/{id}
 */
export async function renewSubscription(
  subscriptionId: string,
  expirationDateTime: string
): Promise<GraphSubscription> {
  const client = getGraphClient();
  if (!client) {
    throw new Error('Graph client not configured');
  }

  const response = await client
    .api(`/subscriptions/${subscriptionId}`)
    .patch({
      expirationDateTime,
    });

  return response as GraphSubscription;
}

export { getAccessToken };
