import { MerrisCard } from './card';
import { SectionLabel } from './label';

export function PlaceholderPage({
  title,
  planRef,
  description,
}: {
  title: string;
  planRef: string;
  description: string;
}) {
  return (
    <div className="p-8">
      <SectionLabel>{planRef}</SectionLabel>
      <h1 className="font-display text-[28px] font-bold text-merris-text">{title}</h1>
      <p className="mt-2 max-w-xl font-body text-[14px] text-merris-text-secondary">{description}</p>
      <MerrisCard className="mt-6 max-w-xl">
        <p className="font-body text-[13px] text-merris-text-secondary">
          This page is a stub. Implementation lands in <strong>{planRef}</strong>.
        </p>
      </MerrisCard>
    </div>
  );
}
