import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { logger } from './logger.js';

const AZURE_STORAGE_CONNECTION_STRING = process.env['AZURE_STORAGE_CONNECTION_STRING'];

let blobServiceClient: BlobServiceClient | null = null;

function getServiceClient(): BlobServiceClient | null {
  if (blobServiceClient) return blobServiceClient;

  if (!AZURE_STORAGE_CONNECTION_STRING) {
    logger.warn('AZURE_STORAGE_CONNECTION_STRING not set — blob storage unavailable');
    return null;
  }

  blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  return blobServiceClient;
}

function getContainerClient(containerName: string): ContainerClient | null {
  const client = getServiceClient();
  if (!client) return null;
  return client.getContainerClient(containerName);
}

export async function uploadBlob(
  containerName: string,
  blobName: string,
  data: Buffer | string
): Promise<string | null> {
  const container = getContainerClient(containerName);
  if (!container) return null;

  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.upload(data, typeof data === 'string' ? Buffer.byteLength(data) : data.length);
  logger.info(`Uploaded blob: ${containerName}/${blobName}`);
  return blockBlob.url;
}

export async function downloadBlob(
  containerName: string,
  blobName: string
): Promise<Buffer | null> {
  const container = getContainerClient(containerName);
  if (!container) return null;

  const blockBlob = container.getBlockBlobClient(blobName);
  const downloadResponse = await blockBlob.download(0);

  if (!downloadResponse.readableStreamBody) return null;

  const chunks: Buffer[] = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteBlob(
  containerName: string,
  blobName: string
): Promise<boolean> {
  const container = getContainerClient(containerName);
  if (!container) return false;

  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.delete();
  logger.info(`Deleted blob: ${containerName}/${blobName}`);
  return true;
}

export { getServiceClient };
