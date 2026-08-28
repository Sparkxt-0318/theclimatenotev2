import type { ArticleBlock } from '@climatenote/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArticleBlocks } from '@/components/article-blocks';
import { imageUrl, publicClient } from '@/lib/supabase';

export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

const SELECT = `id, slug, title, dek, published_at, issue_number, reading_minutes, body_blocks,
  article_assets (kind, placement, storage_path, alt_text, credit, source_url, license),
  article_summaries (problem, why_it_matters, what_we_can_do),
  article_links (platform, url, label)`;

async function loadArticle(slug: string) {
  const supabase = publicClient();
  const { data } = await supabase
    .from('articles')
    .select(SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadArticle(slug);
  if (!article) return { title: 'Not found' };

  const cover = (article.article_assets ?? []).find(
    (a: { kind: string }) => a.kind === 'cover' || a.kind === 'figure',
  );

  return {
    title: article.title as string,
    description: (article.dek as string | null) ?? undefined,
    openGraph: {
      title: article.title as string,
      description: (article.dek as string | null) ?? undefined,
      type: 'article',
      publishedTime: article.published_at as string,
      images: cover ? [imageUrl(cover.storage_path as string)] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const article = await loadArticle(slug);
  if (!article) notFound();

  const assets = (article.article_assets ?? []) as {
    kind: string;
    storage_path: string;
    alt_text: string;
    credit: string | null;
  }[];
  const cover = assets.find((a) => a.kind === 'cover') ?? assets.find((a) => a.kind === 'figure');

  const summaryRaw = article.article_summaries;
  const summary = (Array.isArray(summaryRaw) ? summaryRaw[0] : summaryRaw) as
    | { problem: string; why_it_matters: string; what_we_can_do: string[] }
    | null
    | undefined;

  const links = (article.article_links ?? []) as { platform: string; url: string; label: string | null }[];

  return (
    <article className="container">
      <header style={{ marginBottom: 32 }}>
        {article.issue_number ? (
          <p
            className="small"
            style={{ color: 'var(--brand)', letterSpacing: '0.06em', margin: '0 0 8px' }}
          >
            ISSUE {article.issue_number as number}
          </p>
        ) : null}

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 40, lineHeight: 1.2, margin: '0 0 12px' }}>
          {article.title as string}
        </h1>

        {article.dek ? (
          <p className="muted" style={{ fontSize: 20, fontFamily: 'var(--font-serif)', margin: '0 0 12px' }}>
            {article.dek as string}
          </p>
        ) : null}

        <p className="small" style={{ margin: 0 }}>
          {new Date(article.published_at as string).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}{' '}
          · {article.reading_minutes as number} min read
        </p>
      </header>

      {cover ? (
        <figure style={{ margin: '0 0 40px' }}>
          <img
            src={imageUrl(cover.storage_path)}
            alt={cover.alt_text}
            style={{ width: '100%', borderRadius: 'var(--radius)' }}
          />
          {cover.credit ? (
            <figcaption className="small" style={{ marginTop: 8 }}>
              Image: {cover.credit}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <ArticleBlocks blocks={article.body_blocks as ArticleBlock[]} />

      {summary ? (
        <aside
          style={{
            background: 'var(--brand-subtle)',
            borderRadius: 'var(--radius)',
            padding: 24,
            marginTop: 56,
          }}
        >
          <p
            style={{
              color: 'var(--brand-on-subtle)',
              fontSize: 12,
              letterSpacing: '0.06em',
              fontWeight: 600,
              margin: '0 0 16px',
            }}
          >
            THE SHORT VERSION
          </p>

          <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>What is going wrong</h2>
          <p style={{ margin: '0 0 16px' }}>{summary.problem}</p>

          <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Why it matters</h2>
          <p style={{ margin: '0 0 16px' }}>{summary.why_it_matters}</p>

          <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>What can be done</h2>
          <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
            {summary.what_we_can_do.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>

          <p className="small" style={{ marginTop: 20, marginBottom: 0 }}>
            Summarised by AI from the article above and checked by an editor. The
            article itself is written by a person.
          </p>
        </aside>
      ) : null}

      <section style={{ marginTop: 48, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '0 0 8px' }}>
          Write your climate note
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Pick one specific thing to try this week, and track how it adds up. The
          reflection prompts and your impact calendar live in the app.
        </p>
        <a className="button" href="https://apps.apple.com/app/the-climate-note">
          Get the app
        </a>
      </section>

      {links.length > 0 ? (
        <section style={{ marginTop: 40 }}>
          <p className="small" style={{ letterSpacing: '0.06em' }}>ALSO PUBLISHED ON</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {links.map((link) => (
              <a key={link.platform} href={link.url} rel="noopener noreferrer" style={{ fontSize: 15 }}>
                {link.label ?? link.platform}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
