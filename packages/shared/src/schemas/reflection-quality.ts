/**
 * Deterministic quality gates for reflection options.
 *
 * The brief was explicit: these options must never be vague and must never be
 * unrelated to the article. A prompt asking nicely is not a guarantee, and a
 * model grading its own output is not either. So the first gate is code, and it
 * runs before any grader is consulted.
 *
 * These checks are intentionally blunt. A false rejection costs one retry; a
 * false acceptance ships "try to be more mindful of your carbon footprint" to
 * thousands of readers as our idea of a specific action.
 */

import { isFactorKey } from '../impact/factors';
import type { ReflectionOption } from './ai';

/**
 * Phrasing that signals a sentiment rather than an action. Matched as whole
 * phrases against the lowercased title and detail.
 *
 * Every entry here is something a language model reliably produces when it has
 * nothing concrete to say.
 */
export const VAGUE_PHRASES = [
  'be mindful',
  'be more mindful',
  'be aware',
  'raise awareness',
  'spread awareness',
  'try to reduce',
  'try to use less',
  'consider using less',
  'consider reducing',
  'think about',
  'reflect on',
  'do your part',
  'do your bit',
  'make a difference',
  'be more sustainable',
  'be more eco-friendly',
  'be environmentally conscious',
  'live sustainably',
  'reduce your carbon footprint',
  'lower your footprint',
  'help the planet',
  'save the planet',
  'go green',
  'where possible',
  'when possible',
  'whenever you can',
  'as much as you can',
  'if you can',
  'try your best',
  'small changes',
  'every little helps',
  'learn more about',
  'educate yourself',
  'stay informed',
] as const;

/**
 * Verbs that begin a real instruction. An option that does not open with one of
 * these is almost always a statement of intent rather than a thing to do.
 */
const ACTION_VERBS = new Set([
  'swap', 'switch', 'replace', 'skip', 'skipped', 'walk', 'cycle', 'bike', 'ride', 'take',
  'bring', 'carry', 'refill', 'reuse', 'recycle', 'compost', 'repair', 'fix', 'mend',
  'buy', 'choose', 'pick', 'cook', 'eat', 'batch', 'freeze', 'save', 'finish', 'use',
  'wash', 'dry', 'hang', 'turn', 'lower', 'unplug', 'shorten', 'cut', 'limit', 'cap',
  'borrow', 'share', 'donate', 'sell', 'plant', 'grow', 'collect', 'sort', 'separate',
  'write', 'ask', 'email', 'call', 'join', 'start', 'set', 'track', 'log', 'count',
  'measure', 'check', 'swap', 'trade', 'pack', 'prep', 'plan', 'avoid', 'decline', 'refuse',
]);

/**
 * Words and patterns that make an action countable. Without one of these, a
 * reader cannot tell whether they have done it.
 */
const QUANTITY_PATTERNS = [
  /\b\d+(\.\d+)?\b/, // any digit
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|half|double)\b/i,
  /\b(daily|weekly|nightly)\b/i,
  /\b(each|every)\s+(day|morning|evening|night|week|meal|trip|shower|load|time)\b/i,
  /\b(this|next)\s+(week|weekend|month)\b/i,
  /\ball\s+(week|month)\b/i,
  /\bfor\s+(a|one|the)\s+(day|week|weekend|month)\b/i,
  /\b(once|twice|three times|four times|five times)\b/i,
  /\bper\s+(day|week|meal|trip)\b/i,
];

export type QualityIssue = {
  code:
    | 'vague_phrase'
    | 'no_action_verb'
    | 'no_quantity'
    | 'too_short'
    | 'unknown_factor'
    | 'ungrounded'
    | 'quantity_implausible'
    | 'duplicate';
  message: string;
};

export type QualityResult = { ok: boolean; issues: QualityIssue[] };

/** Collapses whitespace and smart punctuation so quotes can be matched fairly. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifies the model's quote actually appears in the article.
 *
 * This is the anti-hallucination gate: an option whose justifying sentence
 * cannot be found in the body is, by definition, not grounded in the article.
 * A short trailing tolerance allows for the model trimming a quote mid-word.
 */
export function isGroundedInArticle(sourceSpan: string, articleText: string): boolean {
  const haystack = normalizeForMatch(articleText);
  const needle = normalizeForMatch(sourceSpan);
  if (needle.length < 15) return false;
  if (haystack.includes(needle)) return true;

  // Tolerate a quote that ran slightly past the end of a sentence.
  const trimmed = needle.slice(0, Math.floor(needle.length * 0.8));
  return trimmed.length >= 15 && haystack.includes(trimmed);
}

function firstWord(text: string): string {
  return (text.trim().split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Checks one option against every deterministic rule.
 *
 * `articleText` is the full body; when omitted the grounding check is skipped,
 * which is only appropriate in unit tests of the other rules.
 */
export function checkReflectionOption(
  option: ReflectionOption,
  articleText?: string,
): QualityResult {
  const issues: QualityIssue[] = [];
  const haystack = `${option.title} ${option.detail}`.toLowerCase();

  for (const phrase of VAGUE_PHRASES) {
    if (haystack.includes(phrase)) {
      issues.push({
        code: 'vague_phrase',
        message: `Contains the vague phrase "${phrase}". Say what to do, not how to feel.`,
      });
    }
  }

  if (!ACTION_VERBS.has(firstWord(option.title))) {
    issues.push({
      code: 'no_action_verb',
      message: `Title starts with "${firstWord(option.title)}", which is not an action. Start with a verb the reader can perform.`,
    });
  }

  const hasQuantity = QUANTITY_PATTERNS.some((pattern) => pattern.test(haystack));
  if (!hasQuantity) {
    issues.push({
      code: 'no_quantity',
      message: 'No amount or frequency, so a reader cannot tell when they have done it.',
    });
  }

  if (option.title.trim().split(/\s+/).length < 4) {
    issues.push({ code: 'too_short', message: 'Title is too short to be a specific action.' });
  }

  if (!isFactorKey(option.factorKey)) {
    issues.push({
      code: 'unknown_factor',
      message: `"${option.factorKey}" is not a factor we can measure.`,
    });
  }

  // A week of one person's life has limits. 500 reusable cups is not a plan.
  if (option.estimatedQuantity > 100) {
    issues.push({
      code: 'quantity_implausible',
      message: `${option.estimatedQuantity} units in a week is not achievable for one person.`,
    });
  }

  if (articleText !== undefined && !isGroundedInArticle(option.sourceSpan, articleText)) {
    issues.push({
      code: 'ungrounded',
      message: 'The quoted sentence does not appear in the article.',
    });
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Checks a full set of three, including that they are not three phrasings of
 * the same idea — which is a common failure when an article has one obvious
 * takeaway.
 */
export function checkReflectionSet(
  options: readonly ReflectionOption[],
  articleText?: string,
): { ok: boolean; perOption: QualityResult[] } {
  const perOption = options.map((option) => checkReflectionOption(option, articleText));

  const factorKeys = options.map((o) => o.factorKey);
  const duplicateFactors = factorKeys.length !== new Set(factorKeys).size;
  if (duplicateFactors) {
    factorKeys.forEach((key, index) => {
      if (factorKeys.indexOf(key) !== index) {
        perOption[index]?.issues.push({
          code: 'duplicate',
          message: `Another option already covers "${key}". Offer the reader genuinely different choices.`,
        });
      }
    });
  }

  for (const result of perOption) result.ok = result.issues.length === 0;
  return { ok: perOption.every((r) => r.ok), perOption };
}
