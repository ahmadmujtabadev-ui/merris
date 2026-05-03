import { randomUUID } from "crypto";
import { createRequire } from "module";
import { logger } from "../../../lib/logger.js";
import type {
  ParsedDocument,
  ParsedElement,
  ParsedOutlineEntry,
} from "../types.js";

export async function parsePptx(
  buffer: Buffer,
  docId: string,
  workspaceId: string
): Promise<Partial<ParsedDocument>> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);

    const elements: ParsedElement[] = [];
    const outline: ParsedOutlineEntry[] = [];
    let slideNumber = 0;

    const slideFiles = Object.keys(zip.files)
      .filter((f) => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0", 10);
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0", 10);
        return numA - numB;
      });

    for (const slideFile of slideFiles) {
      slideNumber++;
      const xml = await zip.files[slideFile].async("text");
      const slideText = extractTextFromXml(xml);

      if (slideText.trim()) {
        const lines = slideText.split("\n").filter((l) => l.trim());
        const title = lines[0] || `Slide ${slideNumber}`;

        outline.push({
          level: 1,
          title: `Slide ${slideNumber}: ${title}`,
          pageStart: slideNumber,
          pageEnd: slideNumber,
        });

        elements.push({
          elementId: randomUUID(),
          type: "heading",
          text: title,
          page: slideNumber,
          metadata: {
            headingLevel: 1,
            headingPath: [`Slide ${slideNumber}`],
          },
        });

        for (let i = 1; i < lines.length; i++) {
          elements.push({
            elementId: randomUUID(),
            type: "paragraph",
            text: lines[i],
            page: slideNumber,
            metadata: {
              headingPath: [`Slide ${slideNumber}`, title],
            },
          });
        }
      }

      const notesFile = slideFile.replace(
        /slides\/slide/,
        "notesSlides/notesSlide"
      );
      if (zip.files[notesFile]) {
        try {
          const notesXml = await zip.files[notesFile].async("text");
          const notesText = extractTextFromXml(notesXml);

          if (notesText.trim()) {
            elements.push({
              elementId: randomUUID(),
              type: "footnote",
              text: `[Speaker Notes] ${notesText.trim()}`,
              page: slideNumber,
              metadata: {
                headingPath: [
                  `Slide ${slideNumber}`,
                  "Speaker Notes",
                ],
              },
            });
          }
        } catch {
          // notes slide may not exist
        }
      }
    }

    return {
      docId,
      workspaceId,
      outline,
      elements,
      tables: [],
      images: [],
    };
  } catch (error) {
    logger.error("Vault PPTX parsing failed", error);
    throw new Error("Failed to parse PPTX for vault ingestion");
  }
}

function extractTextFromXml(xml: string): string {
  const textParts: string[] = [];
  const textRegex = /<a:t[^>]*>(.*?)<\/a:t>/gs;
  const paraRegex = /<a:p[^>]*>(.*?)<\/a:p>/gs;

  let paraMatch: RegExpExecArray | null;
  paraMatch = paraRegex.exec(xml);
  while (paraMatch) {
    const paraContent = paraMatch[1];
    const lineTexts: string[] = [];
    let textMatch: RegExpExecArray | null;
    const localTextRegex = new RegExp(textRegex.source, textRegex.flags);
    textMatch = localTextRegex.exec(paraContent);
    while (textMatch) {
      const decoded = textMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      lineTexts.push(decoded);
      textMatch = localTextRegex.exec(paraContent);
    }
    if (lineTexts.length > 0) {
      textParts.push(lineTexts.join(""));
    }
    paraMatch = paraRegex.exec(xml);
  }

  return textParts.join("\n");
}
