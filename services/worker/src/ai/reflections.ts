/**
 * Feature 3: the three options under "Write your climate note!".
 *
 * The brief was explicit that these must never be vague and never unrelated to
 * the article. That is enforced in three independent layers, and an option must
 * clear all three:
 *
 *   1. GROUNDING   — every option quotes the article sentence that justifies
 *                    it, and we check the quote actually appears in the body.
 *                    An invented quote means an ungrounded option.
 *   2. VALIDATORS  — deterministic code: banned vague phrases, a required
 *                    action verb, a required quantity, a real factor key.
 *                    Runs before any model is consulted.
 *   3. GRADER      — a separate model call scores specificity and relevance
 *                    1-5 with no knowledge of which model wrote the option.
 *
 * A failing option is regenerated with the specific complaints fed back, up to
 * MAX_REFLECTION_ATTEMPTS. What survives is reported honestly: if we cannot get
 * three good options, we return what we have and flag it for the editor rather
 * than padding the set with something weak.
 */

import {
  checkReflectionSet,
  IMPACT_FACTORS,
  MAX_REFLECTION_ATTEMPTS,
  MIN_REFLECTION_SCORE,
  reflectionGradeSchema,
  reflectionSetSchema,
  type ReflectionOption,
} from '@climatenote/shared';

import type { AiClient } from './provider';

const FACTOR_MENU = IMPACT_FACTORS.filter((f) => f.kgCo2ePerUnit > 0)
  .map((f) => `- ${f.key} — ${f.label} (measured per ${f.unit})`)
  .join('\n');

const SYSTEM = `You write action prompts for The Climate Note, read by people aged 12 to 22.

Given an article, propose THREE things a reader could actually do this week.

Every option must:
- Start with a verb they perform: "Swap", "Walk", "Refill", "Batch-cook".
- Contain a NUMBER or a FREQUENCY, so they can tell when they have done it.
  "Swap two beef meals this week" — not "eat less beef".
- Follow from THIS article specifically. If the option would fit equally well
  under any climate article, it is wrong.
- Quote the sentence from the article that justifies it, word for word, in
  sourceSpan. Copy it exactly; do not paraphrase or reconstruct it.
- Map to one of the measurable actions listed below.
- Be genuinely different from the other two. Three phrasings of one idea is
  not a choice.

Never write: "be mindful", "raise awareness", "do your part", "try to reduce",
"where possible", "small changes", "reduce your carbon footprint", "learn more
about". These are sentiments, not actions, and they will be rejected.

Measurable actions you may map to:
${FACTOR_MENU}

Return JSON:
{"options": [{
  "title": "imperative action with a number, under 90 characters",
  "detail": "one sentence tying it to this article",
  "sourceSpan": "exact quote from the article",
  "factorKey": "one key from the list above",
  "estimatedQuantity": <units a real person achieves in a week>,
  "difficulty": "easy" | "medium" | "stretch"
}]}`;

const GRADER_SYSTEM = `You grade action prompts for a climate newsletter. Be strict and be honest.

specificity (1-5): could a reader tell, on Sunday night, whether they did this?
  5 = an exact, countable action ("Swap two beef meals for beans")
  3 = an action with no amount ("Swap beef meals for beans")
  1 = a sentiment ("Eat more sustainably", "Be mindful of your diet")

relevance (1-5): does this follow from THIS article?
  5 = it responds directly to a specific claim the article makes
  3 = it fits the article's general topic
  1 = it would fit under any climate article at all

Return JSON: {"specificity": n, "relevance": n, "critique": "what would make it a 5"}`;

export type GradedOption = ReflectionOption & {
  specificity: number;
  relevance: number;
};

export type ReflectionResult = {
  options: GradedOption[];
  attempts: number;
  /** Complaints from the final round, surfaced to the editor. */
  rejections: string[];
};

export async function generateReflections(
  ai: AiClient,
  articleText: string,
  title: string,
): Promise<ReflectionResult> {
  const accepted: GradedOption[] = [];
  const rejections: string[] = [];
  let feedback = '';
  let attempts = 0;

  while (accepted.length < 3 && attempts < MAX_REFLECTION_ATTEMPTS) {
    attempts += 1;

    const needed = 3 - accepted.length;
    const alreadyHave = accepted.map((o) => `- ${o.title} (${o.factorKey})`).join('\n');

    const generated = await ai.structured({
      system: SYSTEM,
      user:
        `Article title: ${title}\n\nArticle:\n${articleText}\n\n` +
        (accepted.length > 0
          ? `You already have these accepted options, so propose genuinely different ones:\n${alreadyHave}\n\n`
          : '') +
        (feedback ? `Previous attempts were rejected:\n${feedback}\n\n` : '') +
        `Propose 3 options. At least ${needed} must be new.`,
      schema: reflectionSetSchema,
      schemaName: 'reflections',
      temperature: 0.7,
    });

    // Layer 1 + 2, in code, before spending anything on grading.
    const structural = checkReflectionSet(generated.options, articleText);
    const roundComplaints: string[] = [];

    for (const [index, option] of generated.options.entries()) {
      const check = structural.perOption[index];
      if (!check?.ok) {
        const why = check?.issues.map((i) => i.message).join(' ') ?? 'failed validation';
        roundComplaints.push(`"${option.title}" — ${why}`);
        continue;
      }

      // Do not accept two options measuring the same thing across rounds.
      if (accepted.some((a) => a.factorKey === option.factorKey)) {
        roundComplaints.push(`"${option.title}" — duplicates an accepted option's action.`);
        continue;
      }

      // Layer 3: an independent grader that never sees the generator's reasoning.
      const grade = await ai.structured({
        system: GRADER_SYSTEM,
        user: `Article:\n${articleText}\n\nOption:\n${option.title}\n${option.detail}`,
        schema: reflectionGradeSchema,
        schemaName: 'reflection grade',
        temperature: 0,
      });

      if (grade.specificity < MIN_REFLECTION_SCORE || grade.relevance < MIN_REFLECTION_SCORE) {
        roundComplaints.push(
          `"${option.title}" — scored specificity ${grade.specificity}/5, relevance ${grade.relevance}/5. ${grade.critique}`,
        );
        continue;
      }

      accepted.push({ ...option, specificity: grade.specificity, relevance: grade.relevance });
      if (accepted.length === 3) break;
    }

    feedback = roundComplaints.join('\n');
    rejections.push(...roundComplaints);
  }

  return { options: accepted.slice(0, 3), attempts, rejections };
}
