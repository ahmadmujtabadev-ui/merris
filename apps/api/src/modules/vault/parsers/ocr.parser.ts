import { randomUUID } from "crypto";
import { getClient } from "../../../lib/claude.js";
import { logger } from "../../../lib/logger.js";
import type { ParsedElement } from "../types.js";

const SONNET_MODEL = "claude-sonnet-4-20250514";

export async function ocrPages(
  pageImages: Array<{ page: number; buffer: Buffer; mimeType: string }>
): Promise<ParsedElement[]> {
  const client = getClient();
  if (!client) {
    logger.warn("Claude client unavailable — OCR skipped");
    return [];
  }

  const elements: ParsedElement[] = [];

  for (const pageImg of pageImages) {
    try {
      const base64 = pageImg.buffer.toString("base64");
      const mediaType = pageImg.mimeType as
        | "image/png"
        | "image/jpeg"
        | "image/gif"
        | "image/webp";

      const response = await client.messages.create({
        model: SONNET_MODEL,
        max_tokens: 4096,
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
                text: "Extract ALL text from this document page. Preserve the layout, headings, tables (as markdown), and lists. If there are tables, format them as markdown tables. Output the extracted text only, no commentary.",
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const text = textBlock && "text" in textBlock ? textBlock.text : "";

      if (text.trim()) {
        const lines = text.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const isHeading =
            /^#{1,4}\s/.test(trimmed) ||
            (trimmed === trimmed.toUpperCase() &&
              trimmed.length < 80 &&
              /[A-Z]/.test(trimmed));

          elements.push({
            elementId: randomUUID(),
            type: isHeading ? "heading" : "paragraph",
            text: trimmed.replace(/^#{1,4}\s/, ""),
            page: pageImg.page,
            metadata: isHeading
              ? { headingLevel: 1, headingPath: [trimmed.replace(/^#{1,4}\s/, "")] }
              : undefined,
          });
        }
      }
    } catch (error) {
      logger.warn(`OCR failed for page ${pageImg.page}`, error);
    }
  }

  return elements;
}
