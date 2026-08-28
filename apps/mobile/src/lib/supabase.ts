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

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail loudly at startup rather than with a confusing network error later.
  console.error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill them in.',
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

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Web has no keychain; it is only used by the screenshot renderer.
    storage: Platform.OS === 'web' ? AsyncStorage : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There is no OAuth redirect to parse, because there is no browser in the
    // flow at all. See src/features/auth/README.md.
    detectSessionInUrl: false,
  },
});

/** Public URL for an image in the article bucket. */
export function articleImageUrl(storagePath: string): string {
  return supabase.storage.from('article-images').getPublicUrl(storagePath).data.publicUrl;
}
