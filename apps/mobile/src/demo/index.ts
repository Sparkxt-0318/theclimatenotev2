/**
 * Demo mode: the app running with no backend at all.
 *
 * Enabled with EXPO_PUBLIC_DEMO=1, so the whole app can be seen on a simulator
 * or device before Supabase, Google and Apple accounts exist:
 *
 *   EXPO_PUBLIC_DEMO=1 npx expo run:ios
 *
 * Only the query layer changes. Every screen, component, animation and style
 * is the production code path rendering this data instead of Supabase's, so
 * what you see is what the real app does.
 *
 * The app shows a banner while this is on, and `pnpm preflight` fails if it is
 * ever enabled in a release build — demo data must never be mistaken for a
 * reader's own.
 */

import { toIsoDate, type ArticleBlock } from '@climatenote/shared';

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO === '1';

const daysAgo = (n: number) => toIsoDate(new Date(Date.now() - n * 86_400_000));
const isoAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// ── The sample issue ────────────────────────────────────────────────────────

const BODY: ArticleBlock[] = [
  {
    type: 'paragraph',
    runs: [
      {
        text: 'Cattle farming is the single largest agricultural source of methane, a gas that traps roughly 80 times more heat than carbon dioxide over its first twenty years in the atmosphere.',
      },
    ],
  },
  { type: 'heading', level: 2, runs: [{ text: 'What the numbers say' }] },
  {
    type: 'paragraph',
    runs: [
      { text: 'Producing one kilogram of beef releases about ' },
      { text: '99 kilograms', bold: true },
      {
        text: ' of CO₂-equivalent, against under two kilograms for beans and lentils. The scale of that difference is easy to miss from a supermarket aisle.',
      },
    ],
  },
  {
    type: 'quote',
    runs: [
      {
        text: 'Livestock occupies 77% of global farmland while supplying only 18% of the world’s calories.',
      },
    ],
  },
  { type: 'heading', level: 3, runs: [{ text: 'Where the leverage is' }] },
  {
    type: 'paragraph',
    runs: [{ text: 'Three findings come up repeatedly in the research:' }],
  },
  {
    type: 'list',
    ordered: false,
    items: [
      [{ text: 'Beef and lamb dominate the footprint of a typical diet.' }],
      [{ text: 'Reducing beef specifically beats going fully vegetarian for most people.' }],
      [{ text: 'Food waste multiplies every upstream cost.' }],
    ],
  },
  {
    type: 'paragraph',
    runs: [
      {
        text: 'None of this requires anyone to become a vegetarian overnight. Researchers consistently find that reducing beef specifically, rather than meat in general, delivers most of the available benefit.',
      },
    ],
  },
];

export const DEMO_ARTICLES = [
  {
    id: 'demo-14',
    slug: 'the-cows-in-the-room',
    issue_number: 14,
    title: 'The cows in the room',
    dek: 'Livestock takes up most of the world’s farmland and returns a fraction of its food. That gap is the story.',
    published_at: isoAgo(2),
    reading_minutes: 6,
    cover_path: null,
    cover_alt: null,
    cover_blurhash: null,
    cover_credit: null,
  },
  {
    id: 'demo-13',
    slug: 'the-quiet-return-of-the-ozone-hole',
    issue_number: 13,
    title: 'The quiet return of the ozone hole',
    dek: 'The treaty that fixed it is still working. Something else is not.',
    published_at: isoAgo(9),
    reading_minutes: 5,
    cover_path: null,
    cover_alt: null,
    cover_blurhash: null,
    cover_credit: null,
  },
  {
    id: 'demo-12',
    slug: 'who-actually-pays-for-a-heatwave',
    issue_number: 12,
    title: 'Who actually pays for a heatwave',
    dek: 'The bill lands hardest on the people who did least to cause it.',
    published_at: isoAgo(16),
    reading_minutes: 7,
    cover_path: null,
    cover_alt: null,
    cover_blurhash: null,
    cover_credit: null,
  },
];

