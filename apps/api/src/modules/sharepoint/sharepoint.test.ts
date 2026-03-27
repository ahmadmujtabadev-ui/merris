import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { registerSharePointRoutes } from './sharepoint.routes.js';
import { SharePointConnectionModel, SharePointSyncLogModel } from './sharepoint.model.js';

// ============================================================
// Mock Graph API
// ============================================================

vi.mock('../../lib/graph.js', () => ({
  getGraphClient: vi.fn(() => null),
  listDriveItems: vi.fn(async () => [
    {
      id: 'item-001',
      name: 'sustainability-report-2025.pdf',
      size: 2048000,
      webUrl: 'https://sharepoint.example.com/report.pdf',
      lastModifiedDateTime: '2025-12-01T10:00:00Z',
      file: { mimeType: 'application/pdf' },
    },
    {
      id: 'item-002',
      name: 'energy-data.xlsx',
      size: 512000,
      webUrl: 'https://sharepoint.example.com/energy.xlsx',
      lastModifiedDateTime: '2025-12-02T14:00:00Z',
      file: { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    },
    {
      id: 'folder-001',
      name: 'Archive',
      size: 0,
      webUrl: 'https://sharepoint.example.com/archive',
      lastModifiedDateTime: '2025-11-01T09:00:00Z',
      folder: { childCount: 5 },
    },
  ]),
  downloadDriveItem: vi.fn(async () => Buffer.from('mock file content')),
  uploadDriveItem: vi.fn(async (_driveId: string, _folderId: string, fileName: string) => ({
    id: 'uploaded-item-001',
    name: fileName,
    size: 1024,
    webUrl: `https://sharepoint.example.com/${fileName}`,
    lastModifiedDateTime: new Date().toISOString(),
    file: { mimeType: 'application/pdf' },
  })),
  createSubscription: vi.fn(async () => ({
    id: 'sub-001',
    resource: '/drives/drive-1/root:/folder-1:/children',
    changeType: 'updated',
    notificationUrl: 'https://api.merris.io/api/v1/sharepoint/webhook',
    expirationDateTime: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
  })),
  deleteSubscription: vi.fn(async () => undefined),
  renewSubscription: vi.fn(async () => ({
    id: 'sub-001',
    expirationDateTime: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
  })),
}));

// Mock the ingestion service to avoid side effects
vi.mock('../ingestion/ingestion.service.js', () => ({
  uploadDocument: vi.fn(async () => ({
    document: {
      _id: new mongoose.Types.ObjectId(),
      engagementId: 'eng-001',
      orgId: 'org-001',
      filename: 'test.pdf',
      format: 'pdf',
      size: 1024,
      status: 'queued',
      uploadedAt: new Date(),
    },
    queued: true,
  })),
  UploadError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
      this.name = 'UploadError';
    }
  },
}));

// ============================================================
// Test Setup
// ============================================================

const JWT_SECRET = 'test-secret-key-for-sharepoint-tests';
process.env['JWT_SECRET'] = JWT_SECRET;

let mongoServer: MongoMemoryServer;
let app: FastifyInstance;

const TEST_ORG_ID = new mongoose.Types.ObjectId().toString();

function createToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      userId: new mongoose.Types.ObjectId().toString(),
      orgId: TEST_ORG_ID,
      role: 'owner',
      permissions: [
        { resource: 'data', actions: ['read', 'write', 'delete', 'approve'] },
      ],
      ...overrides,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = Fastify();
  await registerSharePointRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await SharePointConnectionModel.deleteMany({});
  await SharePointSyncLogModel.deleteMany({});
  vi.clearAllMocks();
});

// ============================================================
// Tests: POST /api/v1/engagements/:id/sharepoint/connect
// ============================================================

