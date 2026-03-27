'use client';

import { Sidebar } from '@/components/sidebar';
import { AgentChat } from '@/components/agent-chat';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-950 scrollbar-thin">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
      <AgentChat />
    </div>
  );
}
