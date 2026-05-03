import { createHash } from "crypto";
import mongoose from "mongoose";
import { createQueue } from "../../lib/queue.js";
import { uploadBlob } from "../../lib/storage.js";
import { logger } from "../../lib/logger.js";
import { VaultDocumentModel } from "./vault-document.model.js";
import { VaultChunkModel } from "./vault-chunk.model.js";
import { runVaultPipeline } from "./vault-pipeline.js";
import { hybridSearch } from "./search/hybrid-search.js";
import { resolveVersion } from "./vault-version.js";
import { emitVaultMetric } from "./metrics/vault-telemetry.js";
import { VAULT_QUEUE_NAME, PIPELINE_VERSION } from "./types.js";

export interface UploadOptions {
  workspaceId: string;
  vaultId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  uploadedBy: string;
}

export async function uploadVaultDocument(opts: UploadOptions) {
  const { workspaceId, vaultId, filename, mimeType, buffer, uploadedBy } = opts;

  const hash = createHash("sha256").update(buffer).digest("hex");
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  const existing = await VaultDocumentModel.findOne({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    hash,
  });

  if (existing) {
    return {
      document: existing.toObject(),
      duplicate: true,
      message: "Document with identical content already exists in this vault",
    };
  }

  const { version, supersededId } = await resolveVersion(workspaceId, filename);

  let blobUrl: string | undefined;
  try {
    const blobName = `vault/${workspaceId}/${Date.now()}-${filename}`;
    const url = await uploadBlob("vault-documents", blobName, buffer);
    if (url) blobUrl = url;
  } catch {
    logger.warn("Blob upload failed — document stored in queue only");
  }

  const doc = await VaultDocumentModel.create({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    vaultId: new mongoose.Types.ObjectId(vaultId),
    filename,
    format: ext,
    size: buffer.length,
    hash,
    classification: "unknown",
    uploadSource: "manual",
    uploaderId: new mongoose.Types.ObjectId(uploadedBy),
    version,
    supersedesId: supersededId
      ? new mongoose.Types.ObjectId(supersededId)
      : undefined,
    status: "queued",
    blobUrl,
    provenance: {
      uploadedAt: new Date(),
      uploadedBy: new mongoose.Types.ObjectId(uploadedBy),
    },
    pipelineVersion: PIPELINE_VERSION,
  });

  emitVaultMetric({
    event: "upload",
    workspaceId,
    documentId: doc._id.toString(),
    filename,
    metadata: { version, supersededId, size: buffer.length },
  });

  const pipelineInput = {
    documentId: doc._id.toString(),
    workspaceId,
    vaultId,
    buffer: buffer.toJSON(),
    filename,
    mimeType,
    uploadedBy,
  };

  const queue = createQueue(VAULT_QUEUE_NAME);
  if (queue) {
    await queue.add("process-vault-document", pipelineInput, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
    logger.info(`Vault document ${filename} queued for processing`);
  } else {
    logger.info(`No queue available — processing ${filename} synchronously`);
    try {
      await runVaultPipeline({
        ...pipelineInput,
        buffer,
      });
    } catch (error) {
      logger.error(`Sync vault processing failed for ${filename}`, error);
    }
  }

  return { document: doc.toObject(), duplicate: false };
}

export interface ListOptions {
  workspaceId: string;
  classification?: string;
  status?: string;
  limit?: number;
}

export async function listVaultDocuments(opts: ListOptions) {
  const filter: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(opts.workspaceId),
  };
  if (opts.classification) filter.classification = opts.classification;
  if (opts.status) filter.status = opts.status;

  const docs = await VaultDocumentModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(opts.limit || 50)
    .lean();

  const total = await VaultDocumentModel.countDocuments({
    workspaceId: new mongoose.Types.ObjectId(opts.workspaceId),
  });

  return {
    total,
    documents: docs.map((d) => ({
      id: d._id.toString(),
      filename: d.filename,
      format: d.format,
      classification: d.classification,
      status: d.status,
      size: d.size,
      pageCount: d.pageCount,
      chunkCount: d.chunkCount,
      version: d.version,
      uploadedAt: d.provenance.uploadedAt,
      isScanned: d.isScanned,
    })),
  };
}

