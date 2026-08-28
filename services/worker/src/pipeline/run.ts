/**
 * The ingestion pipeline.
 *
 * Runs as a resumable state machine per document. Each step records its result
 * before the next begins, so a failure halfway through does not redo the
 * expensive AI work that already succeeded — and re-running is always safe.
 *
 *   discover → extract → summarise → imagery → reflections → finalise
 *
 * Everything lands as a DRAFT. Nothing the model produced reaches a reader
 * until an editor has looked at it in the admin console.
 */

import { articleFullText, estimateReadingMinutes, wordCount } from '@climatenote/shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { buildFigure, chooseImage, planImagery } from '../ai/imagery';
import { AiClient } from '../ai/provider';
import { generateReflections } from '../ai/reflections';
import { generateSummary } from '../ai/summary';
import type { WorkerConfig } from '../config';
import {
  createDriveClient,
  downloadAsDocx,
  issueNumberFromName,
  listDocuments,
  slugify,
  type DriveFile,
} from '../drive/client';
import { contentChecksum, extractDocx } from '../extract/docx';
import { renderFigure } from '../images/figure';
import { searchLicensedImages } from '../images/search';
import { fetchImage, storeImage } from '../images/store';

export type RunSummary = {
  scanned: number;
  processed: number;
  skipped: number;
  failed: number;
  details: string[];
};

export async function runPipeline(config: WorkerConfig): Promise<RunSummary> {
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
  });
  const drive = createDriveClient(config);
  const ai = new AiClient(config);

  const summary: RunSummary = { scanned: 0, processed: 0, skipped: 0, failed: 0, details: [] };

  const files = await listDocuments(drive, config.driveFolderId);
  summary.scanned = files.length;
  log(`Found ${files.length} document(s) in the watched folder`);

  for (const file of files) {
    try {
      const outcome = await processDocument({ supabase, drive, ai, config, file });
      if (outcome.status === 'skipped') {
        summary.skipped += 1;
        summary.details.push(`skipped ${file.name}: ${outcome.reason}`);
      } else {
        summary.processed += 1;
        summary.details.push(`drafted ${file.name} as "${outcome.title}"`);
      }
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      summary.details.push(`failed ${file.name}: ${message}`);
      log(`FAILED ${file.name}: ${message}`);

      await supabase.from('ingestion_jobs').insert({
        source_file_id: file.id,
        source_name: file.name,
        state: 'failed',
        error: message.slice(0, 2000),
      });
    }
  }

  const usage = ai.usage;
  log(`Done. ${summary.processed} drafted, ${summary.skipped} skipped, ${summary.failed} failed.`);
  log(`Model usage: ~${usage.tokens} tokens on ${usage.model}`);

  return summary;
}

type Context = {
  supabase: SupabaseClient;
  drive: ReturnType<typeof createDriveClient>;
  ai: AiClient;
  config: WorkerConfig;
  file: DriveFile;
};

type Outcome = { status: 'drafted'; title: string } | { status: 'skipped'; reason: string };

