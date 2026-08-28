/**
 * Sign-in.
 *
 * Presented as a sheet from wherever the reader was, never as a wall in front
 * of the app. Two things here are deliberate and should not be "simplified":
 *
 * 1. Both buttons trigger NATIVE system sheets. No browser opens at any point.
 *    That is the fix for the previous App Store rejection — see
 *    src/features/auth/README.md.
 *
 * 2. "Not now" always dismisses. Every article in the app is readable without
 *    an account, and App Review specifically checks that content is not gated
 *    behind registration it does not need (guideline 5.1.1).
 */

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { isAppleSignInAvailable, signInWithApple, signInWithGoogle } from '@/features/auth';
import { gutter, radius, spacing, useTheme } from '@/theme';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Pending = 'apple' | 'google' | null;

export default function SignInScreen() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  async function run(provider: 'apple' | 'google') {
    setPending(provider);
    setError(null);

    const result = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();

    setPending(null);
    if (result.status === 'signed-in') {
      router.back();
      return;
    }
    // A cancellation is the reader changing their mind, not a failure. Showing
    // an error for it would be scolding them for using the dismiss button.
    if (result.status === 'error') setError(result.message);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.xxl },
      ]}
    >
      <View style={styles.header}>
        <Text variant="largeTitle" serif center>
          Keep your notes
        </Text>
        <Text variant="callout" tone="secondary" center style={styles.subtitle}>
          An account saves the actions you commit to and tracks what they add up
          to. Reading stays free either way.
        </Text>
      </View>

      <View style={styles.benefits}>
        {[
          'Save the climate notes you write',
          'Check off actions and build a streak',
          'See what your week actually saved',
        ].map((benefit) => (
          <View key={benefit} style={styles.benefitRow}>
            <View style={[styles.dot, { backgroundColor: colors.brand }]} />
            <Text variant="subheadline" tone="secondary" serif={false} style={styles.benefitText}>
              {benefit}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            // Apple requires their mark on a contrasting ground; follow the
            // system appearance rather than our brand colours.
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radius.lg}
            style={styles.appleButton}
            onPress={() => void run('apple')}
          />
        ) : null}

        <Button
          label="Continue with Google"
          variant="secondary"
          loading={pending === 'google'}
          disabled={pending !== null}
          onPress={() => void run('google')}
        />

        {error ? (
          <Text variant="footnote" tone="danger" center serif={false} style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Button
          label="Not now"
          variant="plain"
          disabled={pending !== null}
          onPress={() => router.back()}
        />
      </View>

      <Text variant="caption" tone="tertiary" center serif={false} style={styles.legal}>
        We store your email and the notes you write. Nothing is sold or shared,
        and you can delete your account and everything in it from Settings at
        any time.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: gutter.screen, flexGrow: 1, justifyContent: 'space-between' },
  header: { gap: spacing.md },
  subtitle: { paddingHorizontal: spacing.md },
  benefits: { gap: spacing.lg, paddingVertical: spacing.xxxl },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3 },
  benefitText: { flex: 1 },
  actions: { gap: spacing.md },
  appleButton: { height: 50, width: '100%' },
  error: { paddingHorizontal: spacing.lg },
  legal: { paddingTop: spacing.xxl, paddingHorizontal: spacing.md },
});
