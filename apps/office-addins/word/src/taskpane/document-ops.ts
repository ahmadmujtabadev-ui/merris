// src/taskpane/document-ops.ts

/* globals Word */
declare const Word: any;

// ---- Heading Detection ----

export function isHeading(text: string, style: string): boolean {
  if (!text) return false;
  if (style.includes("heading")) return true;
  if (/^(GRI|ESRS|IFRS S|TCFD|SASB)\s/i.test(text)) return true;
  if (/^\d+(\.\d+)*\.?\s+\S/.test(text)) return true;
  if (text.length < 80 && text.length > 2 && /^[A-Z]/.test(text)) {
    if (text === text.toUpperCase() && text.length > 3) return true;
    if (!text.endsWith(".") && text.length < 60) return true;
  }
  return false;
}

export function detectFramework(text: string): string {
  if (/GRI\s?\d/i.test(text)) return "GRI";
  if (/ESRS\s?[A-Z]/i.test(text)) return "ESRS";
  if (/TCFD/i.test(text)) return "TCFD";
  if (/SASB/i.test(text)) return "SASB";
  if (/IFRS\sS/i.test(text)) return "IFRS S";
  return "";
}

// ---- Read Operations ----

export interface ParagraphData {
  text: string;
  style: string;
  index: number;
}

export async function readAllParagraphs(): Promise<ParagraphData[]> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text,items/style");
      await ctx.sync();
      const result: ParagraphData[] = [];
      for (let i = 0; i < paras.items.length; i++) {
        result.push({
          text: paras.items[i].text || "",
          style: (paras.items[i].style || "").toLowerCase(),
          index: i,
        });
      }
      resolve(result);
    }).catch(() => resolve([]));
  });
}

export async function readFullDocument(): Promise<string> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text,items/style");
      await ctx.sync();
      let text = "";
      for (const p of paras.items) {
        const t = (p.text || "").trim();
        if (!t) continue;
        const s = (p.style || "").toLowerCase();
        text += s.includes("heading") ? `\n${t}\n` : `${t}\n`;
      }
      resolve(text);
    }).catch(() => resolve(""));
  });
}

export async function getCursorParagraphIndex(): Promise<number> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const sel = ctx.document.getSelection();
      const paras = ctx.document.body.paragraphs;
      sel.load("text");
      paras.load("items/text");
      await ctx.sync();
      const selText = (sel.text || "").trim();
      if (!selText) { resolve(-1); return; }
      for (let i = 0; i < paras.items.length; i++) {
        if ((paras.items[i].text || "").includes(selText.substring(0, 30))) {
          resolve(i); return;
        }
      }
      resolve(-1);
    }).catch(() => resolve(-1));
  });
}

// ---- Write Operations ----

export async function replaceAtIndex(index: number, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text,items/font");
      await ctx.sync();
      if (index >= 0 && index < paras.items.length) {
        paras.items[index].clear();
        paras.items[index].insertText(text.replace(/\n/g, "\r"), "Start");
        paras.items[index].font.color = "#000000";
        paras.items[index].font.italic = false;
        paras.items[index].font.size = 11;
        await ctx.sync();
        resolve(true);
      } else {
        resolve(false);
      }
    }).catch(() => resolve(false));
  });
}

export async function insertAfterIndex(index: number, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text");
      await ctx.sync();
      if (index >= 0 && index < paras.items.length) {
        const p = paras.items[index].insertParagraph(text.replace(/\n/g, "\r"), "After");
        p.font.color = "#000000";
        p.font.italic = false;
        p.font.size = 11;
        await ctx.sync();
        resolve(true);
      } else {
        resolve(false);
      }
    }).catch(() => resolve(false));
  });
}

export async function deleteParagraphContaining(searchText: string): Promise<boolean> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text");
      await ctx.sync();
      for (const p of paras.items) {
        if ((p.text || "").includes(searchText)) {
          p.delete();
          await ctx.sync();
          resolve(true); return;
        }
      }
      resolve(false);
    }).catch(() => resolve(false));
  });
}

export async function insertCommentOn(searchText: string, comment: string): Promise<boolean> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text");
      await ctx.sync();
      for (const p of paras.items) {
        if ((p.text || "").includes(searchText.substring(0, 40))) {
          try {
            const range = p.getRange("Whole");
            range.insertComment(comment);
            await ctx.sync();
            resolve(true); return;
          } catch {
            const note = p.insertParagraph(`[Merris Review] ${comment}`, "After");
            note.font.color = "#6366f1";
            note.font.italic = true;
            note.font.size = 10;
            await ctx.sync();
            resolve(true); return;
          }
        }
      }
      resolve(false);
    }).catch(() => resolve(false));
  });
}

export async function insertTableAfter(searchText: string, tableData: string[][]): Promise<boolean> {
  if (tableData.length < 2) return false;
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text");
      await ctx.sync();
      for (const p of paras.items) {
        if ((p.text || "").includes(searchText.substring(0, 30))) {
          const rows = tableData.length;
          const cols = tableData[0].length;
          const table = p.insertTable(rows, cols, "After", tableData);
          table.styleBuiltIn = Word.BuiltInStyleName.gridTable4Accent1;
          table.headerRowCount = 1;
          p.delete();
          await ctx.sync();
          resolve(true); return;
        }
      }
      resolve(false);
    }).catch(() => resolve(false));
  });
}

export async function replaceParagraphText(oldTextSubstring: string, newText: string): Promise<{ success: boolean; oldFull: string }> {
  return new Promise((resolve) => {
    Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text,items/font");
      await ctx.sync();
      for (const p of paras.items) {
        const pText = p.text || "";
        if (pText.includes(oldTextSubstring)) {
          const oldFull = pText;
          p.clear();
          p.insertText(newText.replace(/\n/g, "\r"), "Start");
          p.font.color = "#000000";
          p.font.italic = false;
          p.font.size = 11;
          await ctx.sync();
          resolve({ success: true, oldFull }); return;
        }
      }
      resolve({ success: false, oldFull: "" });
    }).catch(() => resolve({ success: false, oldFull: "" }));
  });
}

export async function scrollToHeading(heading: string): Promise<void> {
  try {
    await Word.run(async (ctx: any) => {
      const paras = ctx.document.body.paragraphs;
      paras.load("items/text");
      await ctx.sync();
      for (const p of paras.items) {
        if ((p.text || "").trim() === heading) {
          p.select();
          await ctx.sync();
          return;
        }
      }
    });
  } catch { /* best effort */ }
}
