import { logger } from "../../lib/logger.js";
import { VaultDocumentModel } from "./vault-document.model.js";
import { VaultChunkModel } from "./vault-chunk.model.js";
import { parseFile } from "./parsers/index.js";
import { chunkDocument } from "./chunker.js";
import { enrichChunks } from "./enricher.js";
import { embedChunks } from "./embedder.js";
import { indexChunks } from "./indexer.js";
import { extractEntities } from "./extractors/entity-extractor.js";
import { classifyDocument } from "./classifiers/document-classifier.js";
import type { VaultDocumentStatus } from "./vault-document.model.js";

export interface PipelineInput {
  documentId: string;
  workspaceId: string;
  vaultId: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  uploadedBy: string;
}

async function updateStatus(
  documentId: string,
  status: VaultDocumentStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  await VaultDocumentModel.findByIdAndUpdate(documentId, {
    status,
    ...extra,
  });
}

export async function runVaultPipeline(input: PipelineInput): Promise<void> {
  const {
    documentId,
    workspaceId,
    vaultId,
    buffer,
    filename,
    mimeType,
    uploadedBy,
  } = input;

  try {
    await updateStatus(documentId, "parsing");
    logger.info(`Vault pipeline: parsing ${filename}`);

    const parsed = await parseFile({
      buffer,
      filename,
      mimeType,
      workspaceId,
      uploadedBy,
    });

    const isScanned =
      parsed.elements.length === 0 ||
      parsed.elements.every((e) => !e.text || e.text.length < 10);

    const fullText = parsed.elements.map((e) => e.text).join("\n");
    const classificationResult = await classifyDocument(fullText, filename).catch(() => ({
      docClass: "unknown" as const,
      confidence: 0,
    }));

    await VaultDocumentModel.findByIdAndUpdate(documentId, {
      pageCount: new Set(parsed.elements.map((e) => e.page)).size || 1,
      isScanned,
      languageDetected: parsed.source.languageDetected,
      classification: classificationResult.docClass,
    });

    await updateStatus(documentId, "chunking");
    logger.info(
      `Vault pipeline: chunking ${parsed.elements.length} elements from ${filename}`
    );
    const chunks = chunkDocument(parsed);

    if (chunks.length === 0) {
      await updateStatus(documentId, "failed", {
        errorMessage: "No content extracted from document",
      });
      return;
    }

    logger.info(
      `Vault pipeline: enriching ${chunks.length} chunks for ${filename}`
    );
    const enriched = await enrichChunks(chunks, filename);

    await updateStatus(documentId, "embedding");
    logger.info(
      `Vault pipeline: embedding ${enriched.length} chunks for ${filename}`
    );
    const embedded = await embedChunks(enriched);

    logger.info(
      `Vault pipeline: indexing ${embedded.length} chunks for ${filename}`
    );
    const chunkCount = await indexChunks(embedded, {
      workspaceId,
      documentId,
      vaultId,
    });

    await updateStatus(documentId, "indexed", { chunkCount });
    logger.info(
      `Vault pipeline: completed ${filename} — ${chunkCount} chunks indexed`
    );

    runEntityExtraction(documentId, chunks).catch((err) =>
      logger.warn(`Entity extraction background task failed for ${filename}`, err)
    );
  } catch (error) {
    logger.error(`Vault pipeline failed for ${filename}`, error);
    const message =
      error instanceof Error ? error.message : "Unknown pipeline error";
    await updateStatus(documentId, "failed", { errorMessage: message });
    throw error;
  }
}

async function runEntityExtraction(
  documentId: string,
  chunks: import("./types.js").ChunkInput[]
): Promise<void> {
  const storedChunks = await VaultChunkModel.find({
    documentId,
  })
    .sort({ chunkIndex: 1 })
    .lean();

  for (const stored of storedChunks) {
    if (stored.chunkType === "table") continue;
    try {
      const entities = await extractEntities(stored.content);
      if (entities.length > 0) {
        await VaultChunkModel.findByIdAndUpdate(stored._id, { entities });
      }
    } catch {
      // non-critical
    }
  }
  logger.info(
    `Entity extraction completed for document ${documentId}`
  );
}
