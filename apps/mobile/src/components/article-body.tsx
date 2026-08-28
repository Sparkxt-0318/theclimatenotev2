/**
 * Renders the author's blocks as native text.
 *
 * Native rather than a WebView on purpose: real text selection, real Dynamic
 * Type, real VoiceOver, and no white flash on load. The block list is authored
 * content copied verbatim from the .docx — nothing here is model-generated.
 */

import { Text } from '@/components/text';
import type { ArticleAsset } from '@/features/articles/types';
import { articleImageUrl } from '@/lib/supabase';
import { gutter, radius, spacing, useTheme } from '@/theme';
import type { ArticleBlock, TextRun } from '@climatenote/shared';
import { Image } from 'expo-image';
import { Fragment } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

function Runs({ runs }: { runs: TextRun[] }) {
  const { colors } = useTheme();

  return (
    <>
      {runs.map((run, index) => (
        <Text
          // Runs have no stable id and never reorder within a paragraph, so the
          // index is a safe key here.
          key={index}
          variant="articleBody"
          serif
          style={[
            run.bold ? styles.bold : null,
            run.italic ? styles.italic : null,
            run.href ? { color: colors.brand } : null,
          ]}
          onPress={run.href ? () => void Linking.openURL(run.href as string) : undefined}
          accessibilityRole={run.href ? 'link' : undefined}
        >
          {run.text}
        </Text>
      ))}
    </>
  );
}

function Block({ block }: { block: ArticleBlock }) {
  const { colors } = useTheme();

  switch (block.type) {
    case 'heading':
      return (
        <Text
          variant={block.level === 2 ? 'articleH2' : 'articleH3'}
          serif
          style={block.level === 2 ? styles.h2 : styles.h3}
          accessibilityRole="header"
        >
          {block.runs.map((run) => run.text).join('')}
        </Text>
      );

    case 'paragraph':
      return (
        <Text variant="articleBody" serif style={styles.paragraph}>
          <Runs runs={block.runs} />
        </Text>
      );

    case 'quote':
      return (
        <View style={[styles.quote, { borderLeftColor: colors.brand }]}>
          <Text variant="articleQuote" serif tone="secondary">
            <Runs runs={block.runs} />
          </Text>
          {block.attribution ? (
            <Text variant="footnote" tone="tertiary" serif={false} style={styles.attribution}>
              {block.attribution}
            </Text>
          ) : null}
        </View>
      );

    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item, index) => (
            <View key={index} style={styles.listItem}>
              {block.ordered ? (
                <Text variant="articleBody" tone="tertiary" serif style={styles.marker}>
                  {index + 1}.
                </Text>
              ) : (
                <View style={[styles.bullet, { backgroundColor: colors.textTertiary }]} />
              )}
              <Text variant="articleBody" serif style={styles.listText}>
                <Runs runs={item} />
              </Text>
            </View>
          ))}
        </View>
      );

    case 'image':
      return (
        <View style={styles.figure}>
          <Image
            source={{ uri: articleImageUrl(block.storagePath) }}
            contentFit="cover"
            transition={220}
            style={[styles.figureImage, { backgroundColor: colors.skeleton }]}
            accessibilityLabel={block.alt}
          />
          {block.caption ? (
            <Text variant="articleCaption" tone="tertiary" serif={false} style={styles.caption}>
              {block.caption}
            </Text>
          ) : null}
        </View>
      );

    case 'divider':
      return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
  }
}

export function ArticleBody({
  blocks,
  midArticleAsset,
}: {
  blocks: ArticleBlock[];
  /** Placed at the natural midpoint when the pipeline chose `middle`. */
  midArticleAsset: ArticleAsset | null;
}) {
  const { colors } = useTheme();

  // Insert the key figure at a paragraph boundary near the middle, never
  // between a heading and the text it introduces.
  const midpoint = midArticleAsset ? findInsertionPoint(blocks) : -1;

  return (
    <View style={styles.body}>
      {blocks.map((block, index) => (
        <Fragment key={index}>
          {index === midpoint && midArticleAsset ? (
            <View style={styles.figure}>
              <Image
                source={{ uri: articleImageUrl(midArticleAsset.storage_path) }}
                placeholder={
                  midArticleAsset.blurhash ? { blurhash: midArticleAsset.blurhash } : undefined
                }
                contentFit="cover"
                transition={280}
                style={[styles.figureImage, { backgroundColor: colors.skeleton }]}
                accessibilityLabel={midArticleAsset.alt_text}
              />
              {midArticleAsset.credit ? (
                <Text variant="articleCaption" tone="tertiary" serif={false} style={styles.caption}>
                  {midArticleAsset.credit}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Block block={block} />
        </Fragment>
      ))}
    </View>
  );
}

/**
 * Finds a paragraph boundary near the middle of the article.
 *
 * Dropping an image immediately after a heading orphans it from the text it
 * introduces, so headings are skipped past.
 */
function findInsertionPoint(blocks: ArticleBlock[]): number {
  const target = Math.floor(blocks.length / 2);
  for (let offset = 0; offset < blocks.length; offset += 1) {
    for (const index of [target + offset, target - offset]) {
      if (index <= 0 || index >= blocks.length) continue;
      const previous = blocks[index - 1];
      if (blocks[index]?.type === 'paragraph' && previous?.type !== 'heading') return index;
    }
  }
  return -1;
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter.article },
  paragraph: { marginBottom: spacing.xl },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  h2: { marginTop: spacing.xxl, marginBottom: spacing.md },
  h3: { marginTop: spacing.xl, marginBottom: spacing.sm },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: spacing.lg,
    marginVertical: spacing.xl,
    gap: spacing.sm,
  },
  attribution: { marginTop: spacing.xs },
  list: { marginBottom: spacing.xl, gap: spacing.md },
  listItem: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  listText: { flex: 1 },
  marker: { minWidth: 22 },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 13 },
  figure: { marginVertical: spacing.xxl, gap: spacing.sm },
  figureImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  caption: { paddingHorizontal: spacing.xs },
  divider: { height: 1, marginVertical: spacing.xxl, alignSelf: 'center', width: 64 },
});
