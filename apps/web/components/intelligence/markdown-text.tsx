'use client';

import React from 'react';

// ── Inline renderer ──────────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[(\d+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<React.Fragment key={k++}>{text.slice(last, m.index)}</React.Fragment>);
    }
    if (m[1] !== undefined) {
      parts.push(
        <strong key={k++} className="font-semibold text-merris-text">
          {m[1]}
        </strong>,
      );
    } else if (m[2] !== undefined) {
      parts.push(<em key={k++}>{m[2]}</em>);
    } else if (m[3] !== undefined) {
      parts.push(
        <code key={k++} className="rounded bg-merris-surface-low px-1 font-mono text-[12px] text-merris-primary">
          {m[3]}
        </code>,
      );
    } else if (m[4] !== undefined) {
      parts.push(
        <sup
          key={k++}
          className="mx-0.5 inline-flex h-[15px] min-w-[15px] cursor-default items-center justify-center rounded bg-merris-primary/10 px-0.5 align-super text-[9px] font-bold leading-none text-merris-primary"
        >
          {m[4]}
        </sup>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(<React.Fragment key={k++}>{text.slice(last)}</React.Fragment>);
  }
  return parts;
}

// ── Block types ───────────────────────────────────────────────────────────────
type Block =
  | { type: 'hr' }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'blockquote'; text: string }
  | { type: 'paragraph'; lines: string[] };

// ── Line-by-line block parser ─────────────────────────────────────────────────
function parseBlocks(raw: string): Block[] {
  const lines = raw.split('\n');
  const blocks: Block[] = [];

  let paraLines: string[] = [];
  let bulletItems: string[] = [];
  let numberedItems: string[] = [];
  let tableLines: string[] = [];

  const flushPara = () => {
    if (paraLines.length) {
      blocks.push({ type: 'paragraph', lines: [...paraLines] });
      paraLines = [];
    }
  };
  const flushBullets = () => {
    if (bulletItems.length) {
      blocks.push({ type: 'bullets', items: [...bulletItems] });
      bulletItems = [];
    }
  };
  const flushNumbered = () => {
    if (numberedItems.length) {
      blocks.push({ type: 'numbered', items: [...numberedItems] });
      numberedItems = [];
    }
  };
  const flushTable = () => {
    if (tableLines.length >= 2) {
      // First row = headers; second row = separator (---)
      const headers = (tableLines[0] ?? '')
        .split('|')
        .map((h) => h.trim())
        .filter(Boolean);
      const rows: string[][] = [];
      for (let i = 2; i < tableLines.length; i++) {
        const row = (tableLines[i] ?? '')
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean);
        if (row.length > 0) rows.push(row);
      }
      if (headers.length > 0) blocks.push({ type: 'table', headers, rows });
    } else if (tableLines.length === 1 && tableLines[0]) {
      paraLines.push(tableLines[0]);
      flushPara();
    }
    tableLines = [];
  };

  const flushAll = () => {
    flushPara();
    flushBullets();
    flushNumbered();
    flushTable();
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line — boundary between blocks
    if (!trimmed) {
      flushPara();
      flushBullets();
      flushNumbered();
      flushTable();
      continue;
    }

    // HR
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      blocks.push({ type: 'hr' });
      continue;
    }

    // Heading — detected per-line, works even without surrounding blank lines
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushAll();
      blocks.push({
        type: 'heading',
        level: Math.min((headingMatch[1] ?? '').length, 3) as 1 | 2 | 3,
        text: headingMatch[2] ?? '',
      });
      continue;
    }

    // Table row (starts and ends with |)
    if (trimmed.startsWith('|')) {
      flushPara();
      flushBullets();
      flushNumbered();
      tableLines.push(trimmed);
      continue;
    }

    // If we were accumulating table rows and hit a non-table line, flush the table
    if (tableLines.length > 0) {
      flushTable();
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushPara();
      flushBullets();
      flushNumbered();
      blocks.push({ type: 'blockquote', text: trimmed.slice(2) });
      continue;
    }

    // Unordered bullet
    if (/^\s*[-*•]\s+/.test(line)) {
      flushPara();
      flushNumbered();
      bulletItems.push(line.replace(/^\s*[-*•]\s+/, ''));
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (numMatch && numMatch[1]) {
      flushPara();
      flushBullets();
      numberedItems.push(numMatch[1]);
      continue;
    }

    // Regular paragraph line
    flushBullets();
    flushNumbered();
    paraLines.push(trimmed || line);
  }

  flushAll();
  return blocks;
}

