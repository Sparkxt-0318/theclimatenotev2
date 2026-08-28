import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import type { ArticleListItem } from '@/features/articles/types';
import { articleImageUrl } from '@/lib/supabase';
import { gutter, radius, spacing, useTheme } from '@/theme';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

export function ArchiveRow({
  article,
  onPress,
}: {
  article: ArticleListItem;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  const published = new Date(article.published_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Read ${article.title}`}
      style={styles.row}
    >
      <View style={styles.text}>
        <Text variant="caption" tone="tertiary" serif={false}>
          {published} · {article.reading_minutes} min
        </Text>
        <Text variant="title3" serif numberOfLines={2}>
          {article.title}
        </Text>
      </View>

      {article.cover_path ? (
        <Image
          source={{ uri: articleImageUrl(article.cover_path) }}
          placeholder={article.cover_blurhash ? { blurhash: article.cover_blurhash } : undefined}
          transition={180}
          contentFit="cover"
          style={[styles.thumb, { backgroundColor: colors.skeleton }]}
          // Decorative here: the title beside it already names the article, so
          // announcing the image twice would just be noise in VoiceOver.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: gutter.screen,
    paddingVertical: spacing.lg,
  },
  text: { flex: 1, gap: spacing.xs },
  thumb: { width: 76, height: 76, borderRadius: radius.md },
});
