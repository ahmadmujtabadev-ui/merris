/**
 * Merris ESG Agent -- Word Ribbon Commands
 *
 * Functions invoked from the ribbon buttons defined in manifest.xml.
 * They run in a hidden browser instance (not the taskpane).
 */

import {
  draftDisclosure,
  checkConsistency,
  getEvidenceTrail,
  api,
} from "../../../shared/api-client";
import { ensureAuthenticated } from "../../../shared/auth";

/* globals Office, Word */
declare const Office: any;
declare const Word: any;

// ---- Initialization ----

Office.onReady(async () => {
  try {
    await ensureAuthenticated();
  } catch {
    // Continue without auth in dev
  }
});

// ---- Draft Section Command ----

async function draftSection(event: any): Promise<void> {
  try {
    await Word.run(async (context: any) => {
      // Find the current heading
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("items/text,items/style");
      await context.sync();

      let currentHeading = "";
      let framework = "";

      for (const para of paragraphs.items) {
        const style = para.style?.toLowerCase() || "";
        const text = para.text?.trim() || "";

        if (
          style.includes("heading") ||
          text.match(/^(GRI|ESRS|IFRS S|TCFD|SASB)\s/i)
        ) {
          currentHeading = text;

          if (text.match(/GRI/i)) framework = "GRI";
          else if (text.match(/ESRS/i)) framework = "ESRS";
          else if (text.match(/TCFD/i)) framework = "TCFD";
          else if (text.match(/SASB/i)) framework = "SASB";
          else if (text.match(/IFRS\sS/i)) framework = "IFRS S";
        }
      }

      if (!currentHeading) {
        console.log(
          "[Merris] No disclosure heading found. Place cursor under a heading."
        );
        event.completed();
        return;
      }

      // Call the agent to draft the section
      const draft = await draftDisclosure(currentHeading, framework);

      // Insert the drafted content
      const paragraphTexts = draft.content
        .split("\n")
        .filter((p: string) => p.trim());
      for (const text of paragraphTexts) {
        context.document.body.insertParagraph(text, Word.InsertLocation.end);
      }

      // Add a citation footnote summary
      if (draft.citations.length > 0) {
        const citationText = draft.citations
          .map(
            (c, i) =>
              `[${i + 1}] ${c.source}${c.page ? `, p. ${c.page}` : ""}`
          )
          .join("; ");
        const footnotePara = context.document.body.insertParagraph(
          `Sources: ${citationText}`,
          Word.InsertLocation.end
        );
        footnotePara.font.size = 9;
        footnotePara.font.italic = true;
        footnotePara.font.color = "#757575";
      }

      await context.sync();
      console.log("[Merris] Section drafted successfully.");
    });
  } catch (err: any) {
    console.error("[Merris] Draft section error:", err.message || err);
  }

  event.completed();
}

// ---- Insert Data Table Command ----

async function insertDataTable(event: any): Promise<void> {
  try {
    await Word.run(async (context: any) => {
      // Detect current section heading
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("items/text,items/style");
      await context.sync();

      let currentHeading = "";
      for (const para of paragraphs.items) {
        const style = para.style?.toLowerCase() || "";
        const text = para.text?.trim() || "";
        if (style.includes("heading") || text.match(/^(GRI|ESRS)/i)) {
          currentHeading = text;
        }
      }

      // Fetch data for the current section
      const result = await api.post<{
        headers: string[];
        rows: string[][];
      }>("/agent/section-data-table", { heading: currentHeading });

      if (!result.rows || result.rows.length === 0) {
        console.log("[Merris] No data available for this section.");
        event.completed();
        return;
      }

      // Build table data (headers + rows)
      const tableData = [result.headers, ...result.rows];
      const rowCount = tableData.length;
      const colCount = tableData[0].length;

      const table = context.document.body.insertTable(
        rowCount,
        colCount,
        Word.InsertLocation.end,
        tableData
      );

      // Apply built-in table style
      table.styleBuiltIn = Word.BuiltInStyleName.gridTable4Accent1;
      table.headerRowCount = 1;

      await context.sync();
      console.log("[Merris] Data table inserted successfully.");
    });
  } catch (err: any) {
    console.error("[Merris] Insert table error:", err.message || err);
  }

  event.completed();
}

// ---- Consistency Check Command ----

async function consistencyCheckCommand(event: any): Promise<void> {
  try {
    await Word.run(async (context: any) => {
      // Get the full document text
      const body = context.document.body;
      body.load("text");
      await context.sync();

      const documentText = body.text;

      // Call consistency check API
      const result = await checkConsistency(documentText);

      if (result.issues.length === 0) {
        console.log("[Merris] No consistency issues found.");
        event.completed();
        return;
      }

      // Highlight issues in the document using search
      for (const issue of result.issues) {
        if (issue.value_found) {
          const searchResults = body.search(issue.value_found, {
            matchCase: true,
            matchWholeWord: false,
          });
          searchResults.load("items/font");
          await context.sync();

          for (const item of searchResults.items) {
            if (issue.severity === "error") {
              item.font.highlightColor = "#FF0000";
              item.font.underline = Word.UnderlineType.wavy;
            } else {
              item.font.highlightColor = "#FFA500";
            }
          }
        }
      }

      await context.sync();
      console.log(
        `[Merris] Consistency check: ${result.issues.length} issue(s) found.`
      );
    });
  } catch (err: any) {
    console.error("[Merris] Consistency check error:", err.message || err);
  }

  event.completed();
}

// ---- Evidence Trail Command ----

async function evidenceTrailCommand(event: any): Promise<void> {
  try {
    await Word.run(async (context: any) => {
      const selection = context.document.getSelection();
      selection.load("text");
      await context.sync();

      const selectedText = selection.text?.trim();
      if (!selectedText) {
        console.log("[Merris] Select a data point to view its evidence trail.");
        event.completed();
        return;
      }

      // Use selected text as metric identifier
      const result = await getEvidenceTrail(selectedText);

      if (result.sources.length === 0) {
        console.log("[Merris] No evidence trail found for this data point.");
        event.completed();
        return;
      }

      // Insert evidence as a comment-style footnote
      const evidenceText = result.sources
        .map(
          (s, i) =>
            `[${i + 1}] ${s.document}${s.page ? `, p. ${s.page}` : ""}${s.excerpt ? `: "${s.excerpt}"` : ""}`
        )
        .join("\n");

      console.log(`[Merris] Evidence trail:\n${evidenceText}`);

      // Add as a comment on the selection (Word.js comments API)
      // Note: Comments API requires WordApi 1.4+
      try {
        const comment = selection.insertComment(`Evidence Trail:\n${evidenceText}`);
        await context.sync();
      } catch {
        // Fallback: insert as footnote paragraph
        const footnotePara = context.document.body.insertParagraph(
          `Evidence for "${selectedText}": ${evidenceText}`,
          Word.InsertLocation.end
        );
        footnotePara.font.size = 9;
        footnotePara.font.italic = true;
        footnotePara.font.color = "#757575";
        await context.sync();
      }
    });
  } catch (err: any) {
    console.error("[Merris] Evidence trail error:", err.message || err);
  }

  event.completed();
}

// ---- Register commands globally ----

(globalThis as any).draftSection = draftSection;
(globalThis as any).insertDataTable = insertDataTable;
(globalThis as any).consistencyCheck = consistencyCheckCommand;
(globalThis as any).evidenceTrail = evidenceTrailCommand;
