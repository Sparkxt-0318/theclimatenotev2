import { Text } from '@/components/text';
import { radius, spacing, useTheme } from '@/theme';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';

import { PressableScale } from './pressable-scale';

type Variant = 'primary' | 'secondary' | 'plain' | 'destructive';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Rendered to the left of the label, e.g. a provider mark. */
  icon?: React.ReactNode;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const surface: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: colors.brand },
    secondary: { backgroundColor: colors.surfaceSunken },
    plain: { backgroundColor: 'transparent' },
    destructive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  };

  const tone = {
    primary: 'onBrand',
    secondary: 'primary',
    plain: 'brand',
    destructive: 'danger',
  } as const;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[styles.base, surface[variant], inactive ? styles.inactive : null, style].filter(
        Boolean,
      ) as ViewStyle[]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' ? colors.textOnBrand : colors.brand}
            size="small"
          />
        ) : (
          <>
            {icon}
            <Text variant="headline" tone={tone[variant]} serif={false}>
              {label}
            </Text>
          </>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    // 50pt clears Apple's 44pt minimum touch target with room to spare.
    minHeight: 50,
    borderRadius: radius.lg,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  inactive: { opacity: 0.5 },
});
