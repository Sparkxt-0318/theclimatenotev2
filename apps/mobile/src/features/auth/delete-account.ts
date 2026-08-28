/**
 * Account deletion.
 *
 * App Store guideline 5.1.1(v) requires an account created in the app to be
 * deletable from inside the app. It is one of the most common rejection causes,
 * and there is a specific trap: an app offering Sign in with Apple must also
 * REVOKE the Apple token through Apple's REST API. Deleting the database row
 * alone fails review.
 *
 * That revocation needs Apple credentials, which must never ship in a client
 * binary, so the work happens in a Supabase Edge Function. This module gathers
 * a fresh Apple authorization code, calls the function, and signs the device
 * out.
 *
 * Deletion is never blocked by a revocation problem. An account a user cannot
 * delete is its own violation of the same guideline.
 */

import { supabase } from '@/lib/supabase';
import { getFreshAppleAuthorizationCode, signOut } from './native-sign-in';

export type DeletionResult = { ok: true } | { ok: false; message: string };

export async function deleteAccount(): Promise<DeletionResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return { ok: false, message: 'You are not signed in.' };

  // If this account was created with Apple, get a fresh authorization code so
  // the server can revoke the Sign in with Apple connection. Re-authenticating
  // before a destructive action is a familiar pattern, and it is the reliable
  // way to obtain a revocable token.
  //
  // A null here — the reader cancelled, or Apple errored — does NOT stop the
  // deletion. The server falls back to the token stored at sign-in, and
  // deletes either way.
  const appleIdentity = session.user.identities?.find((identity) => identity.provider === 'apple');

  // Pass the Apple subject this account was created with. If the device is
  // signed into a DIFFERENT Apple ID, the code we get back belongs to that
  // other account — revoking with it would disconnect the wrong person's app
  // while leaving this one connected.
  const expectedAppleSubject =
    (appleIdentity?.identity_data?.sub as string | undefined) ?? appleIdentity?.id;

  const appleAuthorizationCode = appleIdentity
    ? await getFreshAppleAuthorizationCode(expectedAppleSubject)
    : null;

  const { data, error } = await supabase.functions.invoke<{
    deleted: boolean;
    appleRevocation?: string;
  }>('delete-account', {
    method: 'POST',
    body: appleAuthorizationCode ? { appleAuthorizationCode } : {},
  });

  if (error) {
    return {
      ok: false,
      message: 'We could not delete your account just now. Please try again shortly.',
    };
  }

  if (!data?.deleted) {
    return { ok: false, message: 'Deletion did not complete. Please try again.' };
  }

  // The account is gone server-side; clear the device regardless of what
  // sign-out reports, so no stale session lingers in the keychain.
  await signOut().catch(() => undefined);
  return { ok: true };
}
