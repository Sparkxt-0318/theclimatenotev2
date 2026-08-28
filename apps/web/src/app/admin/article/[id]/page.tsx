import type { ArticleBlock } from '@climatenote/shared';
import { articleFullText, getFactor } from '@climatenote/shared';
import { notFound } from 'next/navigation';

import { ArticleBlocks } from '@/components/article-blocks';
import { requireAdmin } from '@/lib/auth';
import { adminClient, imageUrl } from '@/lib/supabase';

import { ArticleControls, LinkEditor, OptionEditor, SummaryEditor } from './editors';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * The review screen.
 *
 * Everything the pipeline produced, next to the article it came from, so an
 * editor can check the AI's work rather than trust it. Each reflection option
 * shows the sentence it claims to be grounded in and the score the grader gave
 * it — the two things that reveal a weak option at a glance.
 */
export default async function ReviewPage({ params }: Params) {
  await requireAdmin();
  const { id } = await params;

  const supabase = adminClient();
  const { data: article } = await supabase
    .from('articles')
    .select(
      `id, slug, title, dek, status, issue_number, published_at, body_blocks, word_count,
       reading_minutes, source_file_id,
       article_summaries (problem, why_it_matters, what_we_can_do, reading_grade, edited_by_admin),
       reflection_options (id, position, title, detail, source_span, factor_key,
                           estimated_quantity, specificity_score, relevance_score),
       article_assets (id, kind, placement, storage_path, alt_text, credit, source_url, license, chart_spec),
       article_links (platform, url, label)`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!article) notFound();

  const summaryRaw = article.article_summaries;
  const summary = (Array.isArray(summaryRaw) ? summaryRaw[0] : summaryRaw) as
    | {
        problem: string;
        why_it_matters: string;
        what_we_can_do: string[];
        reading_grade: number | null;
        edited_by_admin: boolean;
      }
    | null
    | undefined;

  const options = ((article.reflection_options ?? []) as {
    id: string;
    position: number;
    title: string;
    detail: string;
    source_span: string;
    factor_key: string;
    estimated_quantity: number;
    specificity_score: number | null;
    relevance_score: number | null;
  }[]).sort((a, b) => a.position - b.position);

  const assets = (article.article_assets ?? []) as {
    id: string;
    kind: string;
    placement: string | null;
    storage_path: string;
    alt_text: string;
    credit: string | null;
    source_url: string | null;
    license: string | null;
    chart_spec: unknown;
  }[];

  const links = (article.article_links ?? []) as {
    platform: string;
    url: string;
    label: string | null;
  }[];

  const bodyText = articleFullText(article.body_blocks as ArticleBlock[]);

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <p className="small">
        <a href="/admin">← Back to the queue</a>
      </p>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, margin: '0 0 4px' }}>
        {article.title as string}
      </h1>
      <p className="small">
        {article.status as string} · {article.word_count as number} words ·{' '}
        {article.reading_minutes as number} min read
      </p>

      <ArticleControls
        articleId={article.id as string}
        status={article.status as string}
        slug={article.slug as string}
      />

      {/* ── Key image ───────────────────────────────────────────────────── */}
      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 18 }}>Key image</h2>
        {assets.length === 0 ? (
          <p className="muted">
            The pipeline could not find a suitable licensed photo or build a
            verifiable figure, so this issue has no key image.
          </p>
        ) : (
          assets.map((asset) => (
            <div key={asset.id} className="card" style={{ marginBottom: 12 }}>
              <img
                src={imageUrl(asset.storage_path)}
                alt={asset.alt_text}
                style={{ width: '100%', borderRadius: 12, marginBottom: 12 }}
              />
              <p className="small" style={{ margin: 0 }}>
                <strong>{asset.kind}</strong> at {asset.placement ?? 'start'} ·{' '}
                {asset.chart_spec
                  ? 'rendered by us from the article’s own numbers'
                  : `${asset.credit ?? 'NO CREDIT'} · ${asset.license ?? 'NO LICENCE'}`}
              </p>
              <p className="small" style={{ margin: '4px 0 0' }}>
                Alt text: {asset.alt_text}
              </p>
              {asset.source_url ? (
                <p className="small" style={{ margin: '4px 0 0' }}>
                  <a href={asset.source_url} rel="noopener noreferrer">
                    Check the original and its licence
                  </a>
                </p>
              ) : null}
            </div>
          ))
        )}
      </section>

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 18 }}>
          Plain-language summary{' '}
          {summary?.reading_grade ? (
            <span
              className="small"
              style={{ color: summary.reading_grade > 9 ? '#b4553c' : 'var(--brand)' }}
            >
              reads at US grade {summary.reading_grade}
              {summary.reading_grade > 9 ? ' — above target' : ''}
            </span>
          ) : null}
        </h2>

        {summary ? (
          <SummaryEditor articleId={article.id as string} summary={summary} />
        ) : (
          <p className="muted">No summary was generated.</p>
        )}
      </section>

      {/* ── Reflection options ──────────────────────────────────────────── */}
      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 18 }}>
          Reflection options{' '}
          <span className="small" style={{ color: options.length < 3 ? '#b4553c' : undefined }}>
            {options.length}/3
          </span>
        </h2>

        {options.length < 3 ? (
          <p className="small" style={{ color: '#b4553c' }}>
            Fewer than three options met the quality bar. Rather than padding the
            set with something vague, the pipeline stopped — write the missing
            one yourself, or re-run after editing the article.
          </p>
        ) : null}

        {options.map((option) => {
          const factor = getFactor(option.factor_key);
          // The grounding check: does the quoted sentence really appear?
          const grounded = bodyText
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .includes(option.source_span.toLowerCase().replace(/\s+/g, ' ').slice(0, 40));

          return (
            <div key={option.id} className="card" style={{ marginBottom: 12 }}>
              <OptionEditor option={option} />

              <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

              <p className="small" style={{ margin: '0 0 6px' }}>
                <strong>Grounded in:</strong>{' '}
                <span style={{ color: grounded ? 'var(--text-secondary)' : '#b4553c' }}>
                  “{option.source_span}”
                  {grounded ? '' : ' — NOT FOUND IN THE ARTICLE'}
                </span>
              </p>
              <p className="small" style={{ margin: 0 }}>
                <strong>Measured as:</strong> {factor?.label ?? option.factor_key} ×{' '}
                {option.estimated_quantity} ={' '}
                {factor ? (factor.kgCo2ePerUnit * option.estimated_quantity).toFixed(1) : '?'} kg CO₂e
                {' · '}
                <strong>Graded:</strong> specificity {option.specificity_score ?? '?'}/5, relevance{' '}
                {option.relevance_score ?? '?'}/5
              </p>
            </div>
          );
        })}
      </section>

      {/* ── Cross-posting links ─────────────────────────────────────────── */}
      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 18 }}>Also published on</h2>
        <p className="small">
          Paste the link once this issue is live elsewhere. These appear at the
          end of the article in the app and on the website.
        </p>
        <LinkEditor articleId={article.id as string} links={links} />
      </section>

      {/* ── The article itself ──────────────────────────────────────────── */}
      <section style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 18 }}>The article, as extracted</h2>
        <p className="small">
          Copied verbatim from the source document. If something looks wrong here,
          fix it in Drive and re-run — do not patch it in the database.
        </p>
        <ArticleBlocks blocks={article.body_blocks as ArticleBlock[]} />
      </section>
    </div>
  );
}
