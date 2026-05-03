import { getQdrantClient } from "./qdrant.js";
import { logger } from "./logger.js";
import {
  VAULT_QDRANT_COLLECTION,
  VAULT_VECTOR_SIZE,
} from "../modules/vault/types.js";

export async function ensureVaultCollection(): Promise<void> {
  try {
    const client = getQdrantClient();
    const exists = await client.collectionExists(VAULT_QDRANT_COLLECTION);
    if (!exists) {
      await client.createCollection(VAULT_QDRANT_COLLECTION, {
        vectors: { size: VAULT_VECTOR_SIZE, distance: "Cosine" },
      });
      logger.info(
        `Created Qdrant collection "${VAULT_QDRANT_COLLECTION}" (${VAULT_VECTOR_SIZE}-dim)`
      );
    }
  } catch (error) {
    logger.warn("Could not ensure vault Qdrant collection", error);
  }
}

export { VAULT_QDRANT_COLLECTION, VAULT_VECTOR_SIZE };
