/**
 * A pressable that springs slightly inward while held.
 *
 * The scale runs on the UI thread through a Reanimated worklet, so it stays
 * smooth even while the JS thread is busy fetching. That responsiveness under
 * load is most of what makes an interface feel native rather than animated.
 */

import { pressScale, spring, useTheme } from '@/theme';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Light haptic tick on press. Off by default; use for commitments. */
  haptic?: boolean;
};

export function PressableScale({
  children,
  style,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const { reduceMotion } = useTheme();

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        // Honour the system setting rather than overriding it: for some readers
        // motion is a genuine accessibility problem, not a preference.
        if (!reduceMotion) scale.value = withSpring(pressScale, spring.snappy);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, spring.snappy);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
