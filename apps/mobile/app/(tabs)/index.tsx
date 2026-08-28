/**
 * Read — the issue feed.
 *
 * The newest issue gets a full-bleed hero; the archive runs beneath it as
 * compact rows. A weekly publication has one thing you want right now and a
 * back catalogue you browse occasionally, and the layout says so.
 */

import { ArchiveRow } from '@/components/archive-row';
import { HeroCard } from '@/components/hero-card';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { useArticleFeed } from '@/features/articles/queries';
import { useAuth } from '@/features/auth';
import { gutter, spacing, useTheme } from '@/theme';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReadScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useArticleFeed();

  const [latest, ...archive] = data ?? [];

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, padding: gutter.screen }]}>
        <Text variant="headline" center>
          We could not load the latest issues
        </Text>
        <Text variant="subheadline" tone="secondary" center serif={false} style={styles.errorBody}>
          Check your connection and pull down to try again.
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={archive}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
      style={{ backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.textTertiary}
        />
      }
      ListHeaderComponent={
        <View style={{ paddingTop: insets.top + spacing.lg }}>
          <ScreenHeader
            title="The Climate Note"
            subtitle={isSignedIn ? 'This week' : 'A weekly read on the climate'}
          />

          {latest ? (
            <HeroCard
              article={latest}
              onPress={() => router.push(`/article/${latest.slug}`)}
            />
          ) : (
            <View style={styles.empty}>
              <Text variant="headline" center>
                The first issue is on its way
              </Text>
              <Text variant="subheadline" tone="secondary" center serif={false}>
                Check back soon.
              </Text>
            </View>
          )}

          {archive.length > 0 ? (
            <Text variant="overline" tone="tertiary" serif={false} style={styles.sectionLabel}>
              EARLIER ISSUES
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <ArchiveRow article={item} onPress={() => router.push(`/article/${item.slug}`)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBody: { marginTop: spacing.sm },
  sectionLabel: {
    paddingHorizontal: gutter.screen,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.md,
  },
  empty: { padding: spacing.huge, gap: spacing.sm },
});
