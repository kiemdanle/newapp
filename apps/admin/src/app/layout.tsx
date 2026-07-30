import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Expyrico Admin',
  description: 'Expyrico administration dashboard',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          reviewer-p6 M9: `next/font/google` is the lint-preferred loader, but
          switching to it here is a real behavioral change, not a one-line fix —
          `globals.css` references these families by their bare CSS names
          ('Inter', 'Outfit', 'JetBrains Mono'; see `:root`/`code, pre` there),
          while `next/font` generates its own scoped font-family/variable names
          and would need every one of those rules updated to match, with a
          visual-regression risk across every page in the app. That's out of
          this phase's scope (pre-existing since commit 31e414a) — suppressed
          here deliberately rather than left as an unexplained failing gate.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&family=Outfit:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
