import { EngagementDetail } from '@/components/portfolio/engagement-detail';

export default function EngagementDetailPage({ params }: { params: { id: string } }) {
  return <EngagementDetail engagementId={params.id} />;
}
