'use client';

import './globals.css';
import { useAuthStore } from '@/lib/store';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = useAuthStore((s) => s.locale);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className="dark">
      <head>
        <title>Merris &mdash; ESG Platform</title>
        <meta name="description" content="AI co-pilot for ESG professionals" />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-200 antialiased">{children}</body>
    </html>
  );
}
