'use client';

import { MerrisCard } from '@/components/merris/card';

interface Props {
  text: string | null | undefined;
}

export function DocumentViewerContent({ text }: Props) {
  if (!text) {
    return (
      <MerrisCard className="font-body text-[12px] text-merris-text-tertiary">
        This document has no extracted text yet. Trigger processing from the engagement view.
      </MerrisCard>
    );
  }

  // Split on double-newline for paragraphs; preserve single newlines as line breaks
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <MerrisCard className="font-body text-[13px] leading-[1.7] text-merris-text">
      <article className="prose-merris">
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-4 last:mb-0 whitespace-pre-line">
            {p}
          </p>
        ))}
      </article>
    </MerrisCard>
  );
}