describe('POST /api/v1/engagements/:id/sharepoint/connect', () => {
  it('creates connection record on connect', async () => {
    const token = createToken();
    const engagementId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${engagementId}/sharepoint/connect`,
      headers: { authorization: `Bearer ${token}` },
      payload: { driveId: 'drive-abc', folderId: 'folder-xyz' },
    });

    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(201);
    expect(body.connection).toBeDefined();
    expect(body.connection.driveId).toBe('drive-abc');
    expect(body.connection.folderId).toBe('folder-xyz');
    expect(body.connection.status).toBe('active');

    // Verify in DB
    const dbConnection = await SharePointConnectionModel.findById(body.connection.id);
    expect(dbConnection).not.toBeNull();
    expect(dbConnection!.status).toBe('active');
  });

  it('returns 401 when unauthenticated', async () => {
    const engagementId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${engagementId}/sharepoint/connect`,
      payload: { driveId: 'drive-abc', folderId: 'folder-xyz' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when body is invalid', async () => {
    const token = createToken();
    const engagementId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${engagementId}/sharepoint/connect`,
      headers: { authorization: `Bearer ${token}` },
      payload: { driveId: '' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ============================================================
// Tests: DELETE /api/v1/engagements/:id/sharepoint/disconnect
// ============================================================

describe('DELETE /api/v1/engagements/:id/sharepoint/disconnect', () => {
  it('disconnects and removes webhook subscription', async () => {
    const { deleteSubscription } = await import('../../lib/graph.js');

    const engagementId = new mongoose.Types.ObjectId();
    await SharePointConnectionModel.create({
      orgId: new mongoose.Types.ObjectId(),
      driveId: 'drive-1',
      folderId: 'folder-1',
      engagementId,
      status: 'active',
      webhookSubscriptionId: 'sub-to-delete',
    });

    const token = createToken();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/engagements/${engagementId.toString()}/sharepoint/disconnect`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);

    const updated = await SharePointConnectionModel.findOne({ engagementId });
    expect(updated!.status).toBe('disconnected');
    expect(updated!.webhookSubscriptionId).toBeUndefined();

    expect(deleteSubscription).toHaveBeenCalledWith('sub-to-delete');
  });
});

// ============================================================
// Tests: POST /api/v1/sharepoint/webhook
// ============================================================

