import type { ParsedDocument, ParsedElement, ChunkInput } from "./types.js";

const TARGET_MIN_TOKENS = 400;
const TARGET_MAX_TOKENS = 800;
const HARD_MAX_TOKENS = 1200;
const TABLE_HARD_MAX_TOKENS = 4000;
const OVERLAP_TOKENS = 100;
const LIST_MAX_TOKENS = 600;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkDocument(parsed: ParsedDocument): ChunkInput[] {
  const chunks: ChunkInput[] = [];

  for (const table of parsed.tables) {
    const tableText = table.rows.map((r) => r.join(" | ")).join("\n");
    const caption = table.caption ? `${table.caption}\n` : "";
    const headers =
      table.rows.length > 1 ? table.rows[0].join(" | ") + "\n" : "";
    const fullText = caption + headers + tableText;
    const tokens = estimateTokens(fullText);

    if (tokens <= TABLE_HARD_MAX_TOKENS) {
      chunks.push({
        content: fullText,
        chunkType: "table",
        pageNumber: table.page,
        sectionPath: [],
        tableData: {
          headers: table.rows[0] || [],
          rows: table.rows.slice(1),
          caption: table.caption,
        },
        tokenCount: tokens,
      });
    } else {
      const rowsPerGroup = Math.max(
        1,
        Math.floor(TABLE_HARD_MAX_TOKENS / (tokens / table.rows.length))
      );
      for (let i = 1; i < table.rows.length; i += rowsPerGroup) {
        const groupRows = table.rows.slice(i, i + rowsPerGroup);
        const groupText =
          headers + groupRows.map((r) => r.join(" | ")).join("\n");
        chunks.push({
          content: groupText,
          chunkType: "table",
          pageNumber: table.page,
          sectionPath: [],
          tableData: {
            headers: table.rows[0] || [],
            rows: groupRows,
            caption: table.caption,
          },
          tokenCount: estimateTokens(groupText),
        });
      }
    }
  }

  const textElements = parsed.elements.filter(
    (e) => e.type !== "table"
  );
  const sections = groupBySections(textElements);

  for (const section of sections) {
    const sectionPath = section.headingPath;
    const headingPrefix =
      sectionPath.length > 0 ? sectionPath.join(" > ") + "\n\n" : "";

    let currentTexts: string[] = [];
    let currentTokens = estimateTokens(headingPrefix);
    let currentPage = section.elements[0]?.page || 1;
    let listBuffer: string[] = [];

    const flushList = () => {
      if (listBuffer.length === 0) return;
      const listText = listBuffer.join("\n");
      const listTokens = estimateTokens(listText);
      if (currentTokens + listTokens <= TARGET_MAX_TOKENS) {
        currentTexts.push(listText);
        currentTokens += listTokens;
      } else {
        flushChunk();
        currentTexts.push(listText);
        currentTokens = estimateTokens(headingPrefix) + listTokens;
      }
      listBuffer = [];
    };

    const flushChunk = () => {
      if (currentTexts.length === 0) return;
      const content = headingPrefix + currentTexts.join("\n\n");
      chunks.push({
        content,
        chunkType: "text",
        pageNumber: currentPage,
        sectionPath: [...sectionPath],
        tokenCount: estimateTokens(content),
      });

      const overlapTexts: string[] = [];
      let overlapTokens = 0;
      for (let i = currentTexts.length - 1; i >= 0; i--) {
        const t = currentTexts[i];
        const tTokens = estimateTokens(t);
        if (overlapTokens + tTokens > OVERLAP_TOKENS) break;
        overlapTexts.unshift(t);
        overlapTokens += tTokens;
      }

      currentTexts = overlapTexts;
      currentTokens = estimateTokens(headingPrefix) + overlapTokens;
    };

    for (const el of section.elements) {
      if (el.type === "list_item") {
        listBuffer.push(`- ${el.text}`);
        const listTokens = estimateTokens(listBuffer.join("\n"));
        if (listTokens > LIST_MAX_TOKENS) {
          flushList();
        }
        continue;
      }

      flushList();

      const elTokens = estimateTokens(el.text);
      if (currentTokens + elTokens > TARGET_MAX_TOKENS) {
        if (currentTexts.length > 0) {
          flushChunk();
        }
        if (elTokens > HARD_MAX_TOKENS) {
          const splitTexts = splitLongText(el.text, TARGET_MAX_TOKENS);
          for (const st of splitTexts) {
            chunks.push({
              content: headingPrefix + st,
              chunkType: "text",
              pageNumber: el.page,
              sectionPath: [...sectionPath],
              tokenCount: estimateTokens(headingPrefix + st),
            });
          }
          continue;
        }
      }

      currentTexts.push(el.text);
      currentTokens += elTokens;
      currentPage = el.page;
    }

    flushList();
    flushChunk();
  }

  return chunks;
}

interface Section {
  headingPath: string[];
  elements: ParsedElement[];
}

function groupBySections(elements: ParsedElement[]): Section[] {
  const sections: Section[] = [];
  let currentPath: string[] = [];
  let currentElements: ParsedElement[] = [];

  for (const el of elements) {
    if (el.type === "heading") {
      if (currentElements.length > 0) {
        sections.push({
          headingPath: [...currentPath],
          elements: currentElements,
        });
      }
      const level = el.metadata?.headingLevel || 1;
      currentPath = currentPath.slice(0, level - 1);
      currentPath[level - 1] = el.text;
      currentPath = currentPath.filter(Boolean);
      currentElements = [el];
    } else {
      currentElements.push(el);
    }
  }

  if (currentElements.length > 0) {
    sections.push({ headingPath: [...currentPath], elements: currentElements });
  }

  return sections;
}

function splitLongText(text: string, maxTokens: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (
      estimateTokens(current + " " + sentence) > maxTokens &&
      current.length > 0
    ) {
      parts.push(current.trim());
      current = sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
