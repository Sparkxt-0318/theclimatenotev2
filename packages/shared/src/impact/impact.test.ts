import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  IMPACT_FACTORS,
  UNQUANTIFIED_KEY,
  addDays,
  currentStreak,
  equivalentOf,
  formatKgCo2e,
  getFactor,
  impactByCategory,
  impactOf,
  levelFor,
  sumImpact,
  weekStrip,
  type Completion,
} from './index';

describe('factor table integrity', () => {
  it('has unique keys', () => {
    const keys = IMPACT_FACTORS.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it('cites a source for every quantified factor', () => {
    for (const factor of IMPACT_FACTORS) {
      if (factor.kgCo2ePerUnit === 0) continue;
      assert.ok(factor.sourceName.length > 0, `${factor.key} has no source name`);
      assert.ok(factor.sourceUrl.startsWith('https://'), `${factor.key} has no source URL`);
      assert.ok(factor.assumption.length > 20, `${factor.key} does not state its assumption`);
    }
  });

  it('records an uncertainty for every factor', () => {
    // A factor without a stated spread invites the UI to present it as exact.
    for (const factor of IMPACT_FACTORS) {
      assert.ok(factor.uncertainty >= 1, `${factor.key} has an impossible uncertainty`);
    }
  });

  it('keeps every value physically plausible', () => {
    for (const factor of IMPACT_FACTORS) {
      assert.ok(factor.kgCo2ePerUnit >= 0, `${factor.key} is negative`);
      // Nothing a person does in a day plausibly saves a tonne per unit.
      assert.ok(factor.kgCo2ePerUnit < 1000, `${factor.key} is implausibly large`);
    }
  });
});

describe('impactOf', () => {
  it('multiplies the factor by the quantity', () => {
    const beef = getFactor('meal.beef_to_plant');
    assert.ok(beef);
    const result = impactOf({ completedOn: '2026-08-28', factorKey: beef.key, quantity: 2 });
    assert.equal(result.kgCo2e, beef.kgCo2ePerUnit * 2);
    assert.equal(result.totalActions, 1);
  });

  it('counts an unknown key as an action with no savings', () => {
    // Guessing a number here would overstate the user's impact; dropping the
    // row entirely would understate their effort. Count it, claim nothing.
    const result = impactOf({ completedOn: '2026-08-28', factorKey: 'nope.not_real', quantity: 1 });
    assert.equal(result.kgCo2e, 0);
    assert.equal(result.totalActions, 1);
    assert.equal(result.unquantifiedActions, 1);
  });

  it('treats deliberately unquantified actions as real but uncounted', () => {
    const result = impactOf({ completedOn: '2026-08-28', factorKey: UNQUANTIFIED_KEY, quantity: 1 });
    assert.equal(result.kgCo2e, 0);
    assert.equal(result.unquantifiedActions, 1);
    assert.equal(result.totalActions, 1);
  });

  it('refuses negative quantities', () => {
    const result = impactOf({ completedOn: '2026-08-28', factorKey: 'meal.beef_to_plant', quantity: -5 });
    assert.equal(result.kgCo2e, 0);
  });

  it('survives a non-finite quantity', () => {
    const result = impactOf({
      completedOn: '2026-08-28',
      factorKey: 'meal.beef_to_plant',
      quantity: Number.NaN,
    });
    assert.equal(result.kgCo2e, 0);
  });
});

describe('sumImpact', () => {
  it('adds a known week to a known total', () => {
    const completions: Completion[] = [
      { completedOn: '2026-08-24', factorKey: 'meal.beef_to_plant', quantity: 1 }, // 9.8
      { completedOn: '2026-08-25', factorKey: 'waste.reusable_bottle', quantity: 3 }, // 0.24
      { completedOn: '2026-08-26', factorKey: 'transport.car_trip_avoided', quantity: 5 }, // 0.85
      { completedOn: '2026-08-27', factorKey: UNQUANTIFIED_KEY, quantity: 1 }, // 0
    ];
    const total = sumImpact(completions);
    assert.ok(Math.abs(total.kgCo2e - 10.89) < 0.001, `got ${total.kgCo2e}`);
    assert.equal(total.totalActions, 4);
    assert.equal(total.unquantifiedActions, 1);
    assert.ok(Math.abs(total.kgWaste - 0.06) < 0.0001);
  });

  it('returns zero for an empty week', () => {
    assert.equal(sumImpact([]).kgCo2e, 0);
    assert.equal(sumImpact([]).totalActions, 0);
  });
});

describe('impactByCategory', () => {
  it('groups savings by category', () => {
    const byCategory = impactByCategory([
      { completedOn: '2026-08-24', factorKey: 'meal.beef_to_plant', quantity: 1 },
      { completedOn: '2026-08-24', factorKey: 'meal.meat_free_day', quantity: 1 },
      { completedOn: '2026-08-25', factorKey: 'transport.car_trip_avoided', quantity: 10 },
    ]);
    assert.ok(Math.abs((byCategory.food ?? 0) - 13.2) < 0.001);
    assert.ok(Math.abs((byCategory.transport ?? 0) - 1.7) < 0.001);
    assert.equal(byCategory.energy, undefined);
  });
});

describe('calendar levels', () => {
  it('gives an empty day level 0', () => {
    assert.equal(levelFor({ date: 'd', committed: 3, completed: 0 }), 0);
  });

  it('gives a fully completed day the deepest green', () => {
    assert.equal(levelFor({ date: 'd', committed: 3, completed: 3 }), 4);
  });

  it('lifts a day off zero for any completion at all', () => {
    // Showing up matters more than hitting a quota for this audience.
    assert.ok(levelFor({ date: 'd', committed: 10, completed: 1 }) >= 1);
  });

  it('scales with the fraction completed', () => {
    assert.equal(levelFor({ date: 'd', committed: 10, completed: 7 }), 3);
    assert.equal(levelFor({ date: 'd', committed: 10, completed: 4 }), 2);
    assert.equal(levelFor({ date: 'd', committed: 10, completed: 2 }), 1);
  });

  it('handles completing something never formally committed', () => {
    assert.ok(levelFor({ date: 'd', committed: 0, completed: 1 }) > 0);
  });

  it('never exceeds the top of the scale when over-completing', () => {
    assert.equal(levelFor({ date: 'd', committed: 1, completed: 5 }), 4);
  });
});

describe('date arithmetic', () => {
  it('moves forward and backward', () => {
    assert.equal(addDays('2026-08-28', 1), '2026-08-29');
    assert.equal(addDays('2026-08-28', -1), '2026-08-27');
  });

  it('crosses month and year boundaries', () => {
    assert.equal(addDays('2026-08-31', 1), '2026-09-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  });

  it('handles a leap day', () => {
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(addDays('2028-02-29', 1), '2028-03-01');
  });
});

describe('weekStrip', () => {
  it('always returns seven days, oldest first', () => {
    const strip = weekStrip('2026-08-28', []);
    assert.equal(strip.length, 7);
    assert.equal(strip[0]?.date, '2026-08-22');
    assert.equal(strip[6]?.date, '2026-08-28');
  });

  it('fills missing days with level 0 rather than omitting them', () => {
    const strip = weekStrip('2026-08-28', [
      { date: '2026-08-26', committed: 2, completed: 2 },
    ]);
    assert.equal(strip.length, 7);
    assert.equal(strip.find((d) => d.date === '2026-08-26')?.level, 4);
    assert.equal(strip.find((d) => d.date === '2026-08-25')?.level, 0);
  });
});

describe('currentStreak', () => {
  const progress = [
    { date: '2026-08-26', committed: 1, completed: 1 },
    { date: '2026-08-27', committed: 1, completed: 1 },
    { date: '2026-08-28', committed: 1, completed: 1 },
  ];

  it('counts consecutive active days', () => {
    assert.equal(currentStreak('2026-08-28', progress), 3);
  });

  it('does not break the streak partway through today', () => {
    // At 9am on the 29th the user has not failed; they simply have not acted yet.
    assert.equal(currentStreak('2026-08-29', progress), 3);
  });

  it('breaks once a full day is missed', () => {
    assert.equal(currentStreak('2026-08-30', progress), 0);
  });

  it('ignores days where nothing was completed', () => {
    const withGap = [...progress, { date: '2026-08-29', committed: 3, completed: 0 }];
    assert.equal(currentStreak('2026-08-29', withGap), 3);
  });

  it('is zero with no history', () => {
    assert.equal(currentStreak('2026-08-28', []), 0);
  });
});

describe('presentation', () => {
  it('does not imply precision the data cannot support', () => {
    // Factors carry 1.5-3x uncertainty, so two decimal places would be a lie.
    assert.equal(formatKgCo2e(9.8342), '9.8 kg');
    assert.equal(formatKgCo2e(46.7), '47 kg');
    assert.equal(formatKgCo2e(0.42), '0.4 kg');
  });

  it('switches to tonnes when kilograms stop being readable', () => {
    assert.equal(formatKgCo2e(2400), '2.4 tonnes');
  });

  it('handles zero and nonsense', () => {
    assert.equal(formatKgCo2e(0), '0 kg');
    assert.equal(formatKgCo2e(Number.NaN), '0 kg');
    assert.equal(formatKgCo2e(-3), '0 kg');
  });

  it('declines to make a comparison when the total is too small', () => {
    assert.equal(equivalentOf(0.5), null);
  });

  it('offers a concrete comparison for a real total', () => {
    const text = equivalentOf(17);
    assert.ok(text?.includes('km'), text ?? 'null');
  });
});
