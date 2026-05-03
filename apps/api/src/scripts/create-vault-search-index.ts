/**
 * Create MongoDB Atlas Search index on the vault_chunks collection.
 *
 * Run manually: npx tsx src/scripts/create-vault-search-index.ts
 *
 * If using MongoDB Atlas, this creates a text search index.
 * If using local MongoDB, Atlas Search is not available — the BM25 search
 * will fall back to regex-based matching automatically.
 */

import mongoose from "mongoose";
import { logger } from "../lib/logger.js";

const MONGODB_URI = process.env["MONGODB_URI"];

async function createVaultSearchIndex(): Promise<void> {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  if (!db) {
    console.error("No database connection");
    process.exit(1);
  }

  const collection = db.collection("vaultchunks");

  try {
    const indexes = await collection.listSearchIndexes().toArray();
    const existing = indexes.find(
      (idx: any) => idx.name === "vault_chunks_text"
    );

    if (existing) {
      console.log("Search index 'vault_chunks_text' already exists");
      await mongoose.disconnect();
      return;
    }
  } catch {
    console.log(
      "Could not list search indexes — may not be Atlas. Creating standard text index instead."
    );

    await collection.createIndex(
      { content: "text", contextualHeader: "text" },
      { name: "vault_chunks_text_fallback" }
    );
    console.log("Created standard text index 'vault_chunks_text_fallback'");
    await mongoose.disconnect();
    return;
  }

  try {
    await collection.createSearchIndex({
      name: "vault_chunks_text",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            content: {
              type: "string",
              analyzer: "lucene.standard",
            },
            contextualHeader: {
              type: "string",
              analyzer: "lucene.standard",
            },
            workspaceId: {
              type: "objectId",
            },
            documentId: {
              type: "objectId",
            },
            chunkType: {
              type: "string",
            },
          },
        },
      },
    });

    console.log("Created Atlas Search index 'vault_chunks_text'");
  } catch (error) {
    console.error("Failed to create search index:", error);
  }

  await mongoose.disconnect();
}

createVaultSearchIndex().catch(console.error);
