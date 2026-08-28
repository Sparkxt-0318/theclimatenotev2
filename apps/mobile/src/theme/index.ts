/**
 * Theme access for the app.
 *
 * Wraps the shared token package with iOS specifics: the system font stack and
 * the reduced-motion preference. Components call `useTheme()` and never import
 * raw colour ramps, so dark mode is a lookup rather than a pile of conditionals.
 */

import {
  articleTextStyles,
  colorsFor,
  calendarScaleDark,
  calendarScaleLight,
  chartSeriesFor,
  duration,
  gutter,
  hairline,
  pressScale,
  radius,
  shadow,
  spacing,
  spring,
  textStyles,
  type SemanticColors,
} from '@climatenote/shared/theme';
import { Platform, useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * Interface font. `System` resolves to SF Pro on iOS, which is what makes the
 * app feel like part of the OS rather than a website in a shell.
 */
export const UI_FONT = Platform.select({ ios: 'System', default: 'System' });

/**
 * Article body font.
 *
 * New York is Apple's system serif and pairs with SF by design. Long-form
 * reading is the one place where matching the rest of iOS would make the app
 * worse, so the article deliberately breaks from the interface ramp.
 */
export const SERIF_FONT = Platform.select({ ios: 'New York', default: 'Georgia' });

export type Theme = {
  colors: SemanticColors;
  scheme: 'light' | 'dark';
  calendarScale: readonly string[];
  chartSeries: readonly string[];
  /** True when the reader has asked the system to reduce motion. */
  reduceMotion: boolean;
};

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const reduceMotion = useReducedMotion();

  return {
    scheme,
    colors: colorsFor(scheme),
    calendarScale: scheme === 'dark' ? calendarScaleDark : calendarScaleLight,
    chartSeries: chartSeriesFor(scheme),
    reduceMotion,
  };
}

export {
  articleTextStyles,
  duration,
  gutter,
  hairline,
  pressScale,
  radius,
  shadow,
  spacing,
  spring,
  textStyles,
};
