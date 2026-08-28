/**
 * Article reads.
 *
 * Everything here works signed out — RLS exposes published articles to the
 * anonymous key — so no query in this file checks for a session.
 */

import { useQuery } from '@tanstack/react-query';

import { DEMO_ARTICLES, DEMO_FULL_ARTICLE, DEMO_MODE } from '@/demo';
import { supabase } from '@/lib/supabase';
import type { ArticleListItem, FullArticle } from './types';

export const articleKeys = {
  feed: ['articles', 'feed'] as const,
  detail: (slug: string) => ['articles', 'detail', slug] as const,
};

export function useArticleFeed() {
  return useQuery({
    queryKey: articleKeys.feed,
    queryFn: async (): Promise<ArticleListItem[]> => {
      if (DEMO_MODE) return DEMO_ARTICLES as ArticleListItem[];

      // Reads the view rather than joining client-side, so the feed is one
      // round trip instead of an N+1 over assets.
      const { data, error } = await supabase
        .from('published_articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as ArticleListItem[];
    },
    // A weekly publication does not need aggressive refetching.
    staleTime: 5 * 60 * 1000,
  });
}

export function useArticle(slug: string) {
  return useQuery({
    queryKey: articleKeys.detail(slug),
    queryFn: async (): Promise<FullArticle> => {
      if (DEMO_MODE) return DEMO_FULL_ARTICLE as unknown as FullArticle;

      const { data, error } = await supabase
        .from('articles')
        .select(
          `id, slug, issue_number, title, dek, published_at, reading_minutes, body_blocks,
           article_assets (id, kind, placement, storage_path, alt_text, credit, source_url,
                           license, blurhash, width, height),
           article_summaries (problem, why_it_matters, what_we_can_do, reading_grade),
           reflection_options (id, position, title, detail, factor_key, estimated_quantity, difficulty),
           article_links (platform, url, label)`,
        )
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (error) throw error;

      const row = data as unknown as FullArticle & {
        article_summaries: FullArticle['article_summaries'] | FullArticle['article_summaries'][];
      };

      // PostgREST returns a one-to-one embed as an object, but as an array when
      // it cannot prove uniqueness. Normalise so callers see one shape.
      const summary = Array.isArray(row.article_summaries)
        ? (row.article_summaries[0] ?? null)
        : row.article_summaries;

      return {
        ...row,
        article_summaries: summary,
        reflection_options: [...(row.reflection_options ?? [])].sort(
          (a, b) => a.position - b.position,
        ),
        cover_path: null,
        cover_alt: null,
        cover_blurhash: null,
        cover_credit: null,
      };
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** The key image, and where the pipeline decided it belongs. */
export function keyAsset(article: FullArticle) {
  return (
    article.article_assets.find((asset) => asset.kind === 'cover') ??
    article.article_assets.find((asset) => asset.kind === 'figure') ??
    null
  );
}
