'use client';

interface Props {
  text: string | null | undefined;
}

function classifyLine(line: string): 'heading' | 'subheading' | 'empty' | 'body' {
  const t = line.trim();
  if (!t) return 'empty';
  // ALL-CAPS short lines → heading
  if (t.length < 80 && t === t.toUpperCase() && /[A-Z]/.test(t)) return 'heading';
  // Short lines with no terminal punctuation that start with a capital → subheading
  if (t.length < 70 && !/[.,:;?!]$/.test(t) && /^[A-Z0-9•·▸–]/.test(t)) return 'subheading';
  return 'body';
}

export function DocumentViewerContent({ text }: Props) {
  if (!text) {
    return (
      <div className="flex min-h-[500px] items-center justify-center rounded-merris border border-merris-border bg-merris-surface-low">
        <p className="font-body text-[12px] text-merris-text-tertiary">
          No extracted text yet. Trigger processing from the engagement view.
        </p>
      </div>
    );
  }

  const lines = text.split('\n');

  return (
    <div
      className="flex flex-col overflow-hidden rounded-merris border border-merris-border bg-merris-surface-low"
      style={{ maxHeight: 'calc(100vh - 160px)' }}
    >
      {/* Toolbar bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-merris-border bg-merris-surface px-4 py-2">
        <span className="font-body text-[11px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
          Document
        </span>
        <span className="font-body text-[11px] text-merris-text-tertiary">
          {lines.length} lines
        </span>
      </div>

      {/* Scrollable page area */}
      <div className="overflow-y-auto bg-[#f5f5f0] p-6">
        {/* Paper page */}
        <div className="mx-auto max-w-[640px] rounded bg-white px-12 py-10 shadow-[0_2px_12px_rgba(0,0,0,0.10)]">
          <article className="font-body text-[13.5px] leading-[1.8] text-[#1a1a1a]">
            {lines.map((line, i) => {
              const kind = classifyLine(line);
              if (kind === 'empty') return <div key={i} className="h-2" />;
              if (kind === 'heading') {
                return (
                  <h2
                    key={i}
                    className="mt-7 mb-3 font-display text-[15px] font-bold uppercase tracking-wide text-[#111]"
                  >
                    {line.trim()}
                  </h2>
                );
              }
              if (kind === 'subheading') {
                return (
                  <h3
                    key={i}
                    className="mt-5 mb-1 font-display text-[13px] font-semibold text-[#222]"
                  >
                    {line.trim()}
                  </h3>
                );
              }
              return (
                <p key={i} className="mb-1">
                  {line.trim()}
                </p>
              );
            })}
          </article>
        </div>
      </div>
    </div>
  );
}
