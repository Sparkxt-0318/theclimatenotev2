/**
 * Shown when the app was built without a backend configured.
 *
 * This should never reach a reader — a release build cannot be produced without
 * the required values, because app.config.ts refuses. It exists so that a
 * developer running the app before setting up `.env` sees a sentence they can
 * act on rather than a blank screen or a crash.
 */

import { Text } from '@/components/text';
import { gutter, spacing, useTheme } from '@/theme';
import { StyleSheet, View } from 'react-native';

export function ConfigurationError() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text variant="title2" serif center>
        The app is not configured
      </Text>
      <Text variant="callout" tone="secondary" serif={false} center>
        This build has no backend connected, so there is nothing to show.
      </Text>
      <Text variant="footnote" tone="tertiary" serif={false} center>
        Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then
        rebuild. See store/SUBMISSION.md.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: gutter.screen,
    gap: spacing.md,
  },
});
