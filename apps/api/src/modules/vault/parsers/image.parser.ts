import { randomUUID } from "crypto";
import { getClient } from "../../../lib/claude.js";
import { logger } from "../../../lib/logger.js";
import type { ParsedDocument, ParsedElement } from "../types.js";

const SONNET_MODEL = "claude-sonnet-4-20250514";

export async function parseImage(
  buffer: Buffer,
  mimeType: string,
  docId: string,
  workspaceId: string
): Promise<Partial<ParsedDocument>> {
  const client = getClient();
  if (!client) {
    logger.warn("Claude client unavailable — image parsing skipped");
    return {
      docId,
      workspaceId,
      outline: [],
      elements: [],
      tables: [],
      images: [{ imageId: randomUUID(), page: 1 }],
    };
  }

  try {
    const base64 = buffer.toString("base64");
    const mediaType = normalizeMediaType(mimeType);

    const response = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: "Describe this document, diagram, chart, or image in detail for indexing purposes. If it contains text, extract all readable text. If it's a diagram or chart, describe the structure, labels, data points, and relationships. Be thorough and factual.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const description =
      textBlock && "text" in textBlock ? textBlock.text : "";

    const elements: ParsedElement[] = [];
    if (description.trim()) {
      elements.push({
        elementId: randomUUID(),
        type: "paragraph",
        text: description.trim(),
        page: 1,
        metadata: { headingPath: ["Image Description"] },
      });
    }

    return {
      docId,
      workspaceId,
      outline: [],
      elements,
      tables: [],
      images: [
        {
          imageId: randomUUID(),
          page: 1,
          ocrText: description,
        },
      ],
    };
  } catch (error) {
    logger.warn("Image parsing via Claude Vision failed", error);
    return {
      docId,
      workspaceId,
      outline: [],
      elements: [],
      tables: [],
      images: [{ imageId: randomUUID(), page: 1 }],
    };
  }
}

function normalizeMediaType(
  mimeType: string
): "image/png" | "image/jpeg" | "image/gif" | "image/webp" {
  if (mimeType.includes("png")) return "image/png";
  if (mimeType.includes("gif")) return "image/gif";
  if (mimeType.includes("webp")) return "image/webp";
  return "image/jpeg";
}
