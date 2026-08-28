/**
 * Typography primitives.
 *
 * One component per role rather than a `<Text style={...}>` free-for-all, so
 * the type ramp stays consistent and a change to `headline` lands everywhere.
 */

import { articleTextStyles, SERIF_FONT, textStyles, UI_FONT, useTheme } from '@/theme';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

type Variant = keyof typeof textStyles | keyof typeof articleTextStyles;
type Tone = 'primary' | 'secondary' | 'tertiary' | 'brand' | 'onBrand' | 'danger';

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
  /** Overrides the automatic serif/sans choice. */
  serif?: boolean;
  center?: boolean;
};

const ARTICLE_VARIANTS = new Set(Object.keys(articleTextStyles));

export function Text({
  variant = 'body',
  tone = 'primary',
  serif,
  center,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();

  const token =
    variant in textStyles
      ? textStyles[variant as keyof typeof textStyles]
      : articleTextStyles[variant as keyof typeof articleTextStyles];

  // Article variants default to the serif; interface variants to SF.
  const useSerif = serif ?? ARTICLE_VARIANTS.has(variant);

  const color: Record<Tone, string> = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    brand: colors.brand,
    onBrand: colors.textOnBrand,
    danger: colors.danger,
  };

  const base: TextStyle = {
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
    fontWeight: token.fontWeight,
    fontFamily: useSerif ? SERIF_FONT : UI_FONT,
    color: color[tone],
    ...(center ? { textAlign: 'center' as const } : null),
  };

  return <RNText style={[base, style]} {...rest} />;
}
