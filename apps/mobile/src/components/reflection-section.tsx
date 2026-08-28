/**
 * "Write your climate note!"
 *
 * Three AI-generated actions, each grounded in this specific article and each
 * mapped to an emission factor, plus a fourth where the reader writes their own.
 *
 * Choosing an option creates a commitment they can then check off. Signing in
 * is required to SAVE, not to see — a reader who is not signed in still gets
 * the ideas, and is only asked for an account at the moment they try to keep
 * one.
 */

import { Button } from '@/components/button';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import type { ArticleLink, ReflectionOptionRow } from '@/features/articles/types';
import { useAuth } from '@/features/auth';
import { useCreateNote } from '@/features/notes/queries';
import { gutter, hairline, radius, spacing, useTheme } from '@/theme';
import { getFactor } from '@climatenote/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';

const PLATFORM_LABELS: Record<ArticleLink['platform'], string> = {
  instagram: 'Instagram',
  substack: 'Substack',
  medium: 'Medium',
  youtube: 'YouTube',
  other: 'Read elsewhere',
};

export function ReflectionSection({
  articleId,
  options,
  links,
}: {
  articleId: string;
  options: ReflectionOptionRow[];
  links: ArticleLink[];
}) {
  const { colors } = useTheme();
  const { isSignedIn } = useAuth();
  const createNote = useCreateNote();

  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [writingOwn, setWritingOwn] = useState(false);
  const [saved, setSaved] = useState(false);

  const canSave = writingOwn ? customText.trim().length >= 10 : selected !== null;

  async function save() {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    if (!canSave) return;

    const option = options.find((o) => o.id === selected);

    await createNote.mutateAsync(
      writingOwn
        ? { articleId, customText: customText.trim() }
        : {
            articleId,
            optionId: option?.id,
            factorKey: option?.factor_key,
            estimatedQuantity: option?.estimated_quantity,
          },
    );

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
  }

  if (saved) {
    return (
      <View style={[styles.container, styles.savedState]}>
        <Text variant="title2" serif center>
          Saved to your notes
        </Text>
        <Text variant="callout" tone="secondary" serif center>
          Check it off in the Notes tab as you go. It will show up in your impact
          for the week.
        </Text>
        <Button label="See my notes" variant="secondary" onPress={() => router.push('/notes')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text variant="articleH2" serif>
          Write your climate note!
        </Text>
        <Text variant="callout" tone="secondary" serif>
          Pick one thing to try this week. Small and specific beats big and vague.
        </Text>
      </View>

      <View style={styles.options}>
        {options.map((option) => {
          const isSelected = !writingOwn && selected === option.id;
          const factor = getFactor(option.factor_key);

          return (
            <PressableScale
              key={option.id}
              haptic
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${option.title}. ${option.detail}`}
              onPress={() => {
                setWritingOwn(false);
                setSelected(isSelected ? null : option.id);
              }}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? colors.brandSubtle : colors.surface,
                  borderColor: isSelected ? colors.brand : colors.border,
                },
              ]}
            >
              <View style={styles.optionHeader}>
                <View
                  style={[
                    styles.radio,
                    { borderColor: isSelected ? colors.brand : colors.borderStrong },
                  ]}
                >
                  {isSelected ? (
                    <View style={[styles.radioDot, { backgroundColor: colors.brand }]} />
                  ) : null}
                </View>

                <View style={styles.optionText}>
                  <Text variant="headline" serif={false}>
                    {option.title}
                  </Text>
                  <Text variant="subheadline" tone="secondary" serif={false}>
                    {option.detail}
                  </Text>

                  {factor ? (
                    <Text variant="caption" tone="tertiary" serif={false}>
                      Roughly {(factor.kgCo2ePerUnit * option.estimated_quantity).toFixed(1)} kg
                      CO₂e over a week
                    </Text>
                  ) : null}
                </View>
              </View>
            </PressableScale>
          );
        })}

        <PressableScale
          haptic
          accessibilityRole="radio"
          accessibilityState={{ selected: writingOwn }}
          accessibilityLabel="Write my own"
          onPress={() => {
            setWritingOwn(!writingOwn);
            setSelected(null);
          }}
          style={[
            styles.option,
            {
              backgroundColor: writingOwn ? colors.brandSubtle : colors.surface,
              borderColor: writingOwn ? colors.brand : colors.border,
            },
          ]}
        >
          <View style={styles.optionHeader}>
            <View
              style={[
                styles.radio,
                { borderColor: writingOwn ? colors.brand : colors.borderStrong },
              ]}
            >
              {writingOwn ? <View style={[styles.radioDot, { backgroundColor: colors.brand }]} /> : null}
            </View>
            <View style={styles.optionText}>
              <Text variant="headline" serif={false}>
                Write my own
              </Text>
              <Text variant="subheadline" tone="secondary" serif={false}>
                Something else this article made you want to do.
              </Text>
            </View>
          </View>

          {writingOwn ? (
            <TextInput
              value={customText}
              onChangeText={setCustomText}
              placeholder="This week I will…"
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={280}
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              accessibilityLabel="Your own climate note"
            />
          ) : null}
        </PressableScale>
      </View>

      <Button
        label={isSignedIn ? 'Save my note' : 'Sign in to save'}
        onPress={() => void save()}
        disabled={!canSave && isSignedIn}
        loading={createNote.isPending}
      />

      {createNote.isError ? (
        <Text variant="footnote" tone="danger" center serif={false}>
          We could not save that. Please try again.
        </Text>
      ) : null}

      {links.length > 0 ? (
        <View style={[styles.links, { borderTopColor: colors.border }]}>
          <Text variant="overline" tone="tertiary" serif={false}>
            ALSO PUBLISHED ON
          </Text>
          <View style={styles.linkRow}>
            {links.map((link) => (
              <PressableScale
                key={link.platform}
                accessibilityRole="link"
                accessibilityLabel={link.label ?? PLATFORM_LABELS[link.platform]}
                onPress={() => void Linking.openURL(link.url)}
                style={[styles.linkChip, { borderColor: colors.border }]}
              >
                <Text variant="footnote" tone="brand" serif={false}>
                  {link.label ?? PLATFORM_LABELS[link.platform]}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: gutter.screen, paddingTop: spacing.giant, gap: spacing.xl },
  savedState: { gap: spacing.lg, paddingTop: spacing.giant },
  heading: { gap: spacing.sm },
  options: { gap: spacing.md },
  option: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  optionHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  optionText: { flex: 1, gap: spacing.xs },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  input: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: hairline,
    padding: spacing.md,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  links: { borderTopWidth: hairline, paddingTop: spacing.xl, gap: spacing.md },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  linkChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
