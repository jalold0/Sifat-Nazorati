import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'iPOST — Sifat nazorati',
    template: '%s · iPOST OTK',
  },
  description:
    "iPOST Sifat nazorati bo'limi: bo'limlar tekshiruvi, topshiriqlar va svetofor paneli.",
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
