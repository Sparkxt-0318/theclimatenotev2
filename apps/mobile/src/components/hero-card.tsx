import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import type { ArticleListItem } from '@/features/articles/types';
import { articleImageUrl } from '@/lib/supabase';
import { gutter, radius, spacing, useTheme } from '@/theme';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

/** The latest issue, given the space a lead story deserves. */
export function HeroCard({
  article,
  onPress,
}: {
  article: ArticleListItem;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Read ${article.title}`}
      style={styles.container}
    >
      {article.cover_path ? (
        <Image
          source={{ uri: articleImageUrl(article.cover_path) }}
          // The blurhash renders instantly from a handful of bytes, so the
          // card has its final shape before the photo arrives — no reflow.
          placeholder={article.cover_blurhash ? { blurhash: article.cover_blurhash } : undefined}
          transition={220}
          contentFit="cover"
          style={[styles.image, { backgroundColor: colors.skeleton }]}
          accessibilityLabel={article.cover_alt ?? undefined}
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.meta}>
          {article.issue_number !== null ? (
            <Text variant="overline" tone="brand" serif={false}>
              ISSUE {article.issue_number}
            </Text>
          ) : null}
          <Text variant="caption" tone="tertiary" serif={false}>
            {article.reading_minutes} min read
          </Text>
        </View>

        <Text variant="articleH2" serif>
          {article.title}
        </Text>

        {article.dek ? (
          <Text variant="callout" tone="secondary" serif numberOfLines={3}>
            {article.dek}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: gutter.screen },
  image: { width: '100%', aspectRatio: 3 / 2, borderRadius: radius.xl },
  body: { paddingTop: spacing.lg, gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
