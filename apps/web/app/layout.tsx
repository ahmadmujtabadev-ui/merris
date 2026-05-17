import './globals.css';
import type { Metadata } from 'next';
import { Manrope, Inter, Instrument_Serif } from 'next/font/google';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Merris — ESG Intelligence',
  description: 'AI co-pilot for ESG professionals',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} ${instrumentSerif.variable}`}>
      <body className="font-body bg-merris-bg text-merris-text antialiased">
        {children}
      </body>
    </html>
  );
}
