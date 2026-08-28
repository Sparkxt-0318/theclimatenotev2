/**
 * The Climate Note — colour system.
 *
 * This file is the single source of brand truth. The mobile app, the website,
 * the rendered article figures and the App Store screenshots all read from
 * here, so a change lands everywhere at once.
 *
 * ── Where these come from ───────────────────────────────────────────────────
 * Both ramps are anchored on the logo, sampled from the supplied artwork:
 *
 *   brand[300]   #A6C49F   the notebook cover — the identity colour
 *   neutral[700] #3B4347   the wordmark slate — the primary text colour
 *
 * Each sits within 0.4 deltaE of the sampled value, which is below the
 * threshold anyone can see. The remaining steps hold the same hue and are
 * spaced by perceptual lightness rather than by eye.
 *
 * ── Why the logo green is not the link colour ───────────────────────────────
 * The logo sage is light: 1.9:1 against white, where readable body text needs
 * 4.5:1. It cannot be used for text, links or small icons without failing
 * accessibility outright.
 *
 * So the two roles are separated. brand[300] stays the identity colour and
 * appears wherever it is decorative — fills, the impact calendar, illustration.
 * Interactive text uses brand[600], the lightest step that clears 4.5:1 while
 * still reading as the same green.
 *
 * In dark mode the roles converge: against a near-black page the literal logo
 * colour clears 9.7:1, so the app uses the exact brand green for links there.
 *
 * If these values need correcting, change them here and run
 *   pnpm --filter @climatenote/shared test
 * which fails if any text pairing drops below its required contrast.
 */

/**
 * Brand sage. Hue 109 degrees, matching the logo, with saturation rising
 * slightly through the darker steps so they do not drift towards grey.
 *
 * 300 is the logo colour. 600 is the accessible interactive colour.
 */
export const brand = {
  50: '#F4F7F3',
  100: '#E5EDE3',
  200: '#CBDCC7',
  /** The logo. Identity and decoration only — too light for text. */
  300: '#A6C49F',
  400: '#7AAA6F',
  500: '#5C9050',
  /** Lightest step that clears 4.5:1 on white. Links and buttons in light mode. */
  600: '#4A783F',
  700: '#396130',
  800: '#2A4A22',
  900: '#1C3417',
  950: '#13240F',
} as const;

/**
 * Neutrals, carrying the cool cast of the wordmark rather than a warm grey.
 * 700 is the wordmark colour itself.
 */
export const neutral = {
  0: '#FFFFFF',
  50: '#F9F9FA',
  100: '#EFF1F2',
  200: '#DFE3E5',
  300: '#C7CDD0',
  400: '#97A2A8',
  500: '#6B7981',
  600: '#515B61',
  /** The wordmark slate. Primary text. */
  700: '#3B4347',
  800: '#2C3134',
  900: '#1E2224',
  950: '#15181A',
} as const;

/**
 * Non-brand accents, used sparingly: status, warnings, chart series. Retuned
 * cooler to sit with the slate neutrals.
 */
export const accent = {
  sky: '#2C6E9E',
  amber: '#A87400',
  clay: '#A85038',
  slate: '#5A6B75',
} as const;

/**
 * Semantic tokens. Components should reference these, never the ramps above —
 * that is what makes dark mode a lookup rather than a pile of conditionals.
 */
export type SemanticColors = {
  /** Page background, behind everything. */
  background: string;
  /** Cards and sheets that sit on the background. */
  surface: string;
  /** A second elevation, e.g. a card inside a card. */
  surfaceRaised: string;
  /** Grouped-list background, the way iOS Settings looks. */
  surfaceSunken: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  /** Text placed on top of a filled brand colour. */
  textOnBrand: string;

  /** Hairline rules and card borders. */
  border: string;
  /** Stronger divider, e.g. between major sections. */
  borderStrong: string;

  /** Primary interactive colour: buttons, links, active tab. Must pass 4.5:1. */
  brand: string;
  /** Pressed state of the above. */
  brandPressed: string;
  /**
   * The logo colour, for decorative use only — never behind text. Large fills,
   * illustration, the calendar's brightest step.
   */
  brandIdentity: string;
  /** Tinted background for brand-coloured chips and callouts. */
  brandSubtle: string;
  /** Text or icon sitting on `brandSubtle`. */
  brandOnSubtle: string;

  success: string;
  warning: string;
  danger: string;

  /** Scrim behind modals. */
  scrim: string;
  /** Skeleton loading blocks. */
  skeleton: string;
};

