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
 * Deploy with: supabase functions deploy delete-account
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { CORS, json, readAppleConfig, revokeRefreshToken } from '../_shared/apple.ts';

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

  const admin = createClient(supabaseUrl, serviceKey);
  const usedApple = user.identities?.some((identity) => identity.provider === 'apple') ?? false;

  // ── Revoke with Apple first ───────────────────────────────────────────────
  if (usedApple) {
    const config = readAppleConfig();
    if ('error' in config) {
      console.error(config.error);
      return json(
        { deleted: false, error: 'Account deletion is temporarily unavailable. Please try again.' },
        500,
      );
    }

    const { data: credential } = await admin
      .from('apple_credentials')
      .select('refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!credential?.refresh_token) {
      // We cannot revoke what we never captured. Deleting anyway would leave a
      // dangling Apple connection and fail the reviewer's check, so refuse and
      // make the gap visible rather than reporting a success we did not achieve.
      console.error(
        `No Apple refresh token stored for ${user.id}. The apple-link function ` +
          `did not run at sign-in, or its exchange failed.`,
      );
      return json(
        {
          deleted: false,
          error:
            'We could not fully disconnect your Apple sign-in, so nothing was deleted. Please contact support and we will remove your account.',
        },
        502,
      );
    }

    const revoked = await revokeRefreshToken(config, credential.refresh_token);
    if (!revoked.ok) {
      console.error(`Apple revocation failed for ${user.id}: ${revoked.reason}`);
      return json(
        {
          deleted: false,
          error:
            'We could not fully disconnect your Apple sign-in. Nothing was deleted; please try again shortly.',
        },
        502,
      );
    }
  }

  // ── Delete everything ─────────────────────────────────────────────────────
  // Deleting the auth user cascades: profiles, climate_notes, note_completions
  // and apple_credentials all reference auth.users with ON DELETE CASCADE.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error(`User deletion failed for ${user.id}: ${deleteError.message}`);
    return json({ deleted: false, error: 'Deletion failed. Please try again.' }, 500);
  }

  console.log(`Deleted account ${user.id}${usedApple ? ' (Apple connection revoked)' : ''}`);
  return json({ deleted: true });
});
