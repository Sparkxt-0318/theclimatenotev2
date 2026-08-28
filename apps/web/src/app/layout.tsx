import type { Metadata } from 'next';
import Link from 'next/link';

import './globals.css';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'The Climate Note', template: '%s · The Climate Note' },
  description:
    'A weekly climate newsletter for people who are going to have to live with the consequences. Plain language, real numbers, and one thing you can actually do.',
  openGraph: {
    siteName: 'The Climate Note',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            borderBottom: '1px solid var(--border)',
            padding: '16px 0',
            marginBottom: 40,
          }}
        >
          <div
            className="container"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Link
              href="/"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text-primary)',
                textDecoration: 'none',
              }}
            >
              The Climate Note
            </Link>
            <nav style={{ display: 'flex', gap: 20, fontSize: 15 }}>
              <Link href="/read">Issues</Link>
              <Link href="/support">Support</Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer
          style={{
            borderTop: '1px solid var(--border)',
            marginTop: 80,
            padding: '32px 0 64px',
          }}
        >
          <div className="container">
            <nav style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 14 }}>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/support">Support</Link>
              <Link href="/delete-account">Delete your account</Link>
            </nav>
            <p className="small" style={{ marginTop: 16 }}>
              © {new Date().getFullYear()} The Climate Note
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
