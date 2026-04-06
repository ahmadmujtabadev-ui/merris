// src/services/vault/vault.service.ts
//
// Unified document vault wrapping existing ingestion + KB.

import { uploadDocument } from "../../modules/ingestion/ingestion.service.js";
import { semanticSearch } from "../../modules/knowledge-base/search.service.js";
import { ESGDocumentModel } from "../../modules/ingestion/ingestion.model.js";
import { DataPointModel } from "../../modules/ingestion/ingestion.model.js";
import { sendMessage } from "../../lib/claude.js";

export type VaultType = "engagement" | "knowledge" | "firm";

export interface VaultInfo {
  id: string;
  name: string;
  type: VaultType;
  engagementId?: string;
  fileCount: number;
  createdAt: Date;
}

export async function getEngagementVault(engagementId: string): Promise<VaultInfo> {
  const docs = await ESGDocumentModel.countDocuments({ engagementId });
  return {
    id: `vault-eng-${engagementId}`,
    name: `Engagement Vault`,
    type: "engagement",
    engagementId,
    fileCount: docs,
    createdAt: new Date(),
  };
}

export async function listVaultFiles(
  engagementId: string
): Promise<Array<{ id: string; filename: string; format: string; status: string; uploadedAt: Date }>> {
  const docs = await ESGDocumentModel.find({ engagementId })
    .select("filename format status uploadedAt")
    .sort({ uploadedAt: -1 })
    .lean();

  return docs.map((d: any) => ({
    id: String(d._id),
    filename: d.filename,
    format: d.format,
    status: d.status,
    uploadedAt: d.uploadedAt,
  }));
}

export async function uploadToVault(
  engagementId: string,
  orgId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
) {
  return uploadDocument(engagementId, orgId, filename, buffer, mimeType);
}

export async function queryVault(
  engagementId: string,
  query: string
): Promise<{ results: any[]; source: string }> {
  // Search across engagement documents
  const dataPoints = await DataPointModel.find({
    engagementId,
    $or: [
      { metricName: { $regex: query, $options: "i" } },
      { frameworkRef: { $regex: query, $options: "i" } },
    ],
  })
    .limit(20)
    .lean();

  // Also search knowledge base
  // semanticSearch returns SearchResult[] directly
  const kbResults = await semanticSearch({ query, limit: 5 });

  return {
    results: [
      ...dataPoints.map((dp: any) => ({
        type: "data_point",
        metric: dp.metricName,
        value: dp.value,
        unit: dp.unit,
        framework: dp.frameworkRef,
        confidence: dp.confidence,
      })),
      ...kbResults.map((r: any) => ({
        type: "knowledge",
        title: r.title,
        domain: r.domain,
        source: r.source,
        score: r.score,
      })),
    ],
    source: "engagement + knowledge base",
  };
}

// ============================================================
// Deep Query — Claude-powered analysis over vault data
// ============================================================

export interface DeepQuerySource {
  type: "data_point" | "knowledge";
  metric?: string;
  value?: string | number;
  unit?: string;
  framework?: string;
  title?: string;
  domain?: string;
  source?: string;
}

export async function deepQueryVault(
  engagementId: string,
  query: string
): Promise<{ answer: string; sources: DeepQuerySource[] }> {
  // 1. Gather data points for the engagement
  const dataPoints = await DataPointModel.find({ engagementId })
    .limit(100)
    .lean();

  // 2. Get KB search results
  const kbResults = await semanticSearch({ query, limit: 10 });

  // 3. Build context string
  const dpContext = dataPoints
    .map(
      (dp: any) =>
        `- ${dp.metricName}: ${dp.value} ${dp.unit} (framework: ${dp.frameworkRef}, confidence: ${dp.confidence})`
    )
    .join("\n");

  const kbContext = kbResults
    .map(
      (r) =>
        `- [${r.domain}] ${r.title}: ${r.description} (source: ${r.source}, year: ${r.year})`
    )
    .join("\n");

  const contextString = [
    "=== Engagement Data Points ===",
    dpContext || "(no data points found)",
    "",
    "=== Knowledge Base Results ===",
    kbContext || "(no knowledge base results found)",
  ].join("\n");

  // 4. Call Claude
  const systemPrompt =
    "You are an ESG data analyst. Answer the question using only the provided data. " +
    "Cite specific values and sources. If the data is insufficient to answer, say so clearly.";

  const answer = await sendMessage({
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Context:\n${contextString}\n\nQuestion: ${query}`,
      },
    ],
  });

  // 5. Build sources list
  const sources: DeepQuerySource[] = [
    ...dataPoints.map((dp: any) => ({
      type: "data_point" as const,
      metric: dp.metricName as string,
      value: dp.value as string | number,
      unit: dp.unit as string,
      framework: dp.frameworkRef as string,
    })),
    ...kbResults.map((r) => ({
      type: "knowledge" as const,
      title: r.title,
      domain: r.domain,
      source: r.source,
    })),
  ];

  return {
    answer: answer || "Unable to generate a response. Please try again.",
    sources,
  };
}
