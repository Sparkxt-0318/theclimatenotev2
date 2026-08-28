export * from './colors';
export * from './typography';
export * from './layout';
export * from './contrast';
export * from './color-science';

import { darkColors, lightColors, type SemanticColors } from './colors';

export type ColorScheme = 'light' | 'dark';

export function colorsFor(scheme: ColorScheme): SemanticColors {
  return scheme === 'dark' ? darkColors : lightColors;
}