async function processDocument(context: Context): Promise<Outcome> {
  const { supabase, drive, ai, file } = context;

  // ── extract ───────────────────────────────────────────────────────────────
  log(`Extracting ${file.name}`);
  const buffer = await downloadAsDocx(drive, file);
  const document = await extractDocx(buffer);
  const checksum = contentChecksum(document);

  const { data: existing } = await supabase
    .from('articles')
    .select('id, status, source_checksum')
    .eq('source_file_id', file.id)
    .maybeSingle();

  // Drive bumps modifiedTime when a document is merely opened, so the content
  // hash — not the timestamp — decides whether there is work to do.
  if (existing?.source_checksum === checksum) {
    return { status: 'skipped', reason: 'content unchanged since last run' };
  }

  // Never overwrite something already live. An editor republishing from Drive
  // should be a deliberate act, not a side effect of opening the file.
  if (existing && existing.status === 'published') {
    return { status: 'skipped', reason: 'already published; unpublish first to reingest' };
  }

  if (document.blocks.length === 0) {
    return { status: 'skipped', reason: 'document contained no readable text' };
  }

  const articleText = articleFullText(document.blocks);
  const words = wordCount(document.blocks);

  const { data: job } = await supabase
    .from('ingestion_jobs')
    .insert({
      source_file_id: file.id,
      source_name: file.name,
      state: 'running',
      step: 'extract',
    })
    .select('id')
    .single();

  const jobId = job?.id as string | undefined;
  const advance = async (step: string) => {
    if (jobId) await supabase.from('ingestion_jobs').update({ step }).eq('id', jobId);
  };

  // ── article row ───────────────────────────────────────────────────────────
  const articleId = await upsertArticle(supabase, {
    existingId: existing?.id as string | undefined,
    file,
    document,
    checksum,
    words,
  });

  // Embedded author images, uploaded and their placeholders rewritten.
  await storeEmbeddedImages(supabase, articleId, document, articleId);

  // ── summary ───────────────────────────────────────────────────────────────
  await advance('summarise');
  log('Generating plain-language summary');
  const summaryResult = await generateSummary(ai, articleText, document.title);

  await supabase.from('article_summaries').upsert({
    article_id: articleId,
    problem: summaryResult.summary.problem,
    why_it_matters: summaryResult.summary.whyItMatters,
    what_we_can_do: summaryResult.summary.whatWeCanDo,
    jargon_avoided: summaryResult.summary.jargonAvoided,
    reading_grade: summaryResult.readingGrade,
    model: ai.usage.model,
  });
  log(`Summary reads at US grade ${summaryResult.readingGrade} (${summaryResult.attempts} attempt(s))`);

  // ── imagery ───────────────────────────────────────────────────────────────
  await advance('imagery');
  await generateImagery(context, articleId, articleText, document.title);

  // ── reflections ───────────────────────────────────────────────────────────
  await advance('reflections');
  log('Generating reflection options');
  const reflections = await generateReflections(ai, articleText, document.title);

  await supabase.from('reflection_options').delete().eq('article_id', articleId);

  if (reflections.options.length > 0) {
    await supabase.from('reflection_options').insert(
      reflections.options.map((option, index) => ({
        article_id: articleId,
        position: index + 1,
        title: option.title,
        detail: option.detail,
        source_span: option.sourceSpan,
        factor_key: option.factorKey,
        estimated_quantity: option.estimatedQuantity,
        difficulty: option.difficulty,
        specificity_score: option.specificity,
        relevance_score: option.relevance,
      })),
    );
  }

  log(
    `Accepted ${reflections.options.length}/3 options after ${reflections.attempts} round(s); ` +
      `${reflections.rejections.length} rejected`,
  );

  // Report honestly rather than padding a short set with something weak. The
  // editor sees the gap and the reasons in the admin console.
  const note =
    reflections.options.length < 3
      ? `Only ${reflections.options.length} of 3 reflection options met the quality bar. Rejected: ${reflections.rejections.join(' | ')}`
      : null;

  if (jobId) {
    await supabase
      .from('ingestion_jobs')
      .update({ state: 'succeeded', step: 'done', article_id: articleId, error: note })
      .eq('id', jobId);
  }

  return { status: 'drafted', title: document.title };
}

async function upsertArticle(
  supabase: SupabaseClient,
  input: {
    existingId: string | undefined;
    file: DriveFile;
    document: Awaited<ReturnType<typeof extractDocx>>;
    checksum: string;
    words: number;
  },
): Promise<string> {
  const { existingId, file, document, checksum, words } = input;

  const row = {
    slug: slugify(document.title),
    issue_number: issueNumberFromName(file.name),
    title: document.title,
    dek: document.dek,
    status: 'draft' as const,
    body_blocks: document.blocks,
    source_file_id: file.id,
    source_modified_at: file.modifiedTime,
    source_checksum: checksum,
    word_count: words,
    reading_minutes: estimateReadingMinutes(words),
  };

  if (existingId) {
    const { error } = await supabase.from('articles').update(row).eq('id', existingId);
    if (error) throw new Error(`Could not update article: ${error.message}`);
    return existingId;
  }

  const { data, error } = await supabase.from('articles').insert(row).select('id').single();
  if (error) throw new Error(`Could not create article: ${error.message}`);
  return data.id as string;
}