describe('POST /api/v1/sharepoint/webhook', () => {
  it('returns validation token on challenge', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sharepoint/webhook?validationToken=abc123challenge',
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('abc123challenge');
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('handles Graph validation correctly with special characters', async () => {
    const token = 'Validation+Token%20With=Special&Characters';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sharepoint/webhook?validationToken=${encodeURIComponent(token)}`,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(token);
  });

  it('processes change notifications and triggers ingestion', async () => {
    const { listDriveItems, downloadDriveItem } = await import('../../lib/graph.js');
    const { uploadDocument } = await import('../ingestion/ingestion.service.js');

    const engagementId = new mongoose.Types.ObjectId();
    const orgId = new mongoose.Types.ObjectId();

    await SharePointConnectionModel.create({
      orgId,
      driveId: 'drive-1',
      folderId: 'folder-1',
      engagementId,
      status: 'active',
      webhookSubscriptionId: 'sub-active',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sharepoint/webhook',
      payload: {
        value: [
          {
            subscriptionId: 'sub-active',
            resource: '/drives/drive-1/root:/folder-1:/children',
            changeType: 'updated',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(202);

    // Give async processing a moment
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify it attempted to list and download items
    expect(listDriveItems).toHaveBeenCalledWith('drive-1', 'folder-1');
    expect(downloadDriveItem).toHaveBeenCalled();
    expect(uploadDocument).toHaveBeenCalled();
  });

  it('returns 202 even with no active connection', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sharepoint/webhook',
      payload: {
        value: [
          {
            subscriptionId: 'non-existent-sub',
            resource: '/drives/x/root:/y:/children',
            changeType: 'updated',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(202);
  });
});

// ============================================================
// Tests: POST /api/v1/engagements/:id/sharepoint/sync
// ============================================================

describe('POST /api/v1/engagements/:id/sharepoint/sync', () => {
  it('lists files and queues new ones on manual sync', async () => {
    const { listDriveItems, downloadDriveItem } = await import('../../lib/graph.js');
    const { uploadDocument } = await import('../ingestion/ingestion.service.js');

    const engagementId = new mongoose.Types.ObjectId();
    const orgId = new mongoose.Types.ObjectId();

    await SharePointConnectionModel.create({
      orgId,
      driveId: 'drive-sync',
      folderId: 'folder-sync',
      engagementId,
      status: 'active',
    });

    const token = createToken();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${engagementId.toString()}/sharepoint/sync`,
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.synced).toBe(2); // 2 files (folder skipped)
    expect(body.skipped).toBe(1); // 1 folder

    expect(listDriveItems).toHaveBeenCalledWith('drive-sync', 'folder-sync');
    expect(downloadDriveItem).toHaveBeenCalledTimes(2);
    expect(uploadDocument).toHaveBeenCalledTimes(2);

    // Verify sync logs were created
    const logs = await SharePointSyncLogModel.find({}).sort({ timestamp: -1 });
    expect(logs.length).toBeGreaterThan(0);

    const fullSyncLog = logs.find((l) => l.action === 'full_sync');
    expect(fullSyncLog).toBeDefined();
    expect(fullSyncLog!.status).toBe('success');
  });

  it('returns 404 with no active connection', async () => {
    const token = createToken();
    const engagementId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/engagements/${engagementId}/sharepoint/sync`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ============================================================
// Tests: Upload to SharePoint
// ============================================================

describe('uploadToSharePoint', () => {
  it('calls Graph API to upload file', async () => {
    const { uploadDriveItem } = await import('../../lib/graph.js');
    const { uploadToSharePoint } = await import('./sharepoint.service.js');

    const result = await uploadToSharePoint(
      'drive-upload',
      'folder-upload',
      Buffer.from('report content'),
      'esg-report-2025.pdf'
    );

    expect(uploadDriveItem).toHaveBeenCalledWith(
      'drive-upload',
      'folder-upload',
      'esg-report-2025.pdf',
      expect.any(Buffer)
    );
    expect(result.webUrl).toBeDefined();
  });
});

// ============================================================
// Tests: GET /api/v1/engagements/:id/sharepoint/status
// ============================================================

describe('GET /api/v1/engagements/:id/sharepoint/status', () => {
  it('returns correct connection info', async () => {
    const engagementId = new mongoose.Types.ObjectId();

    const connection = await SharePointConnectionModel.create({
      orgId: new mongoose.Types.ObjectId(),
      driveId: 'drive-status',
      folderId: 'folder-status',
      engagementId,
      status: 'active',
      webhookSubscriptionId: 'sub-status',
      webhookExpiration: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      lastSync: new Date(),
    });

    await SharePointSyncLogModel.create({
      connectionId: connection._id,
      action: 'full_sync',
      status: 'success',
      timestamp: new Date(),
    });

    const token = createToken();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${engagementId.toString()}/sharepoint/status`,
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.connected).toBe(true);
    expect(body.connection).toBeDefined();
    expect(body.connection.driveId).toBe('drive-status');
    expect(body.connection.folderId).toBe('folder-status');
    expect(body.connection.webhookActive).toBe(true);
    expect(body.connection.lastSync).toBeDefined();
    expect(body.recentLogs).toBeDefined();
    expect(body.recentLogs.length).toBe(1);
  });

  it('returns disconnected status when no connection', async () => {
    const token = createToken();
    const engagementId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${engagementId}/sharepoint/status`,
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.connected).toBe(false);
    expect(body.connection).toBeNull();
  });

  it('returns 401 without authentication', async () => {
    const engagementId = new mongoose.Types.ObjectId().toString();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/engagements/${engagementId}/sharepoint/status`,
    });

    expect(res.statusCode).toBe(401);
  });
});
