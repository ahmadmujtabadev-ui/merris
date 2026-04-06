import { DocumentViewer } from '@/components/document-viewer/document-viewer';

export default function Page({ params }: { params: { id: string; docId: string } }) {
  return <DocumentViewer engagementId={params.id} documentId={params.docId} />;
}
