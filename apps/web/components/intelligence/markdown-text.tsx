'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

// Citation superscript: [1] [2] etc
function renderCitationRefs(text: string): React.ReactNode {
  const parts = text.split(/(\[\d+\])/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (m) {
      return (
        <sup
          key={i}
          className="mx-0.5 inline-flex h-[15px] min-w-[15px] cursor-default items-center justify-center rounded bg-merris-primary/10 px-0.5 align-super text-[9px] font-bold leading-none text-merris-primary"
        >
          {m[1]}
        </sup>
      );
    }
    return part;
  });
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-1 font-display text-[18px] font-extrabold leading-tight text-merris-text">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-1 font-display text-[15px] font-bold leading-snug text-merris-text border-b border-merris-border pb-1">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-0.5 font-display text-[13px] font-semibold leading-snug text-merris-primary">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2 mb-0.5 font-display text-[12px] font-semibold text-merris-text-secondary uppercase tracking-wide">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="font-body text-[13px] leading-[1.8] text-merris-text">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-merris-text">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-merris-text-secondary">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="my-1 space-y-1.5 pl-0 list-none">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 space-y-1.5 pl-6 list-decimal marker:text-merris-primary marker:font-semibold">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="relative flex items-start gap-2.5 font-body text-[13px] leading-[1.75] text-merris-text">
      <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-merris-primary" />
      <span>{children}</span>
    </li>
  ),
  // Override li inside ol to not show the dot
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-merris-primary pl-4 my-2">
      <div className="font-body text-[13px] italic leading-[1.75] text-merris-text-secondary">
        {children}
      </div>
    </blockquote>
  ),
  code: ({ children, className }) => {
    // Block code
    if (className) {
      return (
        <pre className="my-3 overflow-x-auto rounded-xl border border-merris-border bg-merris-surface-low p-4">
          <code className="font-mono text-[12px] leading-relaxed text-merris-text">{children}</code>
        </pre>
      );
    }
    // Inline code
    return (
      <code className="rounded bg-merris-surface-low px-1.5 py-0.5 font-mono text-[11px] text-merris-primary">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  hr: () => <hr className="my-3 border-merris-border" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-merris-border">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-merris-surface-low">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-merris-border px-3 py-2 font-body text-[10px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-merris-border px-3 py-2.5 font-body text-[12px] leading-relaxed text-merris-text last:border-b-0">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="transition-colors even:bg-merris-surface-low/40 hover:bg-merris-primary-bg/30">
      {children}
    </tr>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-merris-primary underline decoration-merris-primary/30 underline-offset-2 hover:decoration-merris-primary"
    >
      {children}
    </a>
  ),
};

// ol li should not have the bullet dot — override for ordered lists
const olLiComponents: Components = {
  ...components,
  li: ({ children }) => (
    <li className="font-body text-[13px] leading-[1.75] text-merris-text pl-0">
      {children}
    </li>
  ),
};

interface MarkdownTextProps {
  text: string;
  streaming?: boolean;
  className?: string;
}

export function MarkdownText({ text, streaming = false, className = '' }: MarkdownTextProps) {
  if (!text && streaming) {
    return (
      <span className="animate-cursor-blink inline-block h-[13px] w-[1.5px] translate-y-[1px] bg-merris-primary align-middle" />
    );
  }

  // Replace [N] citation markers so react-markdown doesn't strip them
  const processedText = text.replace(/\[(\d+)\]/g, '[[C$1]]');

  return (
    <div className={`space-y-3 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ...components,
          // Intercept text nodes to render citation refs
          p: ({ children }) => (
            <p className="font-body text-[13px] leading-[1.8] text-merris-text">
              {processCitationChildren(children)}
            </p>
          ),
          li: ({ children, node }) => {
            // Check if inside ordered list
            const isOrdered = (node as any)?.parent?.tagName === 'ol';
            if (isOrdered) {
              return (
                <li className="font-body text-[13px] leading-[1.75] text-merris-text">
                  {processCitationChildren(children)}
                </li>
              );
            }
            return (
              <li className="relative flex items-start gap-2.5 font-body text-[13px] leading-[1.75] text-merris-text list-none">
                <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-merris-primary" />
                <span>{processCitationChildren(children)}</span>
              </li>
            );
          },
        }}
      >
        {processedText}
      </ReactMarkdown>
      {streaming && (
        <span className="animate-cursor-blink inline-block h-[13px] w-[1.5px] translate-y-[1px] bg-merris-primary align-middle" />
      )}
    </div>
  );
}

// Replace [[CN]] markers back to superscript in rendered children
function processCitationChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') {
    return renderCitationRefs(children.replace(/\[\[C(\d+)\]\]/g, '[$1]'));
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === 'string') {
        return <React.Fragment key={i}>{renderCitationRefs(child.replace(/\[\[C(\d+)\]\]/g, '[$1]'))}</React.Fragment>;
      }
      return child;
    });
  }
  return children;
}
