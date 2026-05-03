import { randomUUID } from "crypto";
import { logger } from "../../../lib/logger.js";
import type { ParsedDocument, ParsedElement } from "../types.js";

interface EmailHeaders {
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
}

export async function parseEmail(
  buffer: Buffer,
  docId: string,
  workspaceId: string
): Promise<Partial<ParsedDocument>> {
  try {
    const raw = buffer.toString("utf-8");
    const headers = extractHeaders(raw);
    const body = extractBody(raw);

    const elements: ParsedElement[] = [];

    elements.push({
      elementId: randomUUID(),
      type: "heading",
      text: `Email: ${headers.subject || "(no subject)"}`,
      page: 1,
      metadata: {
        headingLevel: 1,
        headingPath: ["Email"],
      },
    });

    elements.push({
      elementId: randomUUID(),
      type: "paragraph",
      text: `From: ${headers.from}\nTo: ${headers.to}${headers.cc ? `\nCc: ${headers.cc}` : ""}\nDate: ${headers.date}`,
      page: 1,
      metadata: { headingPath: ["Email", "Headers"] },
    });

    if (body.trim()) {
      const { mainBody, quotedReplies } = separateQuotedReplies(body);

      if (mainBody.trim()) {
        const paragraphs = mainBody.split(/\n\n+/).filter(Boolean);
        for (const para of paragraphs) {
          elements.push({
            elementId: randomUUID(),
            type: "paragraph",
            text: para.trim(),
            page: 1,
            metadata: { headingPath: ["Email", "Body"] },
          });
        }
      }

      if (quotedReplies.trim()) {
        elements.push({
          elementId: randomUUID(),
          type: "footnote",
          text: `[Quoted Replies]\n${quotedReplies.trim().slice(0, 3000)}`,
          page: 1,
          metadata: { headingPath: ["Email", "Quoted Replies"] },
        });
      }
    }

    return {
      docId,
      workspaceId,
      outline: [
        {
          level: 1,
          title: headers.subject || "Email",
          pageStart: 1,
          pageEnd: 1,
        },
      ],
      elements,
      tables: [],
      images: [],
    };
  } catch (error) {
    logger.error("Vault email parsing failed", error);
    throw new Error("Failed to parse email for vault ingestion");
  }
}

function extractHeaders(raw: string): EmailHeaders {
  const headerBlock = raw.split(/\r?\n\r?\n/)[0] || "";
  const get = (name: string): string => {
    const regex = new RegExp(`^${name}:\\s*(.+)`, "im");
    const match = headerBlock.match(regex);
    return match?.[1]?.trim() || "";
  };

  return {
    from: get("From"),
    to: get("To"),
    cc: get("Cc"),
    subject: get("Subject"),
    date: get("Date"),
  };
}

function extractBody(raw: string): string {
  const parts = raw.split(/\r?\n\r?\n/);
  if (parts.length < 2) return "";
  const body = parts.slice(1).join("\n\n");

  if (body.includes("Content-Type: text/plain")) {
    const plainMatch = body.match(
      /Content-Type: text\/plain[^\n]*\n(?:Content-Transfer-Encoding:[^\n]*\n)?\n([\s\S]*?)(?=\n--|\n\nContent-Type:|$)/
    );
    if (plainMatch) return plainMatch[1];
  }

  return body
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function separateQuotedReplies(body: string): {
  mainBody: string;
  quotedReplies: string;
} {
  const lines = body.split("\n");
  const mainLines: string[] = [];
  const quotedLines: string[] = [];
  let inQuoted = false;

  for (const line of lines) {
    if (
      !inQuoted &&
      (/^>/.test(line) ||
        /^On .+ wrote:$/i.test(line) ||
        /^-{3,}\s*Original Message/i.test(line) ||
        /^_{3,}$/i.test(line))
    ) {
      inQuoted = true;
    }

    if (inQuoted) {
      quotedLines.push(line.replace(/^>\s?/, ""));
    } else {
      mainLines.push(line);
    }
  }

  return {
    mainBody: mainLines.join("\n"),
    quotedReplies: quotedLines.join("\n"),
  };
}
