import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  checkReflectionOption,
  checkReflectionSet,
  isGroundedInArticle,
  VAGUE_PHRASES,
} from './reflection-quality';
import type { ReflectionOption } from './ai';

/**
 * The article these fixtures are grounded in. Deliberately realistic: this is
 * roughly what a Climate Note issue about food systems reads like.
 */
const ARTICLE = `
Cattle farming is the single largest agricultural source of methane, a gas that
traps roughly 80 times more heat than carbon dioxide over its first twenty years
in the atmosphere. Producing one kilogram of beef releases about 99 kilograms of
CO2-equivalent, compared with under two kilograms for beans and lentils.

The scale is easy to miss from a supermarket aisle. Livestock occupies 77% of
global farmland while supplying only 18% of the world's calories. That gap is
the reason land use shows up in almost every serious decarbonisation plan.

None of this requires anyone to become a vegetarian overnight. Researchers
consistently find that reducing beef specifically, rather than meat in general,
delivers most of the available benefit.
`;

function option(overrides: Partial<ReflectionOption> = {}): ReflectionOption {
  return {
    title: 'Swap two beef meals for beans this week',
    detail:
      'The article puts beef at about 99 kg of CO2e per kilogram against under two for beans, so two swapped meals is the single biggest lever in your week.',
    sourceSpan:
      'Producing one kilogram of beef releases about 99 kilograms of CO2-equivalent, compared with under two kilograms for beans and lentils.',
    factorKey: 'meal.beef_to_plant',
    estimatedQuantity: 2,
    difficulty: 'easy',
    ...overrides,
  };
}

describe('a well-formed option', () => {
  it('passes every gate', () => {
    const result = checkReflectionOption(option(), ARTICLE);
    assert.ok(result.ok, JSON.stringify(result.issues, null, 2));
  });
});

describe('vagueness rejection', () => {
  it('rejects every phrase on the banned list', () => {
    // Each of these is something a model reliably writes when it has nothing
    // concrete to say. None may reach a reader.
    for (const phrase of VAGUE_PHRASES) {
      const result = checkReflectionOption(
        option({ title: `Swap two meals and ${phrase} each day`, detail: `Try to ${phrase}.` }),
        ARTICLE,
      );
      assert.ok(
        result.issues.some((i) => i.code === 'vague_phrase'),
        `"${phrase}" was not caught`,
      );
    }
  });

  it('rejects the canonical useless suggestion', () => {
    const result = checkReflectionOption(
      option({
        title: 'Be more mindful of your carbon footprint',
        detail: 'Think about the environment when you make choices this week.',
      }),
      ARTICLE,
    );
    assert.equal(result.ok, false);
  });

  it('rejects an action with no verb to perform', () => {
    const result = checkReflectionOption(
      option({ title: 'Sustainability in your daily food choices' }),
      ARTICLE,
    );
    assert.ok(result.issues.some((i) => i.code === 'no_action_verb'));
  });

  it('rejects an action a reader cannot tell they have completed', () => {
    const result = checkReflectionOption(
      option({
        title: 'Swap some beef meals for beans',
        detail: 'Beef is far more carbon intensive than beans, according to the article.',
      }),
      ARTICLE,
    );
    assert.ok(result.issues.some((i) => i.code === 'no_quantity'));
  });

  it('rejects a title too short to be specific', () => {
    const result = checkReflectionOption(option({ title: 'Skip beef' }), ARTICLE);
    assert.ok(result.issues.some((i) => i.code === 'too_short' || i.code === 'no_quantity'));
  });
});

describe('grounding in the article', () => {
  it('accepts a verbatim quote', () => {
    assert.ok(
      isGroundedInArticle(
        'Livestock occupies 77% of global farmland while supplying only 18%',
        ARTICLE,
      ),
    );
  });

  it('tolerates whitespace and smart-quote differences', () => {
    assert.ok(
      isGroundedInArticle(
        'Livestock   occupies 77% of global farmland   while supplying only 18%',
        ARTICLE,
      ),
    );
  });

  it('rejects a quote the model invented', () => {
    // The single most important check in this file. A plausible-sounding
    // sentence that is not in the article means the option is not grounded.
    assert.equal(
      isGroundedInArticle(
        'Cattle farming accounts for 40% of all global greenhouse gas emissions.',
        ARTICLE,
      ),
      false,
    );
  });

  it('rejects a quote too short to prove anything', () => {
    assert.equal(isGroundedInArticle('beef', ARTICLE), false);
  });

  it('flags an ungrounded option through the full check', () => {
    const result = checkReflectionOption(
      option({ sourceSpan: 'Nothing in this sentence appears anywhere in the source article.' }),
      ARTICLE,
    );
    assert.ok(result.issues.some((i) => i.code === 'ungrounded'));
  });
});

describe('plausibility', () => {
  it('rejects a quantity no one achieves in a week', () => {
    const result = checkReflectionOption(
      option({ title: 'Refill your bottle 300 times this week', estimatedQuantity: 300 }),
      ARTICLE,
    );
    assert.ok(result.issues.some((i) => i.code === 'quantity_implausible'));
  });

  it('rejects a factor key we cannot measure', () => {
    const result = checkReflectionOption(
      option({ factorKey: 'meal.invented_key' as ReflectionOption['factorKey'] }),
      ARTICLE,
    );
    assert.ok(result.issues.some((i) => i.code === 'unknown_factor'));
  });
});

describe('the set of three', () => {
  it('accepts three genuinely different actions', () => {
    const result = checkReflectionSet(
      [
        option(),
        option({
          title: 'Take the bus for three trips this week',
          detail:
            'The article ties land use and transport together in decarbonisation plans, and swapping three car trips is a measurable start.',
          sourceSpan: 'That gap is the reason land use shows up in almost every serious decarbonisation plan.',
          factorKey: 'transport.car_to_bus',
          estimatedQuantity: 12,
        }),
        option({
          title: 'Finish leftovers on two nights this week',
          detail:
            'Given how much land each calorie of livestock costs, throwing food away multiplies that waste.',
          sourceSpan: 'Livestock occupies 77% of global farmland while supplying only 18% of the world’s calories.',
          factorKey: 'food.waste_avoided',
          estimatedQuantity: 1,
        }),
      ],
      ARTICLE,
    );
    assert.ok(result.ok, JSON.stringify(result.perOption, null, 2));
  });

  it('rejects three rephrasings of the same idea', () => {
    // An article with one obvious takeaway tempts the model into offering the
    // same action three times. That is not a choice.
    const result = checkReflectionSet([option(), option(), option()], ARTICLE);
    assert.equal(result.ok, false);
    assert.ok(result.perOption[1]?.issues.some((i) => i.code === 'duplicate'));
    assert.ok(result.perOption[2]?.issues.some((i) => i.code === 'duplicate'));
  });
});
