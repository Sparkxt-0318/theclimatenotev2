/**
 * The large title at the top of each tab, with the Settings button.
 *
 * The Settings button is the reason this component exists. Settings holds
 * account deletion, which App Store guideline 5.1.1(v) requires to be reachable
 * from inside the app — and an earlier version of this app registered the
 * Settings route without ever linking to it, making deletion unreachable and the
 * submission un-passable.
 *
 * It appears on every tab rather than one, so there is no path through the app
 * where a reader (or a reviewer) cannot find it.
 */

import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { gutter, spacing, useTheme } from '@/theme';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

/**
 * A gear, built from primitives.
 *
 * Two rounded squares offset by 45 degrees make an eight-toothed silhouette,
 * and a punched-out centre completes it. Drawn rather than imported because the
 * app carries no icon library — see tab-icon.tsx for the same approach.
 */
function GearIcon({ color, background }: { color: string; background: string }) {
  return (
    <View style={styles.gear}>
      <View style={[styles.tooth, { backgroundColor: color }]} />
      <View style={[styles.tooth, styles.toothRotated, { backgroundColor: color }]} />
      <View style={[styles.gearCentre, { backgroundColor: background }]} />
    </View>
  );
}

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <Text variant="largeTitle" serif>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="subheadline" tone="secondary" serif={false}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Settings"
        accessibilityHint="Account, privacy and support"
        onPress={() => router.push('/settings')}
        style={[styles.button, { backgroundColor: colors.surfaceSunken }]}
      >
        <GearIcon color={colors.textSecondary} background={colors.surfaceSunken} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: gutter.screen,
    paddingBottom: spacing.xl,
  },
  titleBlock: { flex: 1, gap: spacing.xxs },
  button: {
    // 44pt is Apple's minimum touch target; the visible circle sits inside it.
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  gear: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  tooth: { position: 'absolute', width: 19, height: 19, borderRadius: 6 },
  toothRotated: { transform: [{ rotate: '45deg' }] },
  gearCentre: { width: 8, height: 8, borderRadius: 4 },
});
