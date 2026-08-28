/**
 * Contracts for every AI output in the pipeline.
 *
 * These schemas are the boundary between "a model said something" and "we are
 * willing to show this to a reader". Everything crossing that boundary is
 * parsed, validated and — where the requirement is quality rather than shape —
 * graded before it is stored.
 */

import { z } from 'zod';

import { FACTOR_KEYS } from '../impact/factors';

// ── 1. Plain-language summary ───────────────────────────────────────────────

export const summarySchema = z.object({
  /** What is going wrong, in one short paragraph. */
  problem: z.string().min(40).max(700),
  /** Why a reader should care. Concrete consequences, not abstractions. */
  whyItMatters: z.string().min(40).max(700),
  /** Two to four things that genuinely help. */
  whatWeCanDo: z.array(z.string().min(15).max(300)).min(2).max(4),
  /**
   * Jargon the model met in the article and deliberately explained or avoided.
   * Recorded so an editor can see what was smoothed over, and because asking
   * for it measurably reduces how much jargon survives.
   */
  jargonAvoided: z.array(z.string().max(80)).max(12).default([]),
});

export type ArticleSummary = z.infer<typeof summarySchema>;

// ── 2. Imagery decision ─────────────────────────────────────────────────────

export const imageryPlanSchema = z.object({
  /**
   * `photo` when a real photograph would carry the piece; `figure` when the
   * article's own numbers deserve a chart. The model must commit before it
   * searches, so it cannot rationalise whatever it happened to find.
   */
  kind: z.enum(['photo', 'figure']),
  placement: z.enum(['start', 'middle']),
  /** Why this choice, in one sentence. Shown to the admin at review time. */
  reasoning: z.string().min(20).max(400),
  /** Search terms, when `kind` is `photo`. */
  searchQueries: z.array(z.string().min(3).max(120)).max(5).default([]),
  /** Alt text. Required regardless of kind — an image without it is not shippable. */
  altText: z.string().min(15).max(300),
});

export type ImageryPlan = z.infer<typeof imageryPlanSchema>;

/**
 * A chart specification derived from numbers stated in the article.
 *
 * The model emits data, not a picture. We render it ourselves, in brand
 * colours, from values that can be checked against the text — an image model
 * asked to "draw a graph of this" produces something chart-shaped with invented
 * numbers on the axes, which for a climate publication is worse than no figure.
 */
export const figureSpecSchema = z.object({
  title: z.string().min(5).max(120),
  chartType: z.enum(['bar', 'line', 'area', 'scatter']),
  xLabel: z.string().max(80),
  yLabel: z.string().max(80),
  /** Units of the y axis, e.g. "million tonnes CO2e". */
  unit: z.string().max(60),
  /**
   * Points are plotted in the order given, so order them meaningfully —
   * largest first for magnitudes, chronologically for time.
   */
  series: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        points: z
          .array(z.object({ x: z.union([z.string(), z.number()]), y: z.number() }))
          .min(2)
          .max(60),
      }),
    )
    .min(1)
    .max(6),
  caption: z.string().min(20).max(400),
  /**
   * Where these numbers came from. Must quote the article; the pipeline
   * verifies the quote actually appears in the body.
   */
  sourceSpan: z.string().min(15).max(600),
  /** Attribution line printed under the figure. */
  dataSource: z.string().min(3).max(200),
});

export type FigureSpec = z.infer<typeof figureSpecSchema>;

// ── 3. Reflection options ───────────────────────────────────────────────────

/**
 * One option under "Write your climate note!".
 *
 * The hard requirement from the brief is that these are never vague and never
 * unrelated to the article. The schema carries the machinery for that:
 * `sourceSpan` forces the model to point at the sentence that justifies the
 * action, and `factorKey` forces it to be something we can actually measure.
 */
export const reflectionOptionSchema = z.object({
  /** The action itself. Imperative, specific, with a quantity. */
  title: z.string().min(12).max(90),
  /** One sentence connecting it back to the article. */
  detail: z.string().min(25).max(280),
  /** Verbatim quote from the article that this action responds to. */
  sourceSpan: z.string().min(15).max(600),
  /** Which emission factor measures this action. */
  factorKey: z.enum(FACTOR_KEYS as [string, ...string[]]),
  /** How many units of that factor a reader plausibly achieves in a week. */
  estimatedQuantity: z.number().positive().max(500),
  difficulty: z.enum(['easy', 'medium', 'stretch']),
});

export type ReflectionOption = z.infer<typeof reflectionOptionSchema>;

export const reflectionSetSchema = z.object({
  options: z.array(reflectionOptionSchema).length(3),
});

/** The grader's verdict on a single option. */
export const reflectionGradeSchema = z.object({
  /** 1-5. Is this a specific action, or a sentiment? */
  specificity: z.number().int().min(1).max(5),
  /** 1-5. Does it follow from THIS article, or would it fit any climate piece? */
  relevance: z.number().int().min(1).max(5),
  /** What would have to change to score 5. Fed back on a retry. */
  critique: z.string().max(400),
});

export type ReflectionGrade = z.infer<typeof reflectionGradeSchema>;

// ── 4. Mapping a user's own action onto a factor ────────────────────────────

export const customActionMappingSchema = z.object({
  factorKey: z.enum(FACTOR_KEYS as [string, ...string[]]),
  estimatedQuantity: z.number().min(0).max(500),
  /**
   * 0-1. Below `MIN_MAPPING_CONFIDENCE` the action is logged with no number
   * attached rather than assigned a figure we cannot defend.
   */
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(300),
});

export type CustomActionMapping = z.infer<typeof customActionMappingSchema>;

/**
 * Below this, we show the user "logged" instead of a carbon figure.
 *
 * Set high deliberately. A wrong number in a climate app is worse than no
 * number, because the reader has no way to tell it is wrong.
 */
export const MIN_MAPPING_CONFIDENCE = 0.7;

/** Minimum grade an option must reach on both axes before it can ship. */
export const MIN_REFLECTION_SCORE = 4;

/** How many times the pipeline will retry a failing option before giving up. */
export const MAX_REFLECTION_ATTEMPTS = 3;
