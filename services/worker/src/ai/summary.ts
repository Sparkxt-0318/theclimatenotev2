/**
 * Feature 1: the plain-language summary.
 *
 * The brief asked for something everyone can understand, with minimal jargon.
 * A prompt asking for that is not evidence of it, so the output is scored with
 * Flesch-Kincaid in code and regenerated — with its own worst sentences quoted
 * back — when it comes in too dense.
 */

import {
  scoreReadability,
  summarySchema,
  SUMMARY_MAX_GRADE_LEVEL,
  type ArticleSummary,
} from '@climatenote/shared';

import type { AiClient } from './provider';

const SYSTEM = `You write plain-language summaries for The Climate Note, a weekly climate
newsletter read by people aged roughly 12 to 22.

Rules:
- Write for a bright thirteen-year-old. Short sentences. Everyday words.
- Never use a technical term without explaining it in the same sentence.
- Be concrete. "Sea level could rise by the height of a front door" beats
  "significant sea level rise is projected".
- Never invent a fact, number or claim that is not in the article.
- Do not be cheerful about bad news, and do not be hopeless about it either.
  State what is true and what can be done.
- Never write "in conclusion", "it is important to note", or "experts say".

Return JSON only:
{
  "problem": "one short paragraph on what is going wrong",
  "whyItMatters": "one short paragraph on the consequences for real people",
  "whatWeCanDo": ["2 to 4 things that genuinely help"],
  "jargonAvoided": ["technical terms from the article you explained or avoided"]
}`;

export type SummaryResult = {
  summary: ArticleSummary;
  readingGrade: number;
  attempts: number;
};

export async function generateSummary(
  ai: AiClient,
  articleText: string,
  title: string,
): Promise<SummaryResult> {
  let summary = await ai.structured({
    system: SYSTEM,
    user: `Article title: ${title}\n\nArticle:\n${articleText}`,
    schema: summarySchema,
    schemaName: 'summary',
    temperature: 0.3,
  });

  let grade = gradeOf(summary);

  // One retry. If a second attempt is still too dense the article is probably
  // genuinely technical, and shipping a slightly hard summary beats shipping
  // one that has been simplified into inaccuracy.
  if (grade > SUMMARY_MAX_GRADE_LEVEL) {
    const offenders = hardestSentences(summary);

    summary = await ai.structured({
      system: SYSTEM,
      user:
        `Article title: ${title}\n\nArticle:\n${articleText}\n\n` +
        `Your previous summary read at US grade ${grade.toFixed(1)}; the target is ${SUMMARY_MAX_GRADE_LEVEL}. ` +
        `These sentences were the hardest:\n${offenders.map((s) => `- ${s}`).join('\n')}\n\n` +
        'Rewrite the whole summary with shorter sentences and simpler words. Keep every fact.',
      schema: summarySchema,
      schemaName: 'summary',
      temperature: 0.3,
    });

    grade = gradeOf(summary);
    return { summary, readingGrade: grade, attempts: 2 };
  }

  return { summary, readingGrade: grade, attempts: 1 };
}

function summaryText(summary: ArticleSummary): string {
  return [summary.problem, summary.whyItMatters, ...summary.whatWeCanDo].join(' ');
}

function gradeOf(summary: ArticleSummary): number {
  return scoreReadability(summaryText(summary)).gradeLevel;
}

function hardestSentences(summary: ArticleSummary): string[] {
  return scoreReadability(summaryText(summary)).hardestSentences;
}
