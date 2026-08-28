/**
 * Runs the AI pipeline on one document and prints what it produced.
 *
 *   pnpm --filter @climatenote/worker dry-run [path/to/article.docx]
 *
 * The point of this command is to answer "is the AI actually working" with
 * something you can read, rather than a claim. It runs the REAL extraction,
 * summary, imagery and reflection code — the same functions the scheduled
 * pipeline calls — and writes nothing anywhere.
 *
 * It needs one API key and nothing else. No Supabase, no Google Drive, no
 * OpenAI: a free Gemini key from aistudio.google.com/apikey is enough.
 *
 *   GEMINI_API_KEY=... pnpm --filter @climatenote/worker dry-run
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { articleFullText, checkReflectionSet, getFactor, wordCount } from '@climatenote/shared';

import { buildFigure, planImagery } from './ai/imagery';
import { AiClient } from './ai/provider';
import { generateReflections } from './ai/reflections';
import { generateSummary } from './ai/summary';
import { loadConfig, type WorkerConfig } from './config';
import { extractDocx } from './extract/docx';
import { figureIsPlausible, renderFigure } from './images/figure';
import { searchLicensedImages } from './images/search';

const DEFAULT_FIXTURE = join(import.meta.dirname, 'extract/fixtures/sample-issue.docx');

// ── Presentation ────────────────────────────────────────────────────────────

const line = (char = '─') => console.log(char.repeat(72));

function heading(step: number, title: string): void {
  console.log('');
  line();
  console.log(`  ${step}. ${title.toUpperCase()}`);
  line();
}

/** Wraps prose so a paragraph is readable in a terminal. */
function wrap(text: string, indent = '  '): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = indent;

  for (const word of words) {
    if (current.length + word.length + 1 > 74) {
      lines.push(current);
      current = indent + word;
    } else {
      current += (current === indent ? '' : ' ') + word;
    }
  }
  lines.push(current);
  return lines.join('\n');
}

