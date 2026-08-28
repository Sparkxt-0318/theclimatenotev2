import Link from 'next/link';

import { publicClient } from '@/lib/supabase';

export const revalidate = 300;

export default async function HomePage() {
  const supabase = publicClient();
  const { data: issues } = await supabase
    .from('published_articles')
    .select('slug, title, dek, published_at, issue_number, reading_minutes')
    // Explicit: a view's ORDER BY is not guaranteed to survive PostgREST
    // wrapping it in a subquery, and the homepage treats row 0 as "this week".
    .order('published_at', { ascending: false })
    .limit(4);

  const latest = issues?.[0];

  return (
    <div className="container">
      <section style={{ paddingBottom: 48 }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 44,
            lineHeight: 1.15,
            margin: '0 0 16px',
            maxWidth: '16ch',
          }}
        >
          Climate, explained like you have somewhere to be.
        </h1>

        <p className="muted" style={{ fontSize: 19, maxWidth: '46ch', margin: '0 0 28px' }}>
          One issue a week. Plain language, real numbers, and one specific thing
          you can actually do about it.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {latest ? (
            <Link className="button" href={`/read/${latest.slug}`}>
              Read this week&rsquo;s issue
            </Link>
          ) : null}
          <Link className="button button--secondary" href="/read">
            Browse the archive
          </Link>
        </div>
      </section>

      {issues && issues.length > 0 ? (
        <section>
          <h2 style={{ fontSize: 14, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
            RECENT ISSUES
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {issues.map((issue) => (
              <li key={issue.slug} style={{ borderTop: '1px solid var(--border)', padding: '20px 0' }}>
                <Link
                  href={`/read/${issue.slug}`}
                  style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                >
                  <p className="small" style={{ margin: '0 0 4px' }}>
                    {new Date(issue.published_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    · {issue.reading_minutes} min read
                  </p>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '0 0 6px' }}>
                    {issue.title}
                  </h3>
                  {issue.dek ? (
                    <p className="muted" style={{ margin: 0, fontSize: 16 }}>
                      {issue.dek}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="muted">The first issue is on its way.</p>
      )}
    </div>
  );
}
