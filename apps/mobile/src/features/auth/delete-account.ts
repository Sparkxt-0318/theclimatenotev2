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
 * binary, so the work happens in a Supabase Edge Function. This module calls it
 * and then signs the device out.
 */

import { supabase } from '@/lib/supabase';
import { signOut } from './native-sign-in';

export type DeletionResult = { ok: true } | { ok: false; message: string };

export async function deleteAccount(): Promise<DeletionResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { ok: false, message: 'You are not signed in.' };

  const { data, error } = await supabase.functions.invoke<{ deleted: boolean }>('delete-account', {
    method: 'POST',
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
