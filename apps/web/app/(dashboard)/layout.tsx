import { MerrisSidebar } from '@/components/merris/sidebar';
import { MerrisTopBar } from '@/components/merris/top-bar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-merris-bg">
      <MerrisSidebar />
      <div className="ml-[210px] flex flex-1 flex-col min-w-0">
        <MerrisTopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
