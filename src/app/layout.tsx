import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'iPOST — Sifat nazorati KPI tizimi',
    template: '%s · iPOST OTK',
  },
  description:
    "iPOST Sifat nazorati (OTK) bo'limining kunlik reyestri, KPI hisobi, audit va quvvat tahlili — rahbariyat nazoratida.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