export const lightColors: SemanticColors = {
  background: neutral[0],
  surface: neutral[0],
  surfaceRaised: neutral[0],
  surfaceSunken: neutral[100],

  textPrimary: neutral[800],
  textSecondary: neutral[600],
  textTertiary: neutral[500],
  textOnBrand: neutral[0],

  border: neutral[200],
  borderStrong: neutral[300],

  // Not brand[300]: the logo green is 1.9:1 on white and unreadable as a link.
  brand: brand[600],
  brandPressed: brand[700],
  brandIdentity: brand[300],
  brandSubtle: brand[50],
  brandOnSubtle: brand[700],

  success: brand[600],
  warning: accent.amber,
  danger: accent.clay,

  scrim: 'rgba(21, 24, 26, 0.4)',
  skeleton: neutral[200],
};

export const darkColors: SemanticColors = {
  background: neutral[950],
  surface: '#1C2023',
  surfaceRaised: '#252A2D',
  surfaceSunken: '#101315',

  textPrimary: '#F2F4F5',
  textSecondary: '#A9B3B8',
  textTertiary: '#8B959B',
  textOnBrand: '#0F1A0C',

  border: '#31383B',
  borderStrong: '#434B4F',

  // Against a near-black page the logo colour clears 9.7:1, so dark mode gets
  // to use the real brand green for interactive text.
  brand: brand[300],
  brandPressed: brand[200],
  brandIdentity: brand[300],
  brandSubtle: 'rgba(166, 196, 159, 0.14)',
  brandOnSubtle: brand[200],

  success: brand[300],
  warning: '#D9A441',
  danger: '#D9836B',

  scrim: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#262B2E',
};

/**
 * Five-step scale for the impact calendar. Index 0 means "nothing logged that
 * day"; index 4 means every commitment for the day was completed.
 *
 * Steps are spaced by perceptual lightness (~12-27 deltaE apart) rather than by
 * eye, so "greener means I did more" reads as an even progression. Saturation
 * is held near the logo's own 24%, which keeps the scale sage rather than the
 * vivid grass green a naive ramp produces.
 *
 * Step 2 in light mode and step 4 in dark mode both land on the logo colour.
 */
export const calendarScaleLight = ['#F0F2F0', '#D2E1CE', '#A3C59B', '#65A257', '#437637'] as const;

export const calendarScaleDark = ['#1B1F21', '#2D4927', '#446D3B', '#629656', '#9EBF97'] as const;

/**
 * Categorical palette for article figures, one per colour scheme.
 *
 * Two palettes rather than one because a single set forced to clear 3:1 against
 * both white and near-black is trapped in a narrow lightness band, and with
 * lightness unavailable as a discriminator no six colours survive red-green
 * colour blindness.
 *
 * Every pair is at least 26 deltaE apart in the worst case across normal
 * vision, deuteranopia and protanopia, and every colour clears 3:1 against its
 * background. `theme.test.ts` enforces both, so substituting a colour here
 * fails the build rather than quietly breaking a chart.
 *
 * Order is deliberate. Under deuteranopia the discriminable axes reduce to
 * blue-versus-yellow plus lightness, so a six-colour set has to spend lightness
 * to stay separable — which is why the fifth and sixth entries are deeper than
 * a designer would pick freely. The first three carry almost every real chart
 * and are the ones tuned for looks.
 *
 * Beyond six categories colour stops working as an encoding — bin the tail into
 * "other" or switch to small multiples instead of extending this list.
 */
export const chartSeriesLight = [
  brand[600], // #4A783F sage — always first, so single-series charts are on-brand
  '#216C9E', // blue
  '#AA7409', // ochre
  '#70435E', // plum
  '#4B1002', // oxblood
  '#499DAA', // teal
] as const;

export const chartSeriesDark = [
  brand[300], // #A6C49F the logo sage
  '#7FB5DA', // blue
  '#D7A542', // ochre
  '#BC6C4F', // clay
  '#875C8A', // plum
  '#B5ECEF', // pale teal
] as const;

export function chartSeriesFor(scheme: 'light' | 'dark'): readonly string[] {
  return scheme === 'dark' ? chartSeriesDark : chartSeriesLight;
}