/** Uploads images the author embedded, and rewrites their placeholder paths. */
async function storeEmbeddedImages(
  supabase: SupabaseClient,
  articleId: string,
  document: Awaited<ReturnType<typeof extractDocx>>,
  pathPrefix: string,
): Promise<void> {
  if (document.images.length === 0) return;

  const pathById = new Map<string, string>();

  for (const image of document.images) {
    const stored = await storeImage(supabase, image.buffer, `${pathPrefix}/${image.id}`);
    pathById.set(image.id, stored.storagePath);
  }

  const rewritten = document.blocks.map((block) =>
    block.type === 'image' && pathById.has(block.storagePath)
      ? { ...block, storagePath: pathById.get(block.storagePath) as string }
      : block,
  );

  await supabase.from('articles').update({ body_blocks: rewritten }).eq('id', articleId);
}

/** Runs the photo-or-figure decision and stores whatever it produces. */
async function generateImagery(
  context: Context,
  articleId: string,
  articleText: string,
  title: string,
): Promise<void> {
  const { supabase, ai, config } = context;

  const plan = await planImagery(ai, articleText, title);
  log(`Picture editor chose "${plan.kind}" at "${plan.placement}": ${plan.reasoning}`);

  await supabase.from('article_assets').delete().eq('article_id', articleId).in('kind', ['cover', 'figure']);

  if (plan.kind === 'photo') {
    const queries = plan.searchQueries.length > 0 ? plan.searchQueries : [title];
    const candidates = (
      await Promise.all(
        queries.map((query) =>
          searchLicensedImages(query, {
            unsplashKey: config.unsplashKey,
            pexelsKey: config.pexelsKey,
          }),
        ),
      )
    ).flat();

    const chosen = await chooseImage(ai, articleText, candidates);

    if (chosen) {
      const buffer = await fetchImage(chosen.image.url);
      const stored = await storeImage(supabase, buffer, `${articleId}/cover`);

      await supabase.from('article_assets').insert({
        article_id: articleId,
        kind: 'cover',
        placement: plan.placement,
        storage_path: stored.storagePath,
        alt_text: chosen.altText || plan.altText,
        credit: chosen.image.credit,
        source_url: chosen.image.sourceUrl,
        license: chosen.image.license,
        blurhash: stored.blurhash,
        width: stored.width,
        height: stored.height,
      });

      log(`Cover: ${chosen.image.credit} (${chosen.image.license})`);
      return;
    }

    // Nothing suitable found or the model rejected everything. Fall through to
    // a figure rather than running a photograph that does not fit.
    log('No suitable licensed photo found; falling back to a figure');
  }

  const figure = await buildFigure(ai, articleText, title);

  if ('error' in figure) {
    log(`No figure either: ${figure.error}. Publishing without a key image.`);
    return;
  }

  const rendered = await renderFigure(figure.spec);
  const stored = await storeImage(supabase, rendered.png, `${articleId}/figure`);

  await supabase.from('article_assets').insert({
    article_id: articleId,
    kind: 'figure',
    placement: plan.placement,
    storage_path: stored.storagePath,
    alt_text: plan.altText,
    // Our own rendering from the article's data, so the credit is the data's
    // origin. No source_url, so the attribution constraint does not apply.
    credit: figure.spec.dataSource,
    chart_spec: figure.spec,
    blurhash: stored.blurhash,
    width: stored.width,
    height: stored.height,
  });

  log(`Figure: "${figure.spec.title}"`);
}

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}
