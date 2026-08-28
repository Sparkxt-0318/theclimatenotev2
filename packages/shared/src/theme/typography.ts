/**
 * Type system.
 *
 * The UI ramp mirrors Apple's built-in text styles so the app feels native
 * without shipping a custom font. Article body copy deliberately breaks from
 * that and uses a serif at a larger size — long-form reading is the one place
 * where matching the rest of iOS would make the app worse.
 */

/** Font stacks. The mobile app maps `ui` to the platform system font. */
export const fontFamily = {
  /** SF Pro on iOS. Interface text, buttons, labels, numbers. */
  ui: 'System',
  /**
   * Article body. New York is the iOS system serif and pairs with SF; Georgia
   * is the fallback everywhere else, including the web build.
   */
  serif: "'New York', Georgia, 'Times New Roman', serif",
  /** Data readouts where digits must not jitter as values change. */
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type TextStyleToken = {
  fontSize: number;
  lineHeight: number;
  /** Tracking in points, matching Apple's optical sizing. */
  letterSpacing: number;
  fontWeight: (typeof fontWeight)[keyof typeof fontWeight];
};

/**
 * Interface ramp. Names follow Apple's text styles so the intent of each is
 * obvious at the call site.
 */
export const textStyles = {
  largeTitle: { fontSize: 34, lineHeight: 41, letterSpacing: 0.37, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, letterSpacing: 0.36, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, letterSpacing: 0.35, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, letterSpacing: 0.38, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, letterSpacing: -0.41, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, letterSpacing: -0.41, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, letterSpacing: -0.32, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, letterSpacing: -0.24, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, letterSpacing: -0.08, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0, fontWeight: '400' },
  caption2: { fontSize: 11, lineHeight: 13, letterSpacing: 0.07, fontWeight: '400' },
  /** All-caps section labels above a group of cards. */
  overline: { fontSize: 12, lineHeight: 16, letterSpacing: 0.6, fontWeight: '600' },
} as const satisfies Record<string, TextStyleToken>;

/**
 * Article ramp. Larger and looser than the UI ramp: the line height on
 * `articleBody` is ~1.6x, which is what makes a long piece comfortable on a
 * phone rather than a wall of text.
 */
export const articleTextStyles = {
  articleTitle: { fontSize: 32, lineHeight: 39, letterSpacing: -0.4, fontWeight: '700' },
  articleDek: { fontSize: 19, lineHeight: 27, letterSpacing: -0.2, fontWeight: '400' },
  articleH2: { fontSize: 24, lineHeight: 31, letterSpacing: -0.3, fontWeight: '700' },
  articleH3: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2, fontWeight: '600' },
  articleBody: { fontSize: 19, lineHeight: 31, letterSpacing: 0, fontWeight: '400' },
  articleQuote: { fontSize: 21, lineHeight: 32, letterSpacing: -0.2, fontWeight: '400' },
  articleCaption: { fontSize: 13, lineHeight: 19, letterSpacing: 0, fontWeight: '400' },
} as const satisfies Record<string, TextStyleToken>;

/**
 * Reading speed used to show "6 min read". 200 wpm is a deliberate
 * under-estimate for a teenage audience reading science writing on a phone;
 * over-promising how quick an article is erodes trust in the number.
 */
export const WORDS_PER_MINUTE = 200;

export function estimateReadingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}
