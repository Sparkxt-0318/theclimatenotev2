/**
 * The article reader.
 *
 * Where most of the design effort goes. Three things carry the "feels like
 * Apple" quality, and all three run on the UI thread as Reanimated worklets so
 * they never stutter while data loads:
 *
 *  - the cover parallaxes at half scroll speed and over-scales when pulled down
 *  - the compact title fades in exactly as the big one leaves
 *  - a hairline progress rule tracks how far through the piece you are
 *
 * Reduced motion is respected throughout: the effects are pinned rather than
 * animated when the reader has asked the system for less movement.
 */

import { ArticleBody } from '@/components/article-body';
import { PressableScale } from '@/components/pressable-scale';
import { ReflectionSection } from '@/components/reflection-section';
import { SummaryCard } from '@/components/summary-card';
import { Text } from '@/components/text';
import { keyAsset, useArticle } from '@/features/articles/queries';
import { articleImageUrl } from '@/lib/supabase';
import { gutter, hairline, spacing, useTheme } from '@/theme';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COVER_HEIGHT = 340;

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const scrollY = useSharedValue(0);
  const contentHeight = useSharedValue(1);
  const viewportHeight = useSharedValue(1);

  const { data: article, isLoading, isError } = useArticle(slug);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    contentHeight.value = event.contentSize.height;
    viewportHeight.value = event.layoutMeasurement.height;
  });

  /** Cover moves at half speed, and grows rather than tearing on overscroll. */
  const coverStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    const translateY = interpolate(
      scrollY.value,
      [-COVER_HEIGHT, 0, COVER_HEIGHT],
      [-COVER_HEIGHT / 2, 0, COVER_HEIGHT / 2],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(scrollY.value, [-COVER_HEIGHT, 0], [2.2, 1], Extrapolation.CLAMP);
    return { transform: [{ translateY }, { scale }] };
  });

  /** The compact header appears only once the real title has scrolled away. */
  const compactHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [COVER_HEIGHT - 140, COVER_HEIGHT - 60],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const progressStyle = useAnimatedStyle(() => {
    const scrollable = Math.max(1, contentHeight.value - viewportHeight.value);
    const progress = Math.min(1, Math.max(0, scrollY.value / scrollable));
    return { width: progress * width };
  });

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (isError || !article) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text variant="headline" center>
          We could not open this issue
        </Text>
        <PressableScale onPress={() => router.back()} style={styles.backLink}>
          <Text variant="callout" tone="brand" serif={false}>
            Go back
          </Text>
        </PressableScale>
      </View>
    );
  }

  const cover = keyAsset(article);
  const summary = article.article_summaries;
  const showCoverAtTop = cover !== null && cover.placement !== 'middle';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.giant }}
        showsVerticalScrollIndicator={false}
      >
        {showCoverAtTop ? (
          <View style={styles.coverClip}>
            <Animated.View style={coverStyle}>
              <Image
                source={{ uri: articleImageUrl(cover.storage_path) }}
                placeholder={cover.blurhash ? { blurhash: cover.blurhash } : undefined}
                transition={280}
                contentFit="cover"
                style={[styles.cover, { backgroundColor: colors.skeleton }]}
                accessibilityLabel={cover.alt_text}
              />
            </Animated.View>
          </View>
        ) : (
          <View style={{ height: insets.top + spacing.giant }} />
        )}

        <View style={styles.header}>
          {article.issue_number !== null ? (
            <Text variant="overline" tone="brand" serif={false}>
              ISSUE {article.issue_number}
            </Text>
          ) : null}

          <Text variant="articleTitle" serif>
            {article.title}
          </Text>

          {article.dek ? (
            <Text variant="articleDek" tone="secondary" serif>
              {article.dek}
            </Text>
          ) : null}

          <Text variant="footnote" tone="tertiary" serif={false}>
            {new Date(article.published_at).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            · {article.reading_minutes} min read
          </Text>

          {showCoverAtTop && cover.credit ? (
            <Text variant="caption" tone="tertiary" serif={false}>
              Image: {cover.credit}
            </Text>
          ) : null}
        </View>

        <ArticleBody
          blocks={article.body_blocks}
          midArticleAsset={cover?.placement === 'middle' ? cover : null}
        />

        {summary ? <SummaryCard summary={summary} /> : null}

        <ReflectionSection
          articleId={article.id}
          options={article.reflection_options}
          links={article.article_links}
        />
      </Animated.ScrollView>

      {/* Reading progress: a hairline, not a bar. Present when you look for it,
          invisible when you are reading. */}
      <Animated.View
        style={[styles.progress, { backgroundColor: colors.brand }, progressStyle]}
        pointerEvents="none"
      />

      <Animated.View
        style={[
          styles.compactHeader,
          compactHeaderStyle,
          {
            paddingTop: insets.top,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
        pointerEvents="none"
      >
        <Text variant="headline" numberOfLines={1} serif={false} style={styles.compactTitle}>
          {article.title}
        </Text>
      </Animated.View>

      <PressableScale
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[
          styles.backButton,
          { top: insets.top + spacing.sm, backgroundColor: colors.scrim },
        ]}
      >
        <View style={[styles.chevron, { borderColor: '#FFFFFF' }]} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  backLink: { padding: spacing.md },
  coverClip: { height: COVER_HEIGHT, overflow: 'hidden' },
  cover: { width: '100%', height: COVER_HEIGHT },
  header: {
    paddingHorizontal: gutter.article,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  progress: { position: 'absolute', top: 0, left: 0, height: 2 },
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: hairline,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.giant,
  },
  compactTitle: { textAlign: 'center' },
  backButton: {
    position: 'absolute',
    left: gutter.screen,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
});