export const DEMO_FULL_ARTICLE = {
  ...DEMO_ARTICLES[0],
  body_blocks: BODY,
  article_assets: [],
  article_summaries: {
    problem:
      'Cows burp methane, a gas that heats the planet much faster than carbon dioxide does. Raising them also takes up more than three quarters of all farmland while producing less than a fifth of our food.',
    why_it_matters:
      'Land used for cattle is land not growing food or holding carbon in forests. Methane also acts fast, so cutting it now slows warming within our lifetimes rather than the next century.',
    what_we_can_do: [
      'Swapping beef for chicken cuts a meal’s footprint by about 90%.',
      'Countries are starting to price farm emissions the way they price fuel.',
      'Eating what you already bought beats almost any shopping change.',
    ],
    reading_grade: 8.2,
  },
  reflection_options: [
    {
      id: 'demo-option-1',
      position: 1,
      title: 'Swap two beef meals for beans this week',
      detail:
        'Beef is about 99 kg of CO₂e per kilogram against under two for beans — the single biggest lever in your week.',
      factor_key: 'meal.beef_to_plant',
      estimated_quantity: 2,
      difficulty: 'easy',
    },
    {
      id: 'demo-option-2',
      position: 2,
      title: 'Finish leftovers on three nights',
      detail: 'Every wasted meal also wastes the land and water behind it.',
      factor_key: 'food.waste_avoided',
      estimated_quantity: 1,
      difficulty: 'easy',
    },
    {
      id: 'demo-option-3',
      position: 3,
      title: 'Choose oat milk for a week of coffees',
      detail: 'Dairy carries a share of the same land and methane cost the article describes.',
      factor_key: 'food.dairy_milk_to_plant',
      estimated_quantity: 1,
      difficulty: 'easy',
    },
  ],
  article_links: [
    { platform: 'instagram' as const, url: 'https://instagram.com', label: null },
    { platform: 'substack' as const, url: 'https://substack.com', label: null },
  ],
};

// ── A week of a reader's activity ───────────────────────────────────────────

export const DEMO_NOTES = [
  {
    id: 'demo-note-1',
    article_id: 'demo-14',
    option_id: 'demo-option-1',
    custom_text: null,
    factor_key: 'meal.beef_to_plant',
    estimated_quantity: 2,
    created_at: isoAgo(6),
    archived_at: null,
    reflection_options: {
      title: 'Swap two beef meals for beans this week',
      detail: 'Beef is about 99 kg of CO₂e per kilogram against under two for beans.',
      factor_key: 'meal.beef_to_plant',
      estimated_quantity: 2,
    },
    articles: { title: 'The cows in the room', slug: 'the-cows-in-the-room' },
    note_completions: [0, 1, 3, 4, 6].map((n) => ({ completed_on: daysAgo(n) })),
  },
  {
    id: 'demo-note-2',
    article_id: 'demo-12',
    option_id: null,
    custom_text: 'Walk the short trip to school on three days',
    factor_key: 'transport.car_trip_avoided',
    estimated_quantity: 4,
    created_at: isoAgo(13),
    archived_at: null,
    reflection_options: null,
    articles: { title: 'Who actually pays for a heatwave', slug: 'who-actually-pays-for-a-heatwave' },
    note_completions: [1, 2, 5].map((n) => ({ completed_on: daysAgo(n) })),
  },
  {
    id: 'demo-note-3',
    article_id: 'demo-13',
    option_id: null,
    custom_text: 'Refill a bottle instead of buying one',
    factor_key: 'waste.reusable_bottle',
    estimated_quantity: 1,
    created_at: isoAgo(20),
    archived_at: null,
    reflection_options: null,
    articles: { title: 'The quiet return of the ozone hole', slug: 'the-quiet-return-of-the-ozone-hole' },
    note_completions: [2, 3, 4, 5, 6, 7, 8].map((n) => ({ completed_on: daysAgo(n) })),
  },
];

export const DEMO_TOTALS = {
  kg_co2e: 47.3,
  litres_water: 9240,
  kg_waste: 0.14,
  total_actions: 23,
  unquantified_actions: 1,
};

export const DEMO_CATEGORIES = [
  { category: 'food', kg_co2e: 34.1, actions: 12 },
  { category: 'transport', kg_co2e: 9.2, actions: 7 },
  { category: 'waste', kg_co2e: 3.9, actions: 4 },
];

/** Seven days ending today, with a realistic mix rather than a perfect week. */
export const DEMO_WEEK = [6, 5, 4, 3, 2, 1, 0].map((n) => {
  const completed = [3, 2, 3, 1, 2, 0, 2][6 - n] ?? 0;
  return { date: daysAgo(n), committed: 3, completed };
});

export const DEMO_STREAK = 5;
