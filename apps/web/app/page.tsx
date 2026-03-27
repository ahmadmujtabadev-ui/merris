'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex items-center gap-3">
        <span className="text-4xl" role="img" aria-label="leaf">
          🌿
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-100">Merris</h1>
      </div>
      <p className="max-w-md text-center text-lg text-zinc-400">
        AI co-pilot for ESG professionals. Streamline compliance, data collection, and reporting
        across global frameworks.
      </p>
      <div className="flex gap-4">
        <Link href="/login">
          <Button size="lg">Sign in</Button>
        </Link>
        <Link href="/register">
          <Button variant="outline" size="lg">
            Create account
          </Button>
        </Link>
      </div>
    </main>
  );
}
