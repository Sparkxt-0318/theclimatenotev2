/**
 * Article content model.
 *
 * The body is a typed block list rather than HTML. Blocks come straight out of
 * the author's .docx and are rendered natively on iOS and as HTML on the web,
 * which is what lets the reader use real text styles, real accessibility and
 * real text selection instead of a WebView.
 *
 * Nothing in this file is ever generated or rewritten by a model. AI output
 * lives alongside an article (summary, assets, reflection options), never
 * inside `body`.
 */

/** A run of text with optional emphasis. */
export type TextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Present when the run is a hyperlink. */
  href?: string;
};

export type ParagraphBlock = { type: 'paragraph'; runs: TextRun[] };
export type HeadingBlock = { type: 'heading'; level: 2 | 3; runs: TextRun[] };
export type QuoteBlock = { type: 'quote'; runs: TextRun[]; attribution?: string };
export type ListBlock = { type: 'list'; ordered: boolean; items: TextRun[][] };
export type DividerBlock = { type: 'divider' };

/** An image that was embedded in the source document by the author. */
export type EmbeddedImageBlock = {
  type: 'image';
  storagePath: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
};

export type ArticleBlock =
  | ParagraphBlock
  | HeadingBlock
  | QuoteBlock
  | ListBlock
  | DividerBlock
  | EmbeddedImageBlock;

export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived';

/** Where the AI-selected key image sits relative to the body. */
export type AssetPlacement = 'start' | 'middle';

export type AssetKind = 'cover' | 'figure' | 'embedded';

export type SocialPlatform = 'instagram' | 'substack' | 'medium' | 'youtube' | 'other';

export function plainText(runs: TextRun[]): string {
  return runs.map((run) => run.text).join('');
}

export function blockPlainText(block: ArticleBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
    case 'quote':
      return plainText(block.runs);
    case 'list':
      return block.items.map(plainText).join(' ');
    case 'image':
      return block.caption ?? '';
    case 'divider':
      return '';
  }
}

export function wordCount(blocks: ArticleBlock[]): number {
  return blocks
    .map(blockPlainText)
    .join(' ')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/** Full article text, used as the grounding context for every AI step. */
export function articleFullText(blocks: ArticleBlock[]): string {
  return blocks
    .map(blockPlainText)
    .filter((text) => text.length > 0)
    .join('\n\n');
}
