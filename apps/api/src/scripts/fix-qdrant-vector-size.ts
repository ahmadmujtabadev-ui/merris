/**
 * Migration: recreate kb_dense Qdrant collection at correct 1024-dim (Voyage large-2).
 * The original collection was created at 1536-dim by mistake.
 *
 * Run: npx tsx scripts/fix-qdrant-vector-size.ts
 *
 * WARNING: This deletes all vectors in kb_dense and recreates the collection.
 * You must re-embed KB entries after running this.
 */

import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env["QDRANT_URL"] || "http://localhost:6333";
const COLLECTION = "kb_dense";
const CORRECT_SIZE = 1024;

async function main() {
  const client = new QdrantClient({ url: QDRANT_URL });

  console.log(`Checking collection "${COLLECTION}" at ${QDRANT_URL}...`);

  const exists = await client.collectionExists(COLLECTION);
  if (!exists) {
    console.log(`Collection "${COLLECTION}" does not exist. Creating fresh.`);
    await client.createCollection(COLLECTION, {
      vectors: { size: CORRECT_SIZE, distance: "Cosine" },
    });
    console.log(`Created "${COLLECTION}" at ${CORRECT_SIZE}-dim.`);
    return;
  }

  const info = await client.getCollection(COLLECTION);
  const currentSize =
    typeof info.config.params.vectors === "object" &&
    "size" in info.config.params.vectors
      ? info.config.params.vectors.size
      : null;

  if (currentSize === CORRECT_SIZE) {
    console.log(
      `Collection "${COLLECTION}" already at ${CORRECT_SIZE}-dim. No migration needed.`
    );
    return;
  }

  console.log(
    `Collection "${COLLECTION}" is ${currentSize}-dim. Migrating to ${CORRECT_SIZE}-dim...`
  );

  const pointCount = info.points_count ?? 0;
  console.log(`Current point count: ${pointCount}`);

  if (pointCount > 0) {
    console.log(
      "WARNING: All existing vectors will be deleted. Re-embed after migration."
    );
  }

  await client.deleteCollection(COLLECTION);
  console.log(`Deleted old "${COLLECTION}" collection.`);

  await client.createCollection(COLLECTION, {
    vectors: { size: CORRECT_SIZE, distance: "Cosine" },
  });

  await client.createPayloadIndex(COLLECTION, {
    field_name: "workspace_id",
    field_schema: "keyword",
  });

  console.log(
    `Created "${COLLECTION}" at ${CORRECT_SIZE}-dim with workspace_id index.`
  );
  console.log("Migration complete. Re-run KB embedding pipeline to repopulate.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
