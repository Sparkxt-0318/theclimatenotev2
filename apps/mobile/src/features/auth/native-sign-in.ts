/**
 * Native sign-in for Apple and Google.
 *
 * Read src/features/auth/README.md before editing. In short: both providers
 * present a NATIVE system sheet, hand us an ID token, and we exchange that
 * token with Supabase over plain HTTPS. Nothing here opens a browser, because
 * a browser redirect is what got the previous submission rejected.
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type SignInProvider = 'apple' | 'google';

export type SignInResult =
  | { status: 'signed-in' }
  /** The user backed out of the system sheet. Not an error; show nothing. */
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

let googleConfigured = false;

function configureGoogle(): void {
  if (googleConfigured) return;

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  if (!iosClientId || !webClientId) {
    throw new Error(
      'Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and ' +
        'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.',
    );
  }

  GoogleSignin.configure({
    iosClientId,
    // Supabase validates the ID token against the WEB client ID, so it must be
    // requested as the audience even though this is an iOS app. Omitting it is
    // the most common cause of "Invalid audience" from signInWithIdToken.
    webClientId,
    scopes: ['openid', 'email', 'profile'],
    offlineAccess: false,
  });
  googleConfigured = true;
}

/**
 * A cryptographically random nonce, and its SHA-256 hash.
 *
 * Apple receives the hash and embeds it in the identity token; Supabase
 * receives the raw value and checks that hashing it reproduces what Apple
 * signed. Sending the same form to both makes the exchange fail.
 */
async function createNoncePair(): Promise<{ raw: string; hashed: string }> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const raw = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Sign in with Apple.
 *
 * Apple returns the user's name only on the FIRST authorisation and only if
 * they choose to share it, so we write it to their profile the one time we see
 * it. Every later sign-in returns null there, which is expected.
 */
export async function signInWithApple(): Promise<SignInResult> {
  try {
    const { raw, hashed } = await createNoncePair();

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });

    if (!credential.identityToken) {
      return { status: 'error', message: 'Apple did not return a sign-in token.' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: raw,
    });

    if (error) return { status: 'error', message: error.message };

    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (fullName && data.user) {
      // Best effort: a failure here must not fail the sign-in itself.
      await supabase
        .from('profiles')
        .update({ display_name: fullName })
        .eq('id', data.user.id)
        .then(undefined, () => undefined);
    }

    // Hand Apple's single-use authorization code to the server so it can be
    // exchanged for a refresh token. That token is the ONLY way to revoke the
    // Sign in with Apple connection when the account is later deleted, which
    // App Review requires (guideline 5.1.1(v)).
    //
    // The code expires in about five minutes and cannot be re-requested, so
    // this has to happen now. It is awaited rather than fired and forgotten:
    // if it fails, deletion will fail later, and we would rather know at
    // sign-in than at the moment a user asks to be removed.
    if (credential.authorizationCode) {
      await registerAppleCredential(credential.authorizationCode);
    } else {
      console.warn('[auth] Apple returned no authorizationCode; deletion will not be able to revoke.');
    }

    return { status: 'signed-in' };
  } catch (error) {
    if (isAppleCancellation(error)) return { status: 'cancelled' };
    return { status: 'error', message: describeError(error) };
  }
}

/** Sign in with Google via the native account sheet. */
export async function signInWithGoogle(): Promise<SignInResult> {
  try {
    configureGoogle();
    await GoogleSignin.hasPlayServices();

    const response = await GoogleSignin.signIn();

    // v13+ returns a discriminated result rather than throwing on cancel.
    if (response.type === 'cancelled') return { status: 'cancelled' };

    const idToken = response.data?.idToken;
    if (!idToken) {
      return { status: 'error', message: 'Google did not return a sign-in token.' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) return { status: 'error', message: error.message };
    return { status: 'signed-in' };
  } catch (error) {
    if (isGoogleCancellation(error)) return { status: 'cancelled' };
    return { status: 'error', message: describeError(error) };
  }
}

/**
 * Exchanges Apple's authorization code for a stored refresh token.
 *
 * Deliberately non-fatal to sign-in: a reader who cannot reach this endpoint
 * should still get into the app. It logs loudly because the consequence is
 * deferred — the failure shows up later as an account that cannot be deleted.
 */
async function registerAppleCredential(authorizationCode: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke<{ stored: boolean }>('apple-link', {
      body: { authorizationCode },
    });

    if (error || !data?.stored) {
      console.error('[auth] Could not store the Apple credential:', error?.message ?? 'not stored');
    }
  } catch (error) {
    console.error('[auth] Could not store the Apple credential:', error);
  }
}

/**
 * Re-prompts Sign in with Apple purely to obtain a fresh authorization code.
 *
 * Used immediately before account deletion. Apple's authorization code is
 * single-use and short-lived, so the one captured at sign-in may be long spent;
 * asking again is the reliable way to get a token we can revoke with.
 *
 * This does NOT touch the Supabase session — the credential is used only for
 * the code. Returns null if the reader cancels, which is not an error: deletion
 * proceeds regardless, because a user who asked to be deleted gets deleted.
 */
export async function getFreshAppleAuthorizationCode(): Promise<string | null> {
  try {
    if (!(await AppleAuthentication.isAvailableAsync())) return null;

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    return credential.authorizationCode ?? null;
  } catch (error) {
    if (!isAppleCancellation(error)) {
      console.error('[auth] Could not re-authenticate with Apple for deletion:', error);
    }
    return null;
  }
}

export async function signOut(): Promise<void> {
  // Clear Google's own cached account too, or the next sign-in silently reuses
  // the previous account without showing the picker.
  await Promise.allSettled([
    supabase.auth.signOut(),
    GoogleSignin.signOut().catch(() => undefined),
  ]);
}

// ── Error shaping ───────────────────────────────────────────────────────────

function isAppleCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ERR_REQUEST_CANCELED'
  );
}

function isGoogleCancellation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const code = (error as { code?: string }).code;
  return code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS;
}

/**
 * Turns a provider error into something a reader can act on.
 *
 * Raw SDK messages are developer-facing and often alarming ("DEVELOPER_ERROR"),
 * so anything we do not specifically recognise becomes a plain apology rather
 * than leaking internals into the UI.
 */
function describeError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google sign-in is unavailable on this device.';
  }
  if (code === 'ERR_REQUEST_NOT_HANDLED' || code === 'ERR_REQUEST_UNKNOWN') {
    return 'Apple sign-in could not start. Check that you are signed in to iCloud, then try again.';
  }
  if (error instanceof Error && /network|timeout|offline/i.test(error.message)) {
    return 'No connection. Check your internet and try again.';
  }
  return 'Something went wrong signing in. Please try again.';
}
