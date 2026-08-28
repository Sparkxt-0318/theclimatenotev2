/**
 * .docx → typed article blocks.
 *
 * The author's words pass through unchanged. Mammoth converts the document to
 * semantic HTML using an explicit style map, and this module turns that HTML
 * into the block list the apps render. No model is involved at any point in
 * this file, by design: the article is the one thing in the pipeline that AI
 * does not touch.
 */

import type { ArticleBlock, TextRun } from '@climatenote/shared';
import mammoth from 'mammoth';

export type ExtractedDocument = {
  title: string;
  dek: string | null;
  blocks: ArticleBlock[];
  /** Images embedded by the author, keyed by the placeholder id in the blocks. */
  images: { id: string; contentType: string; buffer: Buffer }[];
  warnings: string[];
};

/**
 * Word styles we understand. Anything unmapped falls through to a paragraph,
 * which is the safe default — losing a heading level is recoverable, losing the
 * text is not.
 */
const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => p.dek:fresh",
  "p[style-name='Heading 1'] => h2:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  'b => strong',
  'i => em',
];

export async function extractDocx(buffer: Buffer): Promise<ExtractedDocument> {
  const images: ExtractedDocument['images'] = [];
  let imageIndex = 0;

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: STYLE_MAP,
      convertImage: mammoth.images.imgElement(async (image) => {
        const id = `embedded-${imageIndex++}`;
        const buf = await image.read();
        images.push({
          id,
          contentType: image.contentType ?? 'image/png',
          buffer: Buffer.from(buf),
        });
        // The src is a placeholder; the pipeline swaps it for a storage path
        // once the image has been uploaded.
        // mammoth's Image type omits altText, though Word supplies it for
        // images that have one. Read it defensively rather than casting.
        const altText = (image as { altText?: string }).altText ?? '';
        return { src: `climatenote://${id}`, alt: altText };
      }),
    },
  );

  const parsed = parseHtml(result.value);

  return {
    ...parsed,
    images,
    warnings: result.messages.map((message) => message.message),
  };
}

// ── A small, deliberate HTML reader ─────────────────────────────────────────
//
// Mammoth's output is a narrow, predictable subset — headings, paragraphs,
// lists, blockquotes, and inline strong/em/a. A full DOM parser would be a
// heavyweight dependency for a grammar this small, so this walks the tags we
// actually emit and ignores everything else.

type ParsedBody = { title: string; dek: string | null; blocks: ArticleBlock[] };

const BLOCK_PATTERN =
  /<(h1|h2|h3|p|blockquote|ul|ol)(\s[^>]*)?>([\s\S]*?)<\/\1>|<(hr)\s*\/?>/gi;

function parseHtml(html: string): ParsedBody {
  const blocks: ArticleBlock[] = [];
  let title = '';
  let dek: string | null = null;

  for (const match of html.matchAll(BLOCK_PATTERN)) {
    const tag = (match[1] ?? match[4] ?? '').toLowerCase();
    const attributes = match[2] ?? '';
    const inner = match[3] ?? '';

    if (tag === 'hr') {
      blocks.push({ type: 'divider' });
      continue;
    }

    // The document's own Title style names the article. Falling back to the
    // first heading means an author who did not use the style still gets a
    // sensible title rather than an empty one.
    if (tag === 'h1' && !title) {
      title = plainText(inner);
      continue;
    }

    if (tag === 'p' && attributes.includes('dek') && !dek) {
      dek = plainText(inner);
      continue;
    }

    if (tag === 'h2' || tag === 'h3') {
      blocks.push({ type: 'heading', level: tag === 'h2' ? 2 : 3, runs: parseRuns(inner) });
      continue;
    }

    if (tag === 'blockquote') {
      // Mammoth wraps blockquote contents in a paragraph.
      const stripped = inner.replace(/<\/?p[^>]*>/gi, '');
      blocks.push({ type: 'quote', runs: parseRuns(stripped) });
      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = [...inner.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi)].map((item) =>
        parseRuns(item[1] ?? ''),
      );
      if (items.length > 0) blocks.push({ type: 'list', ordered: tag === 'ol', items });
      continue;
    }

    if (tag === 'p') {
      const image = /<img[^>]+src="climatenote:\/\/([^"]+)"[^>]*>/i.exec(inner);
      if (image?.[1]) {
        const alt = /alt="([^"]*)"/i.exec(inner)?.[1] ?? '';
        blocks.push({ type: 'image', storagePath: image[1], alt });
        continue;
      }

      const runs = parseRuns(inner);
      // Word documents are full of empty paragraphs used as spacing. They are
      // not content and would render as gaps of nothing.
      if (runs.some((run) => run.text.trim().length > 0)) {
        blocks.push({ type: 'paragraph', runs });
      }
    }
  }

  if (!title) {
    const firstHeading = blocks.find((block) => block.type === 'heading');
    if (firstHeading?.type === 'heading') {
      title = firstHeading.runs.map((run) => run.text).join('');
      blocks.splice(blocks.indexOf(firstHeading), 1);
    }
  }

  return { title: title || 'Untitled issue', dek, blocks };
}

/** Splits inline HTML into styled runs, preserving bold, italics and links. */
function parseRuns(html: string): TextRun[] {
  const runs: TextRun[] = [];
  const pattern = /<(strong|b|em|i|a)(\s[^>]*)?>([\s\S]*?)<\/\1>|([^<]+)/gi;

  for (const match of html.matchAll(pattern)) {
    const tag = match[1]?.toLowerCase();
    const attributes = match[2] ?? '';
    const inner = match[3];
    const plain = match[4];

    if (plain !== undefined) {
      const text = decodeEntities(plain);
      if (text.length > 0) runs.push({ text });
      continue;
    }
    if (inner === undefined) continue;

    // Nested inline markup is rare in Word output; take the text and apply the
    // outer style rather than building a tree for a case that barely occurs.
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ''));
    if (text.length === 0) continue;

    if (tag === 'strong' || tag === 'b') runs.push({ text, bold: true });
    else if (tag === 'em' || tag === 'i') runs.push({ text, italic: true });
    else if (tag === 'a') {
      const href = /href="([^"]*)"/i.exec(attributes)?.[1];
      runs.push(href ? { text, href: decodeEntities(href) } : { text });
    } else runs.push({ text });
  }

  return runs;
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

/**
 * A stable fingerprint of the extracted content.
 *
 * Drive updates modifiedTime when a document is merely opened, so re-running
 * on every change would burn AI credits regenerating identical output. This
 * hashes what we actually care about instead.
 */
export function contentChecksum(document: ExtractedDocument): string {
  const canonical = JSON.stringify({
    title: document.title,
    dek: document.dek,
    blocks: document.blocks,
  });

  // FNV-1a: not cryptographic, but this is change detection, not security.
  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
