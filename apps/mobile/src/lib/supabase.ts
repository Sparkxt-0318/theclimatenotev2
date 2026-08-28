/**
 * Supabase client.
 *
 * Sessions live in the iOS keychain via expo-secure-store rather than
 * AsyncStorage, because a refresh token is a bearer credential for the user's
 * account and AsyncStorage is plain unencrypted files.
 *
 * SecureStore caps a value at 2048 bytes and a Supabase session can exceed
 * that once an ID token carries a few claims, so values are chunked.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Whether the app was built with a usable backend.
 *
 * `createClient` THROWS on an empty url or key, and this module is imported on
 * the launch path, so a build missing these values used to crash before the
 * first frame — a white screen with no explanation.
 *
 * A release build can no longer be produced without them (app.config.ts refuses
 * to build), so this only guards local development. It degrades to a legible
 * error screen instead of a crash, because "the app is misconfigured" is far
 * more useful than a blank device.
 */
export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

if (!isSupabaseConfigured) {
  console.error(
    '[The Climate Note] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env and fill them in. See store/SUBMISSION.md.',
  );
}

const CHUNK_SIZE = 1800;
const chunkKey = (key: string, index: number) => `${key}.${index}`;
const countKey = (key: string) => `${key}.count`;

/**
 * Keychain-backed storage that transparently splits oversized values.
 *
 * Writing the chunk count last means a crash mid-write leaves a stale count
 * pointing at chunks that still exist, rather than a count that promises
 * chunks which were never written.
 */
const secureStorage: SupportedStorage = {
  async getItem(key) {
    const rawCount = await SecureStore.getItemAsync(countKey(key));
    if (rawCount === null) return SecureStore.getItemAsync(key);

    const count = Number.parseInt(rawCount, 10);
    if (!Number.isFinite(count) || count <= 0) return null;

    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );
    // A missing chunk means a corrupt session; treat it as signed out rather
    // than handing the SDK a truncated token.
    if (parts.some((part) => part === null)) return null;
    return parts.join('');
  },

  async setItem(key, value) {
    await this.removeItem(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
  },

  async removeItem(key) {
    const rawCount = await SecureStore.getItemAsync(countKey(key));
    if (rawCount !== null) {
      const count = Number.parseInt(rawCount, 10);
      if (Number.isFinite(count)) {
        await Promise.all(
          Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
        );
      }
      await SecureStore.deleteItemAsync(countKey(key));
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// Placeholder values keep createClient from throwing at module load. Every
// request against them fails, which the configuration screen explains rather
// than leaving the reader with a blank app.
export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL : 'https://unconfigured.invalid',
  isSupabaseConfigured ? SUPABASE_ANON_KEY : 'unconfigured',
  {
    auth: {
      // Web has no keychain; it is only used by the screenshot renderer.
      storage: Platform.OS === 'web' ? AsyncStorage : secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      // There is no OAuth redirect to parse, because there is no browser in the
      // flow at all. See src/features/auth/README.md.
      detectSessionInUrl: false,
    },
  },
);

/** Public URL for an image in the article bucket. */
export function articleImageUrl(storagePath: string): string {
  return supabase.storage.from('article-images').getPublicUrl(storagePath).data.publicUrl;
}
