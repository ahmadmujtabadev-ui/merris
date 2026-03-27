import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Merris - ESG Platform',
  description: 'AI co-pilot for ESG professionals',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
