import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { SUMMARY_MAX_GRADE_LEVEL, countSyllables, scoreReadability } from './readability';

describe('syllable counting', () => {
  it('handles common words', () => {
    for (const [word, expected] of [
      ['cat', 1],
      ['water', 2],
      ['beautiful', 3],
      ['the', 1],
      ['carbon', 2],
    ] as const) {
      assert.equal(countSyllables(word), expected, `${word}`);
    }
  });

  it('never returns zero for a real word', () => {
    for (const word of ['strengths', 'rhythm', 'queue', 'through']) {
      assert.ok(countSyllables(word) >= 1, word);
    }
  });

  it('ignores punctuation and empty input', () => {
    assert.equal(countSyllables('—'), 0);
    assert.equal(countSyllables(''), 0);
  });
});

describe('grade level', () => {
  const PLAIN = `
    Cows burp methane. Methane traps heat much faster than carbon dioxide does.
    Beef takes far more land than beans do. You can eat beans instead of beef a
    few times a week. That one change helps more than most others.
  `;

  const DENSE = `
    Anthropogenic enteric fermentation constitutes the predominant agricultural
    contributor to atmospheric methane concentrations, exhibiting a global
    warming potential substantially exceeding that of carbon dioxide across
    conventional twenty-year evaluation horizons, thereby necessitating
    reconsideration of prevailing agricultural intensification paradigms.
  `;

  it('rates plain writing at or below the summary target', () => {
    const score = scoreReadability(PLAIN);
    assert.ok(
      score.gradeLevel <= SUMMARY_MAX_GRADE_LEVEL,
      `plain text scored ${score.gradeLevel}`,
    );
  });

  it('rates dense academic prose well above it', () => {
    const score = scoreReadability(DENSE);
    assert.ok(score.gradeLevel > SUMMARY_MAX_GRADE_LEVEL, `dense text scored ${score.gradeLevel}`);
  });

  it('separates the two by a wide margin', () => {
    // If these ever converge the metric has stopped discriminating and the
    // pipeline's readability gate is doing nothing.
    const gap = scoreReadability(DENSE).gradeLevel - scoreReadability(PLAIN).gradeLevel;
    assert.ok(gap > 6, `gap was only ${gap.toFixed(1)}`);
  });

  it('names the hardest sentences so a retry can be specific', () => {
    const mixed = `Cows burp methane. ${DENSE}`;
    const score = scoreReadability(mixed);
    assert.ok(score.hardestSentences.length > 0);
    assert.ok(!score.hardestSentences.some((s) => s.startsWith('Cows burp')));
  });

  it('handles empty input without dividing by zero', () => {
    const score = scoreReadability('');
    assert.equal(score.gradeLevel, 0);
    assert.equal(score.words, 0);
  });

  it('counts sentences and words', () => {
    const score = scoreReadability('One two three. Four five six.');
    assert.equal(score.sentences, 2);
    assert.equal(score.words, 6);
  });
});
