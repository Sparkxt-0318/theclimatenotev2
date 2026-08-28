/**
 * Settings.
 *
 * Account deletion lives here and is not buried. App Store guideline 5.1.1(v)
 * requires it to be easy to find inside the app, and it is one of the most
 * common 2026 rejection causes. Offering only "deactivate" fails review.
 */

import { Button } from '@/components/button';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { deleteAccount, signOut, useAuth } from '@/features/auth';
import { gutter, hairline, radius, spacing, useTheme } from '@/theme';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://theclimatenote.com';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isSignedIn, session } = useAuth();
  const [deleting, setDeleting] = useState(false);

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'This permanently removes your account, every note you have written and your whole impact history. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const result = await deleteAccount();
            setDeleting(false);

            if (result.ok) {
              router.dismissAll();
              router.replace('/');
              return;
            }
            Alert.alert('Could not delete account', result.message);
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.xl,
        paddingBottom: insets.bottom + spacing.giant,
      }}
    >
      <View style={styles.header}>
        <Text variant="largeTitle" serif>
          Settings
        </Text>
        {isSignedIn ? (
          <Text variant="subheadline" tone="secondary" serif={false}>
            Signed in as {session?.user.email ?? 'your account'}
          </Text>
        ) : null}
      </View>

      <Section title="ABOUT">
        <Row label="How we calculate impact" onPress={() => router.push('/methodology')} />
        <Row label="Privacy policy" onPress={() => void Linking.openURL(`${SITE}/privacy`)} />
        <Row label="Terms of use" onPress={() => void Linking.openURL(`${SITE}/terms`)} />
        <Row label="Support" onPress={() => void Linking.openURL(`${SITE}/support`)} last />
      </Section>

      {isSignedIn ? (
        <View style={styles.account}>
          <Button
            label="Sign out"
            variant="secondary"
            onPress={async () => {
              await signOut();
              router.back();
            }}
          />

          <View style={styles.dangerZone}>
            <Button
              label="Delete my account"
              variant="destructive"
              loading={deleting}
              onPress={confirmDelete}
            />
            <Text variant="caption" tone="tertiary" serif={false} style={styles.dangerNote}>
              Deleting removes your account and all your data from our servers
              straight away. If you signed in with Apple, we also revoke that
              connection.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.account}>
          <Button label="Sign in" onPress={() => router.replace('/sign-in')} />
        </View>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="tertiary" serif={false} style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={[styles.group, { backgroundColor: colors.surfaceSunken }]}>{children}</View>
    </View>
  );
}

function Row({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.row,
        last ? null : { borderBottomWidth: hairline, borderBottomColor: colors.border },
      ].filter(Boolean) as object[]}
    >
      <Text variant="body" serif={false}>
        {label}
      </Text>
      <View style={[styles.chevron, { borderColor: colors.textTertiary }]} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: gutter.screen, paddingBottom: spacing.xxl, gap: spacing.xxs },
  section: { paddingHorizontal: gutter.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  sectionTitle: { paddingLeft: spacing.xs },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    minHeight: 50,
  },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  account: { paddingHorizontal: gutter.screen, gap: spacing.xxxl, paddingTop: spacing.lg },
  dangerZone: { gap: spacing.md },
  dangerNote: { paddingHorizontal: spacing.xs },
});
