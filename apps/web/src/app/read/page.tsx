import type { Metadata } from 'next';
import Link from 'next/link';

import { publicClient } from '@/lib/supabase';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Issues' };

export default async function ArchivePage() {
  const supabase = publicClient();
  const { data: issues, error } = await supabase
    .from('published_articles')
    .select('slug, title, dek, published_at, issue_number, reading_minutes')
    // Explicit: a view's ORDER BY is not guaranteed to survive PostgREST
    // wrapping it in a subquery, and the homepage treats row 0 as "this week".
    .order('published_at', { ascending: false })
    .limit(100);

  // Surfaced rather than swallowed: an RLS denial or a missing grant would
  // otherwise render as "nothing published yet" with nothing logged anywhere.
  if (error) console.error(`[archive] could not load articles: ${error.message}`);

  return (
    <div className="container">
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, marginBottom: 32 }}>
        Every issue
      </h1>

      {!issues || issues.length === 0 ? (
        <p className="muted">Nothing published yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {issues.map((issue) => (
            <li key={issue.slug} style={{ borderTop: '1px solid var(--border)', padding: '20px 0' }}>
              <Link
                href={`/read/${issue.slug}`}
                style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
              >
                <p className="small" style={{ margin: '0 0 4px' }}>
                  {issue.issue_number ? `Issue ${issue.issue_number} · ` : ''}
                  {new Date(issue.published_at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '0 0 6px' }}>
                  {issue.title}
                </h2>
                {issue.dek ? (
                  <p className="muted" style={{ margin: 0, fontSize: 16 }}>
                    {issue.dek}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
