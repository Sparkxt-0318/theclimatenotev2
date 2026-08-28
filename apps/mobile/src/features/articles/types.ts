import type { ArticleBlock, AssetPlacement } from '@climatenote/shared';

export type ArticleListItem = {
  id: string;
  slug: string;
  issue_number: number | null;
  title: string;
  dek: string | null;
  published_at: string;
  reading_minutes: number;
  cover_path: string | null;
  cover_alt: string | null;
  cover_blurhash: string | null;
  cover_credit: string | null;
};

export type ArticleAsset = {
  id: string;
  kind: 'cover' | 'figure' | 'embedded';
  placement: AssetPlacement | null;
  storage_path: string;
  alt_text: string;
  credit: string | null;
  source_url: string | null;
  license: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
};

export type ArticleSummary = {
  problem: string;
  why_it_matters: string;
  what_we_can_do: string[];
  reading_grade: number | null;
};

export type ReflectionOptionRow = {
  id: string;
  position: number;
  title: string;
  detail: string;
  factor_key: string;
  estimated_quantity: number;
  difficulty: string;
};

export type ArticleLink = {
  platform: 'instagram' | 'substack' | 'medium' | 'youtube' | 'other';
  url: string;
  label: string | null;
};

export type FullArticle = ArticleListItem & {
  body_blocks: ArticleBlock[];
  article_assets: ArticleAsset[];
  article_summaries: ArticleSummary | null;
  reflection_options: ReflectionOptionRow[];
  article_links: ArticleLink[];
};
