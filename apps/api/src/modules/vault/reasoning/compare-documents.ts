import mongoose from "mongoose";
import { sendMessage } from "../../../lib/claude.js";
import { logger } from "../../../lib/logger.js";
import { VaultDocumentModel } from "../vault-document.model.js";
import { VaultChunkModel } from "../vault-chunk.model.js";
import { hybridSearch } from "../search/hybrid-search.js";

export interface CompareOptions {
  workspaceId: string;
  documentIds: string[];
  dimensions?: string[];
  query?: string;
}

export interface ComparisonResult {
  dimensions: Array<{
    name: string;
    comparisons: Array<{
      documentId: string;
      documentName: string;
      summary: string;
      chunkIds: string[];
    }>;
  }>;
  overallAnalysis: string;
}

export async function compareDocuments(
  opts: CompareOptions
): Promise<ComparisonResult> {
  const { workspaceId, documentIds, dimensions, query } = opts;

  const docs = await VaultDocumentModel.find({
    _id: { $in: documentIds.map((id) => new mongoose.Types.ObjectId(id)) },
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
  }).lean();

  if (docs.length < 2) {
    return {
      dimensions: [],
      overallAnalysis: "At least two documents are required for comparison.",
    };
  }

  const docChunks: Record<string, Array<{ id: string; content: string; page: number; section: string }>> = {};

  for (const doc of docs) {
    const docId = doc._id.toString();
    const chunks = await VaultChunkModel.find({
      documentId: new mongoose.Types.ObjectId(docId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    })
      .sort({ chunkIndex: 1 })
      .limit(30)
      .lean();

    docChunks[docId] = chunks.map((c) => ({
      id: c._id.toString(),
      content: c.content,
      page: c.pageNumber || 0,
      section: c.sectionPath.join(" > ") || "root",
    }));
  }

  const effectiveDimensions = dimensions && dimensions.length > 0
    ? dimensions
    : await inferDimensions(docs.map((d) => d.filename), query);

  const contextParts: string[] = [];
  for (const doc of docs) {
    const docId = doc._id.toString();
    const chunks = docChunks[docId] || [];
    const preview = chunks
      .slice(0, 15)
      .map((c) => `[p.${c.page}, ${c.section}] ${c.content.slice(0, 500)}`)
      .join("\n\n");
    contextParts.push(
      `=== Document: ${doc.filename} (ID: ${docId}) ===\n${preview}`
    );
  }

  const prompt = `Compare these documents along the following dimensions: ${effectiveDimensions.join(", ")}.
${query ? `\nFocus on: ${query}\n` : ""}

${contextParts.join("\n\n")}

Return a structured comparison as JSON with this shape:
{
  "dimensions": [
    {
      "name": "dimension name",
      "comparisons": [
        { "documentId": "id", "documentName": "filename", "summary": "2-3 sentences" }
      ]
    }
  ],
  "overallAnalysis": "2-3 sentences synthesizing the key differences and similarities"
}

Return ONLY the JSON, no other text.`;

  try {
    const result = await sendMessage({
      maxTokens: 4096,
      system:
        "You are an ESG document analyst. Compare documents precisely, citing specific content. Return only valid JSON.",
      messages: [{ role: "user", content: prompt }],
    });

    if (!result) {
      return { dimensions: [], overallAnalysis: "Comparison failed." };
    }

    const cleaned = result
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    for (const dim of parsed.dimensions || []) {
      for (const comp of dim.comparisons || []) {
        const chunks = docChunks[comp.documentId] || [];
        comp.chunkIds = chunks.slice(0, 3).map((c) => c.id);
      }
    }

    return parsed;
  } catch (error) {
    logger.error("Document comparison failed", error);
    return {
      dimensions: [],
      overallAnalysis: "Comparison analysis could not be completed.",
    };
  }
}

async function inferDimensions(
  filenames: string[],
  query?: string
): Promise<string[]> {
  const defaults = [
    "scope and coverage",
    "methodology approach",
    "data quality and completeness",
    "compliance alignment",
    "key findings or conclusions",
  ];

  if (!query) return defaults;

  try {
    const result = await sendMessage({
      model: "claude-haiku-4-5-20241022",
      maxTokens: 200,
      system:
        "Given filenames and a user query, return a JSON array of 3-5 comparison dimensions (short strings). Return ONLY the JSON array.",
      messages: [
        {
          role: "user",
          content: `Files: ${filenames.join(", ")}\nQuery: ${query}`,
        },
      ],
    });

    if (result) {
      const parsed = JSON.parse(
        result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      );
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // use defaults
  }

  return defaults;
}
