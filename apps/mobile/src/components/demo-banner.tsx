/**
 * Marks the app as running on sample data.
 *
 * Demo mode exists so the app can be seen before any backend exists, which
 * means someone will eventually screenshot it. This makes it impossible to
 * mistake seeded numbers for a real reader's.
 */

import { DEMO_MODE } from '@/demo';
import { Text } from '@/components/text';
import { spacing, useTheme } from '@/theme';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function DemoBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!DEMO_MODE) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.warning, paddingTop: insets.top }]}
      pointerEvents="none"
    >
      <Text variant="caption" serif={false} center style={styles.text}>
        DEMO — sample data, no account required
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: spacing.xs },
  text: { color: '#FFFFFF', fontWeight: '600' },
});
