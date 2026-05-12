'use client';

import React from 'react';

// ── Inline renderer ──────────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold**, *italic*, `code` — non-greedy
  const regex = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`/g;
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
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(<React.Fragment key={k++}>{text.slice(last)}</React.Fragment>);
  }
  return parts;
}

// ── Block parser ─────────────────────────────────────────────────────────────
type Block =
  | { type: 'hr' }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'paragraph'; lines: string[] };

function parseBlocks(raw: string): Block[] {
  const sections = raw.split(/\n\n+/);
  const blocks: Block[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      continue;
    }

    // Heading (# / ## / ###)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: Math.min(headingMatch[1].length, 3) as 1 | 2 | 3,
        text: headingMatch[2],
      });
      continue;
    }

    // Lines within section — may mix bullets and text
    const lines = trimmed.split('\n');
    const isBullet = (l: string) => /^\s*[-*]\s+/.test(l);

    let paraLines: string[] = [];
    let bulletItems: string[] = [];

    const flushPara = () => {
      if (paraLines.length) { blocks.push({ type: 'paragraph', lines: [...paraLines] }); paraLines = []; }
    };
    const flushBullets = () => {
      if (bulletItems.length) { blocks.push({ type: 'bullets', items: [...bulletItems] }); bulletItems = []; }
    };

    for (const line of lines) {
      if (isBullet(line)) {
        flushPara();
        bulletItems.push(line.replace(/^\s*[-*]\s+/, ''));
      } else {
        flushBullets();
        paraLines.push(line);
      }
    }
    flushPara();
    flushBullets();
  }

  return blocks;
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
              ? 'font-display text-[15px] font-bold text-merris-text'
              : block.level === 2
                ? 'font-display text-[14px] font-semibold text-merris-text'
                : 'font-display text-[13px] font-semibold text-merris-text-secondary';
          return (
            <p key={bi} className={cls}>
              {renderInline(block.text)}
            </p>
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
