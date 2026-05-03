import { sendMessage } from "../../../lib/claude.js";
import { logger } from "../../../lib/logger.js";
import type { DocumentClassification } from "../vault-document.model.js";

const HAIKU_MODEL = "claude-haiku-4-5-20241022";

const VALID_CLASSES: DocumentClassification[] = [
  "methodology",
  "sop",
  "report",
  "working_paper",
  "reference",
  "email",
  "unknown",
];

export async function classifyDocument(
  text: string,
  filename: string
): Promise<{ docClass: DocumentClassification; confidence: number }> {
  const snippet = text.slice(0, 2000);

  try {
    const result = await sendMessage({
      model: HAIKU_MODEL,
      maxTokens: 100,
      system: `Classify this document into exactly one category. Return ONLY a JSON object with fields "docClass" and "confidence" (0-1). Categories: methodology (calculation methods, technical approaches), sop (standard operating procedures, process guides), report (sustainability reports, annual reports, audit reports), working_paper (drafts, working files, analysis), reference (standards, regulations, guidelines), email (email correspondence), unknown.`,
      messages: [
        {
          role: "user",
          content: `Filename: ${filename}\n\nContent excerpt:\n${snippet}`,
        },
      ],
    });

    if (!result) return { docClass: "unknown", confidence: 0 };

    const cleaned = result
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    const docClass = VALID_CLASSES.includes(parsed.docClass)
      ? parsed.docClass
      : "unknown";
    const confidence = typeof parsed.confidence === "number"
      ? Math.min(Math.max(parsed.confidence, 0), 1)
      : 0;

    return { docClass, confidence };
  } catch (error) {
    logger.warn("Document classification failed", error);
    return { docClass: "unknown", confidence: 0 };
  }
}
