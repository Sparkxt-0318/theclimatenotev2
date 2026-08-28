/**
 * Notes — the reader's commitments and their history.
 *
 * Checking one off is the single most-repeated interaction in the app, so it is
 * one tap with haptic confirmation and an immediate visual change. Nothing to
 * confirm, nothing to undo through a menu — tapping again removes it.
 */

import { Button } from '@/components/button';
import { PressableScale } from '@/components/pressable-scale';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/text';
import { DEMO_MODE } from '@/demo';
import { useAuth } from '@/features/auth';
import { useCompleteNote, useNotes, useUncompleteNote, type NoteRow } from '@/features/notes/queries';
import { gutter, radius, spacing, useTheme } from '@/theme';
import { toIsoDate } from '@climatenote/shared';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { data: notes, isLoading } = useNotes();

  const complete = useCompleteNote();
  const uncomplete = useUncompleteNote();
  const today = toIsoDate(new Date());

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
        <ScreenHeader title="Your notes" />

        <View style={styles.signedOut}>
          <Text variant="callout" tone="secondary" serif center>
            Pick an action at the end of any article and it will show up here to
            check off through the week.
          </Text>
          <Button label="Sign in" onPress={() => router.push('/sign-in')} />
          <Button label="Browse articles" variant="plain" onPress={() => router.push('/')} />
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const active = (notes ?? []).filter((note) => note.archived_at === null);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.giant,
      }}
    >
      <ScreenHeader title="Your notes" subtitle="Tap to check something off for today." />

      {active.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="headline" center serif>
            Nothing here yet
          </Text>
          <Text variant="subheadline" tone="secondary" center serif={false}>
            Read this week's issue and pick an action at the end.
          </Text>
          <Button label="Read the latest issue" variant="secondary" onPress={() => router.push('/')} />
        </View>
      ) : (
        <View style={styles.list}>
          {active.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              doneToday={note.note_completions.some((c) => c.completed_on === today)}
              onToggle={(done) => {
                if (done) {
                  uncomplete.mutate({ noteId: note.id });
                } else {
                  complete.mutate({
                    noteId: note.id,
                    factorKey: note.factor_key ?? note.reflection_options?.factor_key ?? null,
                    quantity:
                      note.estimated_quantity ??
                      note.reflection_options?.estimated_quantity ??
                      1,
                  });
                }
              }}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function NoteCard({
  note,
  doneToday,
  onToggle,
}: {
  note: NoteRow;
  doneToday: boolean;
  onToggle: (doneToday: boolean) => void;
}) {
  const { colors } = useTheme();
  const title = note.reflection_options?.title ?? note.custom_text ?? 'Your note';
  const timesDone = note.note_completions.length;

  return (
    <PressableScale
      haptic
      accessibilityRole="checkbox"
      accessibilityState={{ checked: doneToday }}
      accessibilityLabel={`${title}. ${doneToday ? 'Done today' : 'Not done today'}`}
      onPress={() => onToggle(doneToday)}
      style={[
        styles.card,
        {
          backgroundColor: doneToday ? colors.brandSubtle : colors.surface,
          borderColor: doneToday ? colors.brand : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: doneToday ? colors.brand : colors.borderStrong,
            backgroundColor: doneToday ? colors.brand : 'transparent',
          },
        ]}
      >
        {doneToday ? (
          <View style={[styles.tick, { borderColor: colors.textOnBrand }]} />
        ) : null}
      </View>

      <View style={styles.cardText}>
        <Text variant="headline" serif={false}>
          {title}
        </Text>

        {note.articles ? (
          <Text variant="footnote" tone="tertiary" serif={false} numberOfLines={1}>
            From “{note.articles.title}”
          </Text>
        ) : null}

        {timesDone > 0 ? (
          <Text variant="caption" tone="brand" serif={false}>
            Done {timesDone} {timesDone === 1 ? 'time' : 'times'}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  signedOut: { paddingHorizontal: gutter.screen, gap: spacing.lg, paddingTop: spacing.xxxl },
  empty: { padding: spacing.huge, gap: spacing.lg },
  list: { paddingHorizontal: gutter.screen, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  cardText: { flex: 1, gap: spacing.xs },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tick: {
    width: 11,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '-45deg' }],
    marginTop: -3,
  },
});
