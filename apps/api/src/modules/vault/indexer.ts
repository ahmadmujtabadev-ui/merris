import mongoose from "mongoose";
import { getQdrantClient } from "../../lib/qdrant.js";
import { VAULT_QDRANT_COLLECTION } from "../../lib/qdrant-vault.js";
import { logger } from "../../lib/logger.js";
import { VaultChunkModel } from "./vault-chunk.model.js";
import type { EmbeddedChunk } from "./types.js";
import { PIPELINE_VERSION } from "./types.js";

export interface IndexOptions {
  workspaceId: string;
  documentId: string;
  vaultId: string;
}

export async function indexChunks(
  chunks: EmbeddedChunk[],
  opts: IndexOptions
): Promise<number> {
  const { workspaceId, documentId, vaultId } = opts;

  await VaultChunkModel.deleteMany({
    documentId: new mongoose.Types.ObjectId(documentId),
  });

  const mongoDocs = chunks.map((chunk, idx) => ({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    documentId: new mongoose.Types.ObjectId(documentId),
    vaultId: new mongoose.Types.ObjectId(vaultId),
    chunkIndex: idx,
    chunkType: chunk.chunkType,
    content: chunk.content,
    contextualHeader: chunk.contextualHeader,
    enrichedContent: chunk.enrichedContent,
    pageNumber: chunk.pageNumber,
    bbox: chunk.bbox
      ? { x: chunk.bbox[0], y: chunk.bbox[1], width: chunk.bbox[2], height: chunk.bbox[3] }
      : undefined,
    sectionPath: chunk.sectionPath,
    tableData: chunk.tableData,
    entities: [],
    vector: chunk.vector,
    embeddingModel: chunk.embeddingModel,
    tokenCount: chunk.tokenCount,
    pipelineVersion: PIPELINE_VERSION,
  }));

  await VaultChunkModel.insertMany(mongoDocs, { ordered: false });

  const vectorChunks = chunks.filter((c) => c.vector.length > 0);
  if (vectorChunks.length > 0) {
    try {
      const client = getQdrantClient();
      const points = vectorChunks.map((chunk, idx) => {
        const mongoDoc = mongoDocs[chunks.indexOf(chunk)];
        return {
          id: generatePointId(documentId, idx),
          vector: chunk.vector,
          payload: {
            workspace_id: workspaceId,
            document_id: documentId,
            vault_id: vaultId,
            chunk_index: chunks.indexOf(chunk),
            chunk_type: chunk.chunkType,
            page_number: chunk.pageNumber || 0,
            section_path: chunk.sectionPath,
            content_preview: chunk.content.slice(0, 500),
          },
        };
      });

      const BATCH = 100;
      for (let i = 0; i < points.length; i += BATCH) {
        await client.upsert(VAULT_QDRANT_COLLECTION, {
          wait: true,
          points: points.slice(i, i + BATCH),
        });
      }

      logger.info(
        `Indexed ${points.length} vectors in Qdrant for document ${documentId}`
      );
    } catch (error) {
      logger.warn("Qdrant indexing failed — MongoDB chunks still available", error);
    }
  }

  return chunks.length;
}

function generatePointId(documentId: string, chunkIndex: number): number {
  const hash = Buffer.from(documentId + ":" + chunkIndex).reduce(
    (acc, byte) => (acc * 31 + byte) >>> 0,
    0
  );
  return hash;
}
