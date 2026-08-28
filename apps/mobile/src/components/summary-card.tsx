/**
 * "The short version" — the AI summary, at the end of the article.
 *
 * Sits in a tinted card so it reads as a companion to the piece rather than
 * part of the author's text. It is labelled as AI-written: a climate
 * publication that blurs the line between its journalism and its machine output
 * is trading on credibility it has not earned.
 */

import { Text } from '@/components/text';
import type { ArticleSummary } from '@/features/articles/types';
import { gutter, radius, spacing, useTheme } from '@/theme';
import { StyleSheet, View } from 'react-native';

export function SummaryCard({ summary }: { summary: ArticleSummary }) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.card, { backgroundColor: colors.brandSubtle }]}
      accessibilityLabel="The short version, a plain-language summary"
    >
      <Text variant="overline" tone="brand" serif={false}>
        THE SHORT VERSION
      </Text>

      <View style={styles.section}>
        <Text variant="footnote" tone="brand" serif={false} style={styles.label}>
          What is going wrong
        </Text>
        <Text variant="callout" serif>
          {summary.problem}
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="footnote" tone="brand" serif={false} style={styles.label}>
          Why it matters
        </Text>
        <Text variant="callout" serif>
          {summary.why_it_matters}
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="footnote" tone="brand" serif={false} style={styles.label}>
          What can be done
        </Text>
        {summary.what_we_can_do.map((item, index) => (
          <View key={index} style={styles.bulletRow}>
            <View style={[styles.bullet, { backgroundColor: colors.brand }]} />
            <Text variant="callout" serif style={styles.bulletText}>
              {item}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="caption2" tone="tertiary" serif={false} style={styles.disclosure}>
        Summarised by AI from the article above, and checked by an editor before
        publishing. The article itself is written by a person.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: gutter.screen,
    marginTop: spacing.xxxl,
    padding: spacing.xxl,
    borderRadius: radius.xl,
    gap: spacing.xl,
  },
  section: { gap: spacing.sm },
  label: { textTransform: 'uppercase', letterSpacing: 0.4 },
  bulletRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  bulletText: { flex: 1 },
  disclosure: { paddingTop: spacing.sm },
});