export async function getVaultDocument(workspaceId: string, docId: string) {
  const doc = await VaultDocumentModel.findOne({
    _id: new mongoose.Types.ObjectId(docId),
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
  }).lean();

  if (!doc) return null;

  const chunks = await VaultChunkModel.find({
    documentId: new mongoose.Types.ObjectId(docId),
  })
    .sort({ chunkIndex: 1 })
    .select("chunkIndex chunkType pageNumber sectionPath tokenCount")
    .lean();

  return {
    ...doc,
    id: doc._id.toString(),
    chunks: chunks.map((c) => ({
      id: c._id.toString(),
      index: c.chunkIndex,
      type: c.chunkType,
      page: c.pageNumber,
      section: c.sectionPath.join(" > "),
      tokens: c.tokenCount,
    })),
  };
}

export interface SearchOptions {
  query: string;
  workspaceId: string;
  documentIds?: string[];
  limit?: number;
}

export async function searchVaultDocuments(opts: SearchOptions) {
  const results = await hybridSearch({
    query: opts.query,
    workspaceId: opts.workspaceId,
    documentIds: opts.documentIds,
    limit: opts.limit || 15,
  });

  return {
    resultCount: results.length,
    results: results.map((r) => ({
      chunkId: r.chunkId,
      documentId: r.documentId,
      content: r.content,
      page: r.pageNumber,
      section: r.sectionPath.join(" > "),
      type: r.chunkType,
      score: r.score,
    })),
  };
}

export async function reprocessVaultDocument(
  workspaceId: string,
  docId: string
): Promise<{ queued: boolean; message: string }> {
  const doc = await VaultDocumentModel.findOne({
    _id: new mongoose.Types.ObjectId(docId),
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
  });

  if (!doc) {
    return { queued: false, message: "Document not found" };
  }

  if (!doc.blobUrl) {
    return {
      queued: false,
      message: "Cannot reprocess — original file not stored in blob storage",
    };
  }

  await VaultDocumentModel.findByIdAndUpdate(docId, {
    status: "queued",
    errorMessage: undefined,
  });

  emitVaultMetric({
    event: "reprocess",
    workspaceId,
    documentId: docId,
    filename: doc.filename,
  });

  const queue = createQueue(VAULT_QUEUE_NAME);
  if (queue) {
    await queue.add(
      "reprocess-vault-document",
      {
        documentId: docId,
        workspaceId,
        vaultId: doc.vaultId.toString(),
        filename: doc.filename,
        mimeType: doc.format,
        uploadedBy: doc.uploaderId.toString(),
      },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
    );
    return { queued: true, message: "Document queued for reprocessing" };
  }

  return {
    queued: false,
    message: "Queue unavailable — reprocessing requires Redis",
  };
}

export async function deleteVaultDocument(
  workspaceId: string,
  docId: string
): Promise<void> {
  const doc = await VaultDocumentModel.findOne({
    _id: new mongoose.Types.ObjectId(docId),
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
  });

  if (!doc) return;

  await VaultChunkModel.deleteMany({
    documentId: new mongoose.Types.ObjectId(docId),
  });

  try {
    const { getQdrantClient } = await import("../../lib/qdrant.js");
    const { VAULT_QDRANT_COLLECTION } = await import(
      "../../lib/qdrant-vault.js"
    );
    const client = getQdrantClient();
    await client.delete(VAULT_QDRANT_COLLECTION, {
      filter: {
        must: [{ key: "document_id", match: { value: docId } }],
      },
    });
  } catch {
    logger.warn(`Could not delete Qdrant vectors for document ${docId}`);
  }

  await VaultDocumentModel.findByIdAndDelete(docId);
  logger.info(`Vault document ${docId} and its chunks deleted`);
}
