/**
 * Impact — what the reader's actions add up to.
 *
 * The headline number is deliberately hedged ("about"), and the methodology is
 * one tap away. These are population averages with real uncertainty, and
 * presenting them as precise measurements of one person's life would be a lie
 * that a climate publication in particular cannot afford.
 */

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { WeekCalendar } from '@/components/week-calendar';
import { DEMO_MODE } from '@/demo';
import { useAuth } from '@/features/auth';
import {
  useImpactByCategory,
  useImpactTotals,
  useStreak,
  useWeekProgress,
} from '@/features/impact/queries';
import { gutter, radius, spacing, useTheme } from '@/theme';
import { equivalentOf, formatKgCo2e } from '@climatenote/shared';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  transport: 'Getting around',
  energy: 'Energy at home',
  waste: 'Waste',
  water: 'Water',
  consumption: 'Things you buy',
  // Actions we log but decline to put a carbon figure on.
  unmeasured: 'Not measured in carbon',
};

export default function ImpactScreen() {
  const { colors, chartSeries } = useTheme();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();

  const totals = useImpactTotals();
  const week = useWeekProgress();
  const streak = useStreak();
  const categories = useImpactByCategory();

  if (!isSignedIn && !DEMO_MODE) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top + spacing.lg,
        }}
      >
        {/* The header stays when signed out, so Settings — and with it the
            privacy, terms and support links — is reachable without an account. */}
        <ScreenHeader title="Your impact" />

        <View style={styles.signedOut}>
          <Text variant="callout" tone="secondary" serif center>
            Sign in to track the actions you commit to and see what they add up
            to over a week.
          </Text>
          <Button label="Sign in" onPress={() => router.push('/sign-in')} />
        </View>
      </View>
    );
  }

  if (totals.isLoading || week.isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const kg = totals.data?.kg_co2e ?? 0;
  const comparison = equivalentOf(kg);
  const maxCategory = Math.max(1, ...(categories.data ?? []).map((c) => c.kg_co2e));

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.giant,
      }}
    >
      <ScreenHeader title="Your impact" />

      <View style={[styles.hero, { backgroundColor: colors.brandSubtle }]}>
        <Text variant="overline" tone="brand" serif={false}>
          SAVED SO FAR
        </Text>
        <Text variant="largeTitle" tone="brand" serif={false} style={styles.heroNumber}>
          about {formatKgCo2e(kg)}
        </Text>
        <Text variant="subheadline" tone="secondary" serif={false}>
          CO₂e across {totals.data?.total_actions ?? 0}{' '}
          {totals.data?.total_actions === 1 ? 'action' : 'actions'}
          {comparison ? ` — ${comparison}` : ''}
        </Text>

        {(totals.data?.unquantified_actions ?? 0) > 0 ? (
          <Text variant="caption" tone="tertiary" serif={false}>
            Plus {totals.data?.unquantified_actions}{' '}
            {totals.data?.unquantified_actions === 1 ? 'action' : 'actions'} that carbon maths
            cannot honestly measure — they still count.
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="title3" serif={false}>
            This week
          </Text>
          {(streak.data ?? 0) > 0 ? (
            <Text variant="subheadline" tone="brand" serif={false}>
              {streak.data} day streak
            </Text>
          ) : null}
        </View>
        <WeekCalendar days={week.data ?? []} />
      </View>

      {(categories.data ?? []).length > 0 ? (
        <View style={styles.section}>
          <Text variant="title3" serif={false}>
            Where it came from
          </Text>
          <View style={styles.categories}>
            {(categories.data ?? []).map((row, index) => (
              <View key={row.category} style={styles.categoryRow}>
                <View style={styles.categoryLabel}>
                  <Text variant="subheadline" serif={false}>
                    {CATEGORY_LABELS[row.category] ?? row.category}
                  </Text>
                  <Text variant="footnote" tone="tertiary" serif={false}>
                    {formatKgCo2e(row.kg_co2e)}
                  </Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.surfaceSunken }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: chartSeries[index % chartSeries.length],
                        width: `${Math.max(4, (row.kg_co2e / maxCategory) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Button
          label="How we calculate this"
          variant="secondary"
          onPress={() => router.push('/methodology')}
        />
        <Text variant="caption" tone="tertiary" serif={false} style={styles.disclaimer}>
          These are estimates from published averages, not measurements of your
          life. Real numbers vary with where you live and how you live. We show
          the sources so you can check them.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  signedOut: { paddingHorizontal: gutter.screen, gap: spacing.lg, paddingTop: spacing.xxxl },
  hero: {
    marginHorizontal: gutter.screen,
    padding: spacing.xxl,
    borderRadius: radius.xl,
    gap: spacing.xs,
  },
  heroNumber: { fontWeight: '700' },
  section: { paddingHorizontal: gutter.screen, paddingTop: spacing.xxxl, gap: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  categories: { gap: spacing.lg },
  categoryRow: { gap: spacing.sm },
  categoryLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  disclaimer: { paddingTop: spacing.sm },
});
