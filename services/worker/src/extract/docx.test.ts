import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { articleFullText, wordCount, type ArticleBlock } from '@climatenote/shared';

import { contentChecksum, extractDocx, type ExtractedDocument } from './docx';

/**
 * Runs against a real .docx produced by Word's own format, not a hand-written
 * HTML string. The failure mode this guards against is the extractor quietly
 * dropping or mangling the author's text, which is the one thing in the
 * pipeline that must survive untouched.
 */

const FIXTURE = join(import.meta.dirname, 'fixtures/sample-issue.docx');

let cached: ExtractedDocument | null = null;
async function fixture(): Promise<ExtractedDocument> {
  cached ??= await extractDocx(readFileSync(FIXTURE));
  return cached;
}

describe('docx extraction', () => {
  it('reads the title from the document Title style', async () => {
    const doc = await fixture();
    assert.equal(doc.title, 'The cows in the room');
  });

  it('reads the standfirst from the Subtitle style', async () => {
    const doc = await fixture();
    assert.ok(doc.dek?.includes('Livestock takes up most'), doc.dek ?? 'null');
  });

  it('does not repeat the title as a body block', async () => {
    const doc = await fixture();
    const text = articleFullText(doc.blocks);
    assert.ok(!text.startsWith('The cows in the room'));
  });

  it('preserves the author text verbatim', async () => {
    // The whole promise of the pipeline: the article is copied, not rewritten.
    const doc = await fixture();
    const text = articleFullText(doc.blocks);
    assert.ok(text.includes('Cattle farming is the single largest agricultural source of methane'));
    assert.ok(text.includes('99 kilograms'));
    assert.ok(text.includes('77% of global farmland'));
    assert.ok(text.includes('delivers most of the available benefit'));
  });

  it('keeps headings as headings', async () => {
    const doc = await fixture();
    const headings = doc.blocks.filter((b): b is Extract<ArticleBlock, { type: 'heading' }> =>
      b.type === 'heading',
    );
    const texts = headings.map((h) => h.runs.map((r) => r.text).join(''));
    assert.ok(texts.includes('What the numbers say'), texts.join(' | '));
    assert.ok(texts.includes('Where the leverage is'), texts.join(' | '));
  });

  it('keeps bold and italic runs', async () => {
    const doc = await fixture();
    const runs = doc.blocks.flatMap((b) => (b.type === 'paragraph' ? b.runs : []));
    assert.ok(runs.some((r) => r.bold && r.text.includes('99 kilograms')));
    assert.ok(runs.some((r) => r.italic && r.text.includes('scale')));
  });

  it('keeps a pull quote as a quote, not a paragraph', async () => {
    const doc = await fixture();
    const quotes = doc.blocks.filter((b) => b.type === 'quote');
    assert.equal(quotes.length, 1);
    assert.ok(articleFullText(quotes).includes('77% of global farmland'));
  });

  it('keeps a bulleted list as one list block', async () => {
    const doc = await fixture();
    const lists = doc.blocks.filter((b): b is Extract<ArticleBlock, { type: 'list' }> =>
      b.type === 'list',
    );
    assert.equal(lists.length, 1);
    assert.equal(lists[0]?.items.length, 3);
    assert.equal(lists[0]?.ordered, false);
  });

  it('drops the empty spacer paragraphs Word litters documents with', async () => {
    const doc = await fixture();
    const empty = doc.blocks.filter(
      (b) => b.type === 'paragraph' && b.runs.every((r) => r.text.trim() === ''),
    );
    assert.equal(empty.length, 0);
  });

  it('decodes typographic characters rather than leaving entities', async () => {
    const doc = await fixture();
    const text = articleFullText(doc.blocks) + (doc.dek ?? '');
    assert.ok(!text.includes('&'), 'undecoded HTML entity survived');
    assert.ok(text.includes('world’s'), 'curly apostrophe was lost');
  });

  it('counts words for the reading estimate', async () => {
    const doc = await fixture();
    assert.ok(wordCount(doc.blocks) > 80, `only counted ${wordCount(doc.blocks)}`);
  });
});

describe('content checksum', () => {
  it('is stable across repeated extraction', async () => {
    const a = await extractDocx(readFileSync(FIXTURE));
    const b = await extractDocx(readFileSync(FIXTURE));
    // Drive touches modifiedTime when a document is merely opened. Without a
    // content hash the pipeline would regenerate everything, burning credits
    // to produce identical output.
    assert.equal(contentChecksum(a), contentChecksum(b));
  });

  it('changes when the text changes', async () => {
    const doc = await fixture();
    const edited: ExtractedDocument = {
      ...doc,
      blocks: [...doc.blocks, { type: 'paragraph', runs: [{ text: 'A new closing line.' }] }],
    };
    assert.notEqual(contentChecksum(doc), contentChecksum(edited));
  });

  it('changes when only the title changes', async () => {
    const doc = await fixture();
    assert.notEqual(contentChecksum(doc), contentChecksum({ ...doc, title: 'Something else' }));
  });
});
