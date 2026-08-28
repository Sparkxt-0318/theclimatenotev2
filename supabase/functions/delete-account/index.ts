/**
 * Account deletion.
 *
 * App Store guideline 5.1.1(v) requires an account created in the app to be
 * deletable from inside the app. There is a specific trap that fails review:
 * an app offering Sign in with Apple must ALSO revoke the Apple token through
 * Apple's REST API. Deleting the database row alone is not enough — the app
 * keeps appearing under Settings -> Sign-In & Security -> Sign in with Apple,
 * and reviewers check.
 *
 * The refresh token needed for that comes from `apple-link`, which exchanges
 * Apple's single-use authorization code at sign-in time. Reading it off the
 * Supabase identity does not work: `identity_data` holds ID-token claims only,
 * and the native `signInWithIdToken` flow never yields a provider refresh token
 * at all. An earlier version of this function looked there, found nothing, and
 * silently skipped revocation on every deletion while reporting success.
 *
 * Order matters: revoke with Apple FIRST, then delete locally. Deleting our
 * record first would leave the user with an Apple connection we can no longer
 * clean up, because the token would be gone.
 *
 * ── Deletion is unconditional ──────────────────────────────────────────────
 * Revocation is attempted hard, but never blocks deletion. An earlier version
 * refused to delete when no refresh token was stored, which meant a single
 * failed `apple-link` at sign-in left a user with an account they could never
 * remove from inside the app. That is its own 5.1.1(v) violation, and a
 * data-protection problem besides — the guideline requires that deletion be
 * POSSIBLE. A lingering Apple connection is the lesser failure, and it is made
 * rare by the app re-authenticating to obtain a fresh authorization code
 * immediately before calling this.
 *
 * Deploy with: supabase functions deploy delete-account
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  CORS,
  exchangeAuthorizationCode,
  json,
  readAppleConfig,
  revokeRefreshToken,
} from '../_shared/apple.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not signed in' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // The user being deleted is whoever is making the request — never an id from
  // the body, which would let anyone delete anyone.
  const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await asUser.auth.getUser();

  if (userError || !user) return json({ error: 'Not signed in' }, 401);

  // The app re-authenticates with Apple just before calling this, so it can
  // hand over a fresh single-use code. That is the path that succeeds; the
  // stored token is the fallback for when the reader declines the prompt.
  let appleAuthorizationCode: string | undefined;
  try {
    ({ appleAuthorizationCode } = (await request.json()) as {
      appleAuthorizationCode?: string;
    });
  } catch {
    // No body is fine — fall back to the stored token.
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const usedApple = user.identities?.some((identity) => identity.provider === 'apple') ?? false;

  // ── Revoke with Apple, best effort ────────────────────────────────────────
  let revocation: 'revoked' | 'not-needed' | 'failed' = 'not-needed';

  if (usedApple) {
    revocation = 'failed';
    const config = readAppleConfig();

    if ('error' in config) {
      console.error(`Cannot revoke for ${user.id}: ${config.error}`);
    } else {
      // 1. A code the app just obtained. Freshest and most reliable.
      let refreshToken: string | undefined;

      if (appleAuthorizationCode) {
        const exchanged = await exchangeAuthorizationCode(config, appleAuthorizationCode);
        if (exchanged.ok) refreshToken = exchanged.refreshToken;
        else console.error(`Fresh code exchange failed for ${user.id}: ${exchanged.reason}`);
      }

      // 2. The token stored by apple-link at sign-in.
      if (!refreshToken) {
        const { data: credential } = await admin
          .from('apple_credentials')
          .select('refresh_token')
          .eq('user_id', user.id)
          .maybeSingle();
        refreshToken = credential?.refresh_token as string | undefined;
      }

      if (refreshToken) {
        const revoked = await revokeRefreshToken(config, refreshToken);
        if (revoked.ok) revocation = 'revoked';
        else console.error(`Apple revocation failed for ${user.id}: ${revoked.reason}`);
      } else {
        console.error(`No Apple token available for ${user.id}; deleting without revoking.`);
      }
    }
  }

  // Deliberately NOT gated on `revocation`. A user who asked to be deleted is
  // deleted. A failure here is an operational problem for us to see in the
  // logs, not a reason to hold someone's account hostage.
  if (revocation === 'failed') {
    console.error(
      `Deleting ${user.id} WITHOUT revoking Sign in with Apple. If this appears ` +
        `regularly, the apple-link function is broken and App Review will notice.`,
    );
  }

  // ── Delete everything ─────────────────────────────────────────────────────
  // Deleting the auth user cascades: profiles, climate_notes, note_completions
  // and apple_credentials all reference auth.users with ON DELETE CASCADE.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error(`User deletion failed for ${user.id}: ${deleteError.message}`);
    return json({ deleted: false, error: 'Deletion failed. Please try again.' }, 500);
  }

  console.log(`Deleted account ${user.id} (Apple revocation: ${revocation})`);
  return json({ deleted: true, appleRevocation: revocation });
});
