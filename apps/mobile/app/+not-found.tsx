/**
 * Shown for any route that does not exist — a stale deep link, a renamed
 * article slug. Without this file expo-router falls back to its own unstyled
 * developer screen, which looks like a crash to a reader.
 */

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { gutter, spacing, useTheme } from '@/theme';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function NotFoundScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text variant="title2" serif center>
        That page has moved
      </Text>
      <Text variant="callout" tone="secondary" serif center>
        The link you followed does not point anywhere in the app any more.
      </Text>
      <Button label="Back to this week's issue" onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: gutter.screen,
    gap: spacing.lg,
  },
});
