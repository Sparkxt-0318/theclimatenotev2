/**
 * Feature 2: the key image.
 *
 * The model commits to `photo` or `figure` and to a placement BEFORE it sees
 * any search results, so it cannot rationalise whatever happened to turn up.
 *
 * - photo  → we search licence-clear sources and let the model choose, or
 *            reject them all. A bad photograph is worse than none.
 * - figure → the model extracts real numbers from the article and we render
 *            the chart ourselves.
 *
 * When a photo search comes back empty or the model rejects everything, we fall
 * through to a figure rather than forcing a picture that does not fit.
 */

import { figureSpecSchema, imageryPlanSchema, type FigureSpec, type ImageryPlan } from '@climatenote/shared';
import { z } from 'zod';

import { figureIsPlausible } from '../images/figure';
import type { LicensedImage } from '../images/search';
import type { AiClient } from './provider';

const PLAN_SYSTEM = `You are the picture editor for The Climate Note, a weekly climate newsletter
for readers aged 12 to 22.

Decide what single image should run with this article.

Choose "figure" when the article contains real numbers worth seeing — a
comparison, a trend, a breakdown. A chart built from the article's own data is
almost always more useful to a reader than a stock photograph.

Choose "photo" when the article is about a place, an event, a person or a
physical thing, and a photograph would show the reader something words cannot.

Placement:
- "start" if the image sets up the piece.
- "middle" if it makes more sense once the reader has some context, or if it
  answers a question the opening raises.

Return JSON:
{"kind":"photo"|"figure","placement":"start"|"middle","reasoning":"one sentence",
 "searchQueries":["2-4 short search phrases, only if kind is photo"],
 "altText":"a description for someone who cannot see the image"}`;

const FIGURE_SYSTEM = `Extract a chart from this article's own numbers.

Absolute rule: every value you plot must be stated in the article. Do not
estimate, interpolate, or fill gaps from your own knowledge. If the article
does not contain enough numbers for a chart, return a single series with the
two or three values it does state.

Order the points meaningfully: largest first for comparisons, chronological for
time. They are plotted in the order you give.

Quote the exact sentence containing the numbers in sourceSpan.

Return JSON:
{"title":"a headline that states the finding, not the topic",
 "chartType":"bar"|"line"|"area"|"scatter",
 "xLabel":"","yLabel":"","unit":"",
 "series":[{"name":"","points":[{"x":"","y":0}]}],
 "caption":"one sentence explaining what the reader is looking at",
 "sourceSpan":"exact quote from the article containing these numbers",
 "dataSource":"who produced this data, per the article"}`;

const choiceSchema = z.object({
  /** 1-based index into the candidate list, or 0 for "none of these fit". */
  chosenIndex: z.number().int().min(0),
  reasoning: z.string().max(300),
  altText: z.string().min(15).max(300),
});

export type ImageryOutcome =
  | { kind: 'photo'; plan: ImageryPlan; image: LicensedImage; altText: string }
  | { kind: 'figure'; plan: ImageryPlan; spec: FigureSpec }
  | { kind: 'none'; plan: ImageryPlan; reason: string };

export async function planImagery(
  ai: AiClient,
  articleText: string,
  title: string,
): Promise<ImageryPlan> {
  return ai.structured({
    system: PLAN_SYSTEM,
    user: `Article title: ${title}\n\nArticle:\n${articleText}`,
    schema: imageryPlanSchema,
    schemaName: 'imagery plan',
    temperature: 0.3,
  });
}

/**
 * Asks the model to pick from real candidates, and takes "none of these" for an
 * answer. Forcing a choice is how a stock photo of a wind turbine ends up on an
 * article about food waste.
 */
export async function chooseImage(
  ai: AiClient,
  articleText: string,
  candidates: LicensedImage[],
): Promise<{ image: LicensedImage; altText: string } | null> {
  if (candidates.length === 0) return null;

  const list = candidates
    .map((image, index) => `${index + 1}. [${image.provider}] ${image.description || '(no description)'}`)
    .join('\n');

  const choice = await ai.structured({
    system:
      'You choose the photograph to run with a climate article. Pick the one that genuinely ' +
      'illustrates THIS article. If none of them do, return chosenIndex 0 — a wrong or generic ' +
      'photograph is worse than no photograph. Return JSON: ' +
      '{"chosenIndex":n,"reasoning":"","altText":""}',
    user: `Article:\n${articleText.slice(0, 4000)}\n\nCandidates:\n${list}`,
    schema: choiceSchema,
    schemaName: 'image choice',
    temperature: 0.2,
  });

  if (choice.chosenIndex < 1 || choice.chosenIndex > candidates.length) return null;

  const image = candidates[choice.chosenIndex - 1];
  return image ? { image, altText: choice.altText } : null;
}

/**
 * Builds a chart specification from the article's numbers, and verifies it
 * before returning. A chart is more persuasive than a sentence, so an
 * unverifiable one is more dangerous than an unverifiable claim.
 */
export async function buildFigure(
  ai: AiClient,
  articleText: string,
  title: string,
): Promise<{ spec: FigureSpec } | { error: string }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const spec = await ai.structured({
      system: FIGURE_SYSTEM,
      user: `Article title: ${title}\n\nArticle:\n${articleText}`,
      schema: figureSpecSchema,
      schemaName: 'figure spec',
      temperature: attempt === 0 ? 0.2 : 0,
    });

    const check = figureIsPlausible(spec, articleText);
    if (check.ok) return { spec };

    // Second attempt gets the specific complaint; if it still fails we publish
    // without a figure rather than with an invented one.
    if (attempt === 1) return { error: check.reason ?? 'figure could not be verified' };
  }

  return { error: 'figure could not be verified' };
}
