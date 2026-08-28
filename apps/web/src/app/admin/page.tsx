import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdmin } from '@/lib/auth';
import { adminClient } from '@/lib/supabase';

import { RunIngestionButton } from './run-ingestion-button';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin' };

type ArticleRow = {
  id: string;
  title: string;
  status: string;
  issue_number: number | null;
  updated_at: string;
  article_summaries: { reading_grade: number | null }[] | { reading_grade: number | null } | null;
  reflection_options: { id: string }[];
  article_assets: { kind: string }[];
};

export default async function AdminPage() {
  await requireAdmin();
  const supabase = adminClient();

  const { data: articles } = await supabase
    .from('articles')
    .select(
      'id, title, status, issue_number, updated_at, article_summaries(reading_grade), reflection_options(id), article_assets(kind)',
    )
    .order('updated_at', { ascending: false })
    .limit(50);

  const { data: recentJobs } = await supabase
    .from('ingestion_jobs')
    .select('id, source_name, state, step, error, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  const rows = (articles ?? []) as unknown as ArticleRow[];
  const drafts = rows.filter((a) => a.status === 'draft');
  const live = rows.filter((a) => a.status === 'published');

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, margin: 0 }}>Editor</h1>
        <RunIngestionButton />
      </div>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
          WAITING FOR REVIEW ({drafts.length})
        </h2>

        {drafts.length === 0 ? (
          <p className="muted">Nothing waiting. Drop a document in the Drive folder.</p>
        ) : (
          drafts.map((article) => <ArticleCard key={article.id} article={article} />)
        )}
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
          PUBLISHED ({live.length})
        </h2>
        {live.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </section>

      {recentJobs && recentJobs.length > 0 ? (
        <section>
          <h2 style={{ fontSize: 14, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
            RECENT PIPELINE RUNS
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: 14 }}>
            {recentJobs.map((job) => (
              <li key={job.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <strong>{job.source_name ?? 'unknown file'}</strong> — {job.state}
                {job.state === 'running' ? ` (at ${job.step})` : ''}
                {job.error ? (
                  <p className="small" style={{ margin: '4px 0 0', color: 'var(--danger)' }}>
                    {job.error}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ArticleCard({ article }: { article: ArticleRow }) {
  const summaryRaw = article.article_summaries;
  const summary = Array.isArray(summaryRaw) ? summaryRaw[0] : summaryRaw;

  const optionCount = article.reflection_options?.length ?? 0;
  const hasImage = (article.article_assets ?? []).some(
    (a) => a.kind === 'cover' || a.kind === 'figure',
  );

  // Surface what the pipeline could NOT do, so a gap is obvious at a glance
  // rather than discovered by a reader.
  const warnings: string[] = [];
  if (!summary) warnings.push('no summary');
  if (optionCount < 3) warnings.push(`only ${optionCount}/3 reflection options`);
  if (!hasImage) warnings.push('no key image');
  if (summary?.reading_grade && summary.reading_grade > 9) {
    warnings.push(`summary reads at grade ${summary.reading_grade}`);
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Link
            href={`/admin/article/${article.id}`}
            style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none' }}
          >
            {article.issue_number ? `Issue ${article.issue_number} · ` : ''}
            {article.title}
          </Link>
          <p className="small" style={{ margin: '4px 0 0' }}>
            Updated {new Date(article.updated_at).toLocaleString()}
          </p>
        </div>
        <span
          className="small"
          style={{
            alignSelf: 'flex-start',
            padding: '4px 10px',
            borderRadius: 999,
            background: article.status === 'published' ? 'var(--brand-subtle)' : 'var(--surface-sunken)',
            color: article.status === 'published' ? 'var(--brand-on-subtle)' : 'var(--text-secondary)',
          }}
        >
          {article.status}
        </span>
      </div>

      {warnings.length > 0 ? (
        <p className="small" style={{ margin: '12px 0 0', color: 'var(--danger)' }}>
          Needs attention: {warnings.join(', ')}
        </p>
      ) : null}
    </div>
  );
}