// ── The run ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const path = process.argv[2] ?? DEFAULT_FIXTURE;

  // Only the AI provider is needed; stub the rest so loadConfig's checks for
  // Supabase and Drive do not block a run that touches neither.
  const config = loadDryRunConfig();
  const ai = new AiClient(config);

  console.log('');
  console.log('  The Climate Note — AI dry run');
  console.log(`  provider: ${ai.provider}   model: ${ai.model}`);
  console.log(`  document: ${path}`);
  console.log('  Nothing is written to any database.');

  // ── 1. Extraction ─────────────────────────────────────────────────────────
  heading(1, 'Reading the document');
  const document = await extractDocx(readFileSync(path));
  const articleText = articleFullText(document.blocks);
  const words = wordCount(document.blocks);

  console.log(`  title:  ${document.title}`);
  console.log(`  dek:    ${document.dek ?? '(none)'}`);
  console.log(`  ${words} words, ${document.blocks.length} blocks, ${document.images.length} embedded image(s)`);
  if (document.warnings.length > 0) {
    console.log(`  warnings: ${document.warnings.slice(0, 3).join('; ')}`);
  }

  // ── 2. Summary ────────────────────────────────────────────────────────────
  heading(2, 'Plain-language summary');
  const summary = await generateSummary(ai, articleText, document.title);

  console.log(`  reading grade: US ${summary.readingGrade} (target 9 or below)`);
  console.log(`  attempts: ${summary.attempts}`);
  console.log('');
  console.log('  WHAT IS GOING WRONG');
  console.log(wrap(summary.summary.problem, '    '));
  console.log('');
  console.log('  WHY IT MATTERS');
  console.log(wrap(summary.summary.whyItMatters, '    '));
  console.log('');
  console.log('  WHAT CAN BE DONE');
  for (const item of summary.summary.whatWeCanDo) console.log(wrap(`- ${item}`, '    '));
  if (summary.summary.jargonAvoided.length > 0) {
    console.log('');
    console.log(`  jargon it avoided or explained: ${summary.summary.jargonAvoided.join(', ')}`);
  }

  // ── 3. Imagery ────────────────────────────────────────────────────────────
  heading(3, 'Choosing the key image');
  const plan = await planImagery(ai, articleText, document.title);

  console.log(`  decision:  ${plan.kind}, placed at the ${plan.placement}`);
  console.log(wrap(`reason: ${plan.reasoning}`, '  '));
  console.log(wrap(`alt text: ${plan.altText}`, '  '));

  if (plan.kind === 'photo') {
    console.log('');
    console.log(`  searching licence-clear sources for: ${plan.searchQueries.join(', ')}`);
    const candidates = (
      await Promise.all(
        plan.searchQueries.map((query) =>
          searchLicensedImages(query, {
            unsplashKey: config.unsplashKey,
            pexelsKey: config.pexelsKey,
          }),
        ),
      )
    ).flat();

    console.log(`  found ${candidates.length} candidate(s):`);
    for (const candidate of candidates.slice(0, 5)) {
      console.log(`    [${candidate.provider}] ${candidate.credit} (${candidate.license})`);
      console.log(wrap(candidate.description.slice(0, 120), '      '));
    }
    if (candidates.length === 0) {
      console.log('    none — the pipeline would fall through to a figure');
    }
  }

  // ── 4. Figure ─────────────────────────────────────────────────────────────
  heading(4, 'Building a figure from the article data');
  const figure = await buildFigure(ai, articleText, document.title);

  if ('error' in figure) {
    console.log(`  no figure: ${figure.error}`);
    console.log('  (the pipeline publishes without one rather than inventing data)');
  } else {
    const check = figureIsPlausible(figure.spec, articleText);
    console.log(`  title:   ${figure.spec.title}`);
    console.log(`  type:    ${figure.spec.chartType}`);
    console.log(`  source:  ${figure.spec.dataSource}`);
    console.log(`  verified against the article: ${check.ok ? 'yes' : `NO — ${check.reason}`}`);
    console.log('');
    console.log('  quoted from the article:');
    console.log(wrap(`"${figure.spec.sourceSpan}"`, '    '));
    console.log('');
    console.log('  data:');
    for (const series of figure.spec.series) {
      const points = series.points.map((point) => `${point.x}=${point.y}`).join(', ');
      console.log(wrap(`${series.name}: ${points}`, '    '));
    }

    const rendered = await renderFigure(figure.spec);
    const output = join(process.cwd(), 'dry-run-figure.png');
    writeFileSync(output, rendered.png);
    console.log('');
    console.log(`  rendered to ${output} (${rendered.width}x${rendered.height})`);
  }

  // ── 5. Reflections ────────────────────────────────────────────────────────
  heading(5, 'Reflection options');
  const reflections = await generateReflections(ai, articleText, document.title);

  console.log(`  accepted ${reflections.options.length} of 3 after ${reflections.attempts} round(s)`);
  console.log('');

  for (const [index, option] of reflections.options.entries()) {
    const factor = getFactor(option.factorKey);
    const impact = factor
      ? `${(factor.kgCo2ePerUnit * option.estimatedQuantity).toFixed(1)} kg CO2e/week`
      : 'unmeasured';

    console.log(`  ${index + 1}. ${option.title}`);
    console.log(wrap(option.detail, '     '));
    console.log(`     measured as: ${factor?.label ?? option.factorKey} x ${option.estimatedQuantity} = ${impact}`);
    console.log(`     graded: specificity ${option.specificity}/5, relevance ${option.relevance}/5`);
    console.log('     grounded in:');
    console.log(wrap(`"${option.sourceSpan}"`, '       '));
    console.log('');
  }

  if (reflections.rejections.length > 0) {
    console.log('  rejected along the way — this is the quality gate working:');
    for (const rejection of reflections.rejections) console.log(wrap(`- ${rejection}`, '    '));
    console.log('');
  }

  // Re-run the deterministic gates so the report shows they were applied,
  // not merely that the model was asked nicely.
  const gates = checkReflectionSet(reflections.options, articleText);
  console.log(`  deterministic gates (grounding, verbs, quantities): ${gates.ok ? 'all passed' : 'FAILED'}`);

  // ── Done ──────────────────────────────────────────────────────────────────
  const usage = ai.usage;
  console.log('');
  line('═');
  console.log(`  Done. ~${usage.tokens} tokens on ${usage.model} (${usage.provider}).`);
  if (usage.provider === 'gemini') {
    console.log('  On the free tier that cost nothing.');
  }
  line('═');
  console.log('');
}

/**
 * Configuration for a run that touches no database and no Drive.
 *
 * loadConfig requires Supabase and Drive because the scheduled pipeline needs
 * them. This command needs neither, so those are stubbed and only the provider
 * resolution — the part that matters here — runs for real.
 */
function loadDryRunConfig(): WorkerConfig {
  process.env.SUPABASE_URL ??= 'https://dry-run.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'dry-run';
  process.env.GOOGLE_DRIVE_FOLDER_ID ??= 'dry-run';
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON ??= '{}';

  try {
    return loadConfig();
  } catch (error) {
    console.error('');
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    console.error('');
    console.error('  A free Gemini key is all this command needs:');
    console.error('    1. Go to https://aistudio.google.com/apikey');
    console.error('    2. Create a key (no billing account required)');
    console.error('    3. GEMINI_API_KEY=your-key pnpm --filter @climatenote/worker dry-run');
    console.error('');
    process.exit(1);
  }
}

void main().catch((error: unknown) => {
  console.error('');
  console.error(`  Dry run failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error('');
  process.exit(1);
});
