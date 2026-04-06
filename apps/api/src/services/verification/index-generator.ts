// src/services/verification/index-generator.ts
//
// Generates a framework disclosure index by semantically matching
// document content against each disclosure requirement.

import { sendMessage } from '../../lib/claude';
import { Disclosure } from '../../models/disclosure.model';

export interface IndexEntry {
  disclosureCode: string;
  disclosureName: string;
  dataType: string;
  status: 'addressed' | 'partially_addressed' | 'not_disclosed';
  documentSection?: string;
  contentSummary?: string;
}

export interface FrameworkIndex {
  framework: string;
  totalDisclosures: number;
  addressed: number;
  partiallyAddressed: number;
  notDisclosed: number;
  coveragePercent: number;
  entries: IndexEntry[];
}

export async function generateFrameworkIndex(
  documentBody: string,
  frameworkCode: string
): Promise<FrameworkIndex> {
  // Load all disclosures for this framework
  const disclosures = await Disclosure.find({ frameworkCode }).lean();

  if (disclosures.length === 0) {
    return {
      framework: frameworkCode,
      totalDisclosures: 0,
      addressed: 0,
      partiallyAddressed: 0,
      notDisclosed: 0,
      coveragePercent: 0,
      entries: [],
    };
  }

  // Batch disclosures into groups of 10 for Claude analysis
  const batchSize = 10;
  const entries: IndexEntry[] = [];
  const docTruncated = documentBody.substring(0, 30000);

  for (let i = 0; i < disclosures.length; i += batchSize) {
    const batch = disclosures.slice(i, i + batchSize);

    const disclosureList = batch
      .map(
        (d) =>
          `- ${d.code}: ${d.name} (${d.dataType}) — ${(d.description || '').substring(0, 100)}`
      )
      .join('\n');

    const prompt = `Analyze this document and determine which of these disclosure requirements are addressed.

DISCLOSURE REQUIREMENTS:
${disclosureList}

DOCUMENT TEXT (excerpt):
${docTruncated}

For EACH disclosure requirement, respond with a JSON array. Each item:
{"code":"disclosure code","status":"addressed|partially_addressed|not_disclosed","section":"section heading where found or null","summary":"brief content summary or null"}

IMPORTANT: "addressed" means the document contains substantive content that fulfills the requirement. A brief mention of the topic without data or detail is "partially_addressed". If the topic is not discussed at all, "not_disclosed".

Return ONLY the JSON array, no other text.`;

    try {
      const response = await sendMessage({
        system: 'You are a precise ESG disclosure analyst. Return only valid JSON arrays.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2000,
      });

      if (response) {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const items = JSON.parse(jsonMatch[0]) as Array<{
            code?: string;
            status?: string;
            section?: string;
            summary?: string;
          }>;
          for (const item of items) {
            const matchedDisclosure = batch.find((d) => d.code === item.code);
            entries.push({
              disclosureCode: item.code || '',
              disclosureName: matchedDisclosure?.name || '',
              dataType: matchedDisclosure?.dataType || '',
              status: (item.status as IndexEntry['status']) || 'not_disclosed',
              documentSection: item.section || undefined,
              contentSummary: item.summary || undefined,
            });
          }
        }
      }
    } catch {
      // On failure, mark batch as not_disclosed
      for (const d of batch) {
        entries.push({
          disclosureCode: d.code,
          disclosureName: d.name,
          dataType: d.dataType,
          status: 'not_disclosed',
        });
      }
    }
  }

  const addressed = entries.filter((e) => e.status === 'addressed').length;
  const partial = entries.filter((e) => e.status === 'partially_addressed').length;
  const notDisclosed = entries.filter((e) => e.status === 'not_disclosed').length;

  return {
    framework: frameworkCode,
    totalDisclosures: entries.length,
    addressed,
    partiallyAddressed: partial,
    notDisclosed,
    coveragePercent:
      entries.length > 0
        ? Math.round(((addressed + partial * 0.5) / entries.length) * 100)
        : 0,
    entries,
  };
}
