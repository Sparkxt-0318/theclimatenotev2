/**
 * The Climate Note — colour system.
 *
 * This file is the single source of brand truth. The mobile app, the website,
 * the rendered article figures and the App Store screenshots all read from
 * here, so a change lands everywhere at once.
 *
 * ── Swapping in the real brand green ────────────────────────────────────────
 * `brand` below is a placeholder forest green, chosen to sit close to a typical
 * logo green while meeting WCAG contrast. When the logo file arrives, replace
 * the eleven values in `brand` with the ramp generated from its green and run
 *   pnpm --filter @climatenote/shared test
 * which fails if any text pairing drops below its required contrast ratio.
 * Nothing else needs to change.
 */

/** Brand green ramp. 500 is the primary brand colour. */
export const brand = {
  50: '#EDF7F1',
  100: '#D2EDDF',
  200: '#A5DABF',
  300: '#6FC29B',
  400: '#3DA678',
  500: '#1B7F52',
  600: '#146842',
  700: '#105336',
  800: '#0C3F29',
  900: '#082A1C',
  950: '#051810',
} as const;

/** Neutrals. Warmed very slightly so large areas of text feel less clinical. */
export const neutral = {
  0: '#FFFFFF',
  50: '#FAFAF9',
  100: '#F4F4F2',
  200: '#E7E7E4',
  300: '#D3D3CF',
  400: '#A5A5A0',
  500: '#78786F',
  600: '#57574F',
  700: '#3D3D37',
  800: '#26261F',
  900: '#17170F',
  950: '#0D0D08',
} as const;

/** Non-brand accents, used sparingly: status, warnings, chart series. */
export const accent = {
  sky: '#2C7BB6',
  amber: '#C77700',
  clay: '#B4553C',
  slate: '#5A6B7B',
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

  /** Primary interactive colour: buttons, links, active tab. */
  brand: string;
  /** Pressed state of the above. */
  brandPressed: string;
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

  textPrimary: neutral[900],
  textSecondary: neutral[600],
  textTertiary: neutral[500],
  textOnBrand: neutral[0],

  border: neutral[200],
  borderStrong: neutral[300],

  brand: brand[500],
  brandPressed: brand[600],
  brandSubtle: brand[50],
  brandOnSubtle: brand[700],

  success: brand[600],
  warning: accent.amber,
  danger: accent.clay,

  scrim: 'rgba(13, 13, 8, 0.4)',
  skeleton: neutral[200],
};

export const darkColors: SemanticColors = {
  background: neutral[950],
  surface: '#141410',
  surfaceRaised: '#1E1E18',
  surfaceSunken: '#0A0A06',

  textPrimary: '#F5F5F1',
  textSecondary: '#A8A8A0',
  textTertiary: '#8A8A81',
  textOnBrand: '#04150D',

  border: '#2A2A23',
  borderStrong: '#3A3A31',

  // Lifted for dark backgrounds: brand[500] is far too dark to read on near-black.
  brand: brand[300],
  brandPressed: brand[200],
  brandSubtle: 'rgba(111, 194, 155, 0.14)',
  brandOnSubtle: brand[200],

  success: brand[300],
  warning: '#E8A33D',
  danger: '#D97D66',

  scrim: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#22221C',
};

/**
 * Five-step green scale for the impact calendar. Index 0 means "nothing logged
 * that day"; index 4 means every commitment for the day was completed.
 *
 * The steps are spaced by perceptual lightness (roughly 16 units of L* apart,
 * ~17-22 deltaE) rather than by eye, so "greener means I did more" reads as an
 * even progression instead of bunching at one end of the scale.
 */
export const calendarScaleLight = ['#F1F1EE', '#BDE6D3', '#78CCA5', '#36A370', '#1C764C'] as const;

export const calendarScaleDark = ['#1C1C16', '#175035', '#22764F', '#349D6C', '#6DC79D'] as const;

/**
 * Categorical palette for article figures, one per colour scheme.
 *
 * Two palettes rather than one because a single set forced to clear 3:1 against
 * both white and near-black is trapped in a ~20-unit lightness band, and with
 * lightness unavailable as a discriminator no six colours survive red-green
 * colour blindness. Splitting them frees each palette to use lightness.
 *
 * Every pair is at least 25 deltaE apart in the worst case across normal
 * vision, deuteranopia and protanopia, and every colour clears 3:1 against its
 * background. `theme.test.ts` enforces both, so reordering or substituting a
 * colour here will fail the build rather than quietly break a chart.
 *
 * Beyond six categories, colour stops working as an encoding — bin the tail
 * into "other" or switch to small multiples instead of extending this list.
 */
export const chartSeriesLight = [
  brand[500], // #1B7F52 green — always first, so single-series charts are on-brand
  '#1867B7', // blue
  '#AE7502', // ochre
  '#843006', // clay
  '#773E79', // purple
  '#08A0C6', // teal
] as const;

export const chartSeriesDark = [
  brand[300], // #6FC29B green
  '#6EB0EA', // blue
  '#DDA73C', // ochre
  '#C26A49', // clay
  '#8F5B97', // purple
  '#7AD7DE', // teal
] as const;

export function chartSeriesFor(scheme: 'light' | 'dark'): readonly string[] {
  return scheme === 'dark' ? chartSeriesDark : chartSeriesLight;
}
