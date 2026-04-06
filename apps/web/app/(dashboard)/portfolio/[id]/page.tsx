import { PlaceholderPage } from '@/components/merris/placeholder-page';

export default function EngagementDetailPage({ params }: { params: { id: string } }) {
  return (
    <PlaceholderPage
      title={`Engagement ${params.id}`}
      planRef="Plan 4: portfolio-and-doc-viewer"
      description="Engagement detail view with split-pane document viewer activated by review actions."
    />
  );
}
