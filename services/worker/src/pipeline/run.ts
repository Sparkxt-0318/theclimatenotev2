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

  if (files.length === 0) {
    // Drive returns an empty list — not an error — for a folder the service
    // account cannot see. A misconfigured share and an empty folder look
    // identical, and the run exits green either way, so say so out loud.
    log(
      `If you expected documents here, check that folder ${config.driveFolderId} is ` +
        `shared with the service account's email address as a Viewer.`,
    );
  }

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

      // Update the row this attempt created rather than inserting another.
      // Inserting left the original stuck at 'running' forever and added two
      // junk rows every half hour, burying the real history in the admin
      // console within a day.
      await failJob(supabase, file, message);
    }
  }

  const usage = ai.usage;
  log(`Done. ${summary.processed} drafted, ${summary.skipped} skipped, ${summary.failed} failed.`);
  log(`Model usage: ~${usage.tokens} tokens on ${usage.model}`);

  return summary;
}

/**
 * Records a failed attempt against the open job for this file.
 *
 * `attempts` was declared in the schema and never incremented, so there was no
 * backoff and no dead-lettering: one unprocessable document failed the
 * scheduled run every thirty minutes indefinitely, which trains everyone to
 * ignore the failure email.
 */
async function failJob(supabase: SupabaseClient, file: DriveFile, message: string): Promise<void> {
  const { data: open } = await supabase
    .from('ingestion_jobs')
    .select('id, attempts')
    .eq('source_file_id', file.id)
    .in('state', ['running', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const attempts = ((open?.attempts as number | undefined) ?? 0) + 1;

  const row = {
    source_file_id: file.id,
    source_name: file.name,
    state: attempts >= MAX_ATTEMPTS ? ('skipped' as const) : ('failed' as const),
    error:
      attempts >= MAX_ATTEMPTS
        ? `Given up after ${attempts} attempts. Last error: ${message}`.slice(0, 2000)
        : message.slice(0, 2000),
    attempts,
  };

  if (open?.id) {
    await supabase.from('ingestion_jobs').update(row).eq('id', open.id);
  } else {
    await supabase.from('ingestion_jobs').insert(row);
  }
}

/** After this many failed attempts a document is left alone until it changes. */
const MAX_ATTEMPTS = 4;

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

  // Left alone after repeated failures, until the document itself changes.
  // Without this one unprocessable file fails the run forever.
  const { data: deadLettered } = await supabase
    .from('ingestion_jobs')
    .select('created_at, error')
    .eq('source_file_id', file.id)
    .eq('state', 'skipped')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (deadLettered && new Date(file.modifiedTime) <= new Date(deadLettered.created_at as string)) {
    return {
      status: 'skipped',
      reason: `given up after repeated failures; edit the document to retry (${deadLettered.error as string})`,
    };
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
  // NOTE the missing checksum. It is written only at the very end, once every
  // step has succeeded — see the finalise block below. Writing it here (as an
  // earlier version did) meant any later failure left the row marked "already
  // processed", so the skip guard above would skip it forever and the document
  // was stuck as a broken draft with no way to retry.
  const articleId = await upsertArticle(supabase, {
    existingId: existing?.id as string | undefined,
    file,
    document,
    words,
  });

  // Embedded author images, uploaded and their placeholders rewritten.
  await storeEmbeddedImages(supabase, articleId, document, articleId);

  // ── summary ───────────────────────────────────────────────────────────────
  await advance('summarise');
  log('Generating plain-language summary');
  const summaryResult = await generateSummary(ai, articleText, document.title);

  // Do not clobber an editor's corrections. The schema records
  // edited_by_admin precisely so regeneration can leave those alone.
  const { data: existingSummary } = await supabase
    .from('article_summaries')
    .select('edited_by_admin')
    .eq('article_id', articleId)
    .maybeSingle();

  if (existingSummary?.edited_by_admin) {
    log('Summary was edited by an admin; leaving it untouched.');
  } else {
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
  }

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

  // ── finalise ──────────────────────────────────────────────────────────────
  // Only now does the checksum go in. Everything above either succeeded or
  // threw, and a throw leaves the checksum unwritten so the next run picks the
  // document straight back up.
  await advance('finalise');
  const { error: checksumError } = await supabase
    .from('articles')
    .update({ source_checksum: checksum })
    .eq('id', articleId);

  if (checksumError) {
    // Not fatal: the article is complete and reviewable. It will simply be
    // reprocessed next run, which is wasteful but harmless.
    log(`Could not record the checksum for ${articleId}: ${checksumError.message}`);
  }

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
    words: number;
  },
): Promise<string> {
  const { existingId, file, document, words } = input;

  const baseSlug = slugify(document.title);
  const issueNumber = await availableIssueNumber(supabase, file, existingId);

  const row = {
    issue_number: issueNumber,
    title: document.title,
    dek: document.dek,
    status: 'draft' as const,
    body_blocks: document.blocks,
    source_file_id: file.id,
    source_modified_at: file.modifiedTime,
    word_count: words,
    reading_minutes: estimateReadingMinutes(words),
  };

  if (existingId) {
    const slug = await availableSlug(supabase, baseSlug, existingId);
    const { error } = await supabase
      .from('articles')
      .update({ ...row, slug })
      .eq('id', existingId);
    if (error) throw new Error(`Could not update article: ${error.message}`);
    return existingId;
  }

  const slug = await availableSlug(supabase, baseSlug, null);
  const { data, error } = await supabase
    .from('articles')
    .insert({ ...row, slug })
    .select('id')
    .single();

  if (error) throw new Error(`Could not create article: ${error.message}`);
  return data.id as string;
}

/**
 * A slug not already taken by a different article.
 *
 * `articles.slug` is unique, and slugs collide more easily than they look:
 * two drafts of the same piece, or any two titles that reduce to the same
 * ASCII. A title with no Latin characters at all reduces to the literal
 * "issue", so a Korean-language issue collides with every other one.
 *
 * A collision used to throw, which stalled that document forever and turned
 * the scheduled run permanently red. Suffixing is the boring correct answer.
 */
async function availableSlug(
  supabase: SupabaseClient,
  base: string,
  keepId: string | null,
): Promise<string> {
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;

    const { data } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!data || data.id === keepId) return candidate;
  }
  // Fall back to something guaranteed unique rather than failing the run.
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * The issue number parsed from the filename, or null if it is already taken.
 *
 * `issue_number` is unique, and the filename parser will read "2026" out of a
 * date-prefixed name like "2026-01-05 Cows.docx" — a normal editorial
 * convention that would make every issue that year collide. A missing issue
 * number is cosmetic; a failed ingest is not.
 */
async function availableIssueNumber(
  supabase: SupabaseClient,
  file: DriveFile,
  keepId: string | undefined,
): Promise<number | null> {
  const parsed = issueNumberFromName(file.name);
  if (parsed === null) return null;

  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('issue_number', parsed)
    .maybeSingle();

  if (!data || data.id === keepId) return parsed;

  log(`Issue number ${parsed} from "${file.name}" is already taken; leaving it unset.`);
  return null;
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
    try {
      const stored = await storeImage(supabase, image.buffer, `${pathPrefix}/${image.id}`);
      pathById.set(image.id, stored.storagePath);
    } catch (error) {
      // Word embeds EMF/WMF for anything pasted from Excel or PowerPoint —
      // charts, SmartArt, equations — and sharp cannot decode those. Dropping
      // one image is a small loss; failing the document over it used to lose
      // the whole issue.
      log(
        `Skipped an embedded image (${image.contentType}): ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const rewritten = document.blocks
    // Drop image blocks whose file could not be stored, rather than leaving a
    // block pointing at a placeholder path that will 404 in the app.
    .filter((block) => block.type !== 'image' || pathById.has(block.storagePath))
    .map((block) =>
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
