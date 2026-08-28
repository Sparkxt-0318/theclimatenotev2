/**
 * Readability scoring.
 *
 * The summary promises to be understandable by everyone, and "the prompt asked
 * for simple language" is not evidence that it is. This computes a grade level
 * in code so the pipeline can reject a summary that reads like a policy brief
 * and ask for it again.
 */

/**
 * Syllable estimate. Heuristic — English spelling does not permit an exact
 * count without a dictionary — but stable and good enough to grade a paragraph.
 */
export function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length === 0) return 0;
  if (clean.length <= 3) return 1;

  const trimmed = clean
    // Silent trailing 'e', but keep 'le' in "little", "able".
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '');

  // Vowel clusters run up to three letters in English ("beau-ti-ful",
  // "thr-ough"); capping at two splits them and over-counts syllables.
  return Math.max(1, trimmed.match(/[aeiouy]{1,3}/g)?.length ?? 1);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w));
}

export type ReadabilityScore = {
  /** Flesch-Kincaid US grade level. 8 means a typical 13-14 year old. */
  gradeLevel: number;
  /** Flesch reading ease, 0-100. Higher is easier. */
  readingEase: number;
  words: number;
  sentences: number;
  /** Sentences whose own grade level is well above the passage average. */
  hardestSentences: string[];
};

export function scoreReadability(text: string): ReadabilityScore {
  const sentences = splitSentences(text);
  const words = splitWords(text);

  if (sentences.length === 0 || words.length === 0) {
    return { gradeLevel: 0, readingEase: 100, words: 0, sentences: 0, hardestSentences: [] };
  }

  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);
  const wordsPerSentence = words.length / sentences.length;
  const syllablesPerWord = syllables / words.length;

  const gradeLevel = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  const readingEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;

  // Quote the worst offenders back to the model rather than just saying "too
  // hard" — a regeneration with specifics is far more likely to improve.
  const hardestSentences = sentences
    .map((sentence) => {
      const sWords = splitWords(sentence);
      if (sWords.length === 0) return { sentence, grade: 0 };
      const sSyllables = sWords.reduce((t, w) => t + countSyllables(w), 0);
      return {
        sentence,
        grade: 0.39 * sWords.length + 11.8 * (sSyllables / sWords.length) - 15.59,
      };
    })
    .sort((a, b) => b.grade - a.grade)
    .slice(0, 3)
    .filter((s) => s.grade > gradeLevel + 1)
    .map((s) => s.sentence);

  return {
    gradeLevel: Math.max(0, Number(gradeLevel.toFixed(1))),
    readingEase: Number(readingEase.toFixed(1)),
    words: words.length,
    sentences: sentences.length,
    hardestSentences,
  };
}

/**
 * Target for the plain-language summary.
 *
 * Grade 9 rather than a lower number on purpose: the audience runs up to
 * college age, and writing down to grade 5 would read as condescending to a
 * seventeen-year-old. This is "a bright thirteen-year-old follows it easily",
 * not "written for children".
 */
export const SUMMARY_MAX_GRADE_LEVEL = 9;