// ── Stat value detector — makes large numbers/% visually prominent ─────────
function isStatValue(text: string): boolean {
  // Matches patterns like "8 / 15", "~62%", "88%", "$4.2B", "2.5x"
  return /^[~$]?[\d,.]+\s*[/x%BMKk]?\s*[\d,.]*$/.test(text.trim()) && text.trim().length < 12;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface MarkdownTextProps {
  text: string;
  streaming?: boolean;
  className?: string;
}

export function MarkdownText({ text, streaming = false, className = '' }: MarkdownTextProps) {
  const blocks = parseBlocks(text);

  if (blocks.length === 0) {
    return streaming ? (
      <span className="animate-cursor-blink inline-block h-[13px] w-[1.5px] translate-y-[1px] bg-merris-primary align-middle" />
    ) : null;
  }

  return (
    <div className={`space-y-[14px] ${className}`}>
      {blocks.map((block, bi) => {
        const isLast = bi === blocks.length - 1;

        if (block.type === 'hr') {
          return <hr key={bi} className="border-merris-border" />;
        }

        if (block.type === 'heading') {
          const cls =
            block.level === 1
              ? 'font-display text-[15px] font-bold text-merris-text mt-1'
              : block.level === 2
                ? 'font-display text-[14px] font-semibold text-merris-text mt-0.5'
                : 'font-display text-[13px] font-semibold text-merris-text-secondary';
          return (
            <p key={bi} className={cls}>
              {renderInline(block.text)}
            </p>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <div key={bi} className="border-l-2 border-merris-primary pl-3">
              <p className="font-body text-[13px] italic leading-[1.75] text-merris-text-secondary">
                {renderInline(block.text)}
              </p>
            </div>
          );
        }

        if (block.type === 'bullets') {
          return (
            <ul key={bi} className="space-y-[6px] pl-4">
              {block.items.map((item, ii) => {
                const isLastItem = ii === block.items.length - 1;
                return (
                  <li
                    key={ii}
                    className="relative font-body text-[13px] leading-[1.75] text-merris-text before:absolute before:-left-3 before:top-[10px] before:h-[4px] before:w-[4px] before:rounded-full before:bg-merris-primary"
                  >
                    {renderInline(item)}
                    {streaming && isLast && isLastItem && (
                      <span className="animate-cursor-blink ml-[2px] inline-block h-[13px] w-[1.5px] translate-y-[1px] bg-merris-primary align-middle" />
                    )}
                  </li>
                );
              })}
            </ul>
          );
        }

        if (block.type === 'numbered') {
          return (
            <ol key={bi} className="space-y-[6px] pl-5">
              {block.items.map((item, ii) => {
                const isLastItem = ii === block.items.length - 1;
                return (
                  <li
                    key={ii}
                    className="list-decimal font-body text-[13px] leading-[1.75] text-merris-text marker:text-merris-primary marker:font-semibold"
                  >
                    {renderInline(item)}
                    {streaming && isLast && isLastItem && (
                      <span className="animate-cursor-blink ml-[2px] inline-block h-[13px] w-[1.5px] translate-y-[1px] bg-merris-primary align-middle" />
                    )}
                  </li>
                );
              })}
            </ol>
          );
        }

        // Table — rendered as styled grid cards when ≤4 cols, otherwise a real table
        if (block.type === 'table') {
          const colCount = block.headers.length;
          const isStatGrid = colCount <= 4 && block.rows.length <= 3 &&
            block.rows.some(row => row.some(cell => isStatValue(cell)));

          if (isStatGrid) {
            // Render as visual stat cards (like the Figma comparison cards)
            return (
              <div
                key={bi}
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
              >
                {block.headers.map((header, hi) => {
                  const valueRow = block.rows.find(r => r[hi] && isStatValue(r[hi] ?? ''));
                  const descRow = block.rows.find(r => r[hi] && !isStatValue(r[hi] ?? ''));
                  const value = valueRow?.[hi];
                  const desc = descRow?.[hi];
                  return (
                    <div key={hi} className="rounded-xl border border-merris-border bg-merris-surface-low p-3">
                      <p className="mb-1.5 font-body text-[9px] font-semibold uppercase tracking-wider text-merris-text-tertiary leading-tight">
                        {header}
                      </p>
                      {value && (
                        <p className="font-display text-[22px] font-bold leading-none text-merris-text">
                          {renderInline(value)}
                        </p>
                      )}
                      {desc && (
                        <p className="mt-1 font-body text-[10px] leading-snug text-merris-text-secondary">
                          {renderInline(desc)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }

          // Standard table
          return (
            <div key={bi} className="overflow-x-auto rounded-xl border border-merris-border">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-merris-surface-low">
                    {block.headers.map((h, hi) => (
                      <th key={hi} className="border-b border-merris-border px-3 py-2 font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 1 ? 'bg-merris-surface-low/40' : ''}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="border-b border-merris-border px-3 py-2 font-body text-[12px] leading-relaxed text-merris-text last:border-b-0">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Paragraph
        return (
          <p key={bi} className="font-body text-[13px] leading-[1.75] text-merris-text">
            {block.lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(line)}
              </React.Fragment>
            ))}
            {streaming && isLast && (
              <span className="animate-cursor-blink ml-[2px] inline-block h-[13px] w-[1.5px] translate-y-[1px] bg-merris-primary align-middle" />
            )}
          </p>
        );
      })}
    </div>
  );
}
