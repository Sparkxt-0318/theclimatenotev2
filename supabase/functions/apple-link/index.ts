/**
 * Stores an Apple refresh token so the account can later be fully deleted.
 *
 * Called by the app immediately after a successful Sign in with Apple. Apple's
 * `authorizationCode` is single-use and expires in about five minutes, so this
 * cannot be deferred to deletion time — by then there is nothing to exchange.
 *
 * Without this, `delete-account` has no token to revoke, the app stays listed
 * under Settings -> Sign-In & Security -> Sign in with Apple after deletion,
 * and the submission fails guideline 5.1.1(v).
 *
 * Deploy with: supabase functions deploy apple-link
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { CORS, exchangeAuthorizationCode, json, readAppleConfig } from '../_shared/apple.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not signed in' }, 401);

  // Identify the caller from their own token. The token is stored against
  // whoever is making the request, never against an id supplied in the body.
  const asUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error: userError,
  } = await asUser.auth.getUser();

  if (userError || !user) return json({ error: 'Not signed in' }, 401);

  let authorizationCode: string | undefined;
  try {
    ({ authorizationCode } = (await request.json()) as { authorizationCode?: string });
  } catch {
    return json({ error: 'Expected a JSON body' }, 400);
  }

  if (!authorizationCode) return json({ error: 'authorizationCode is required' }, 400);

  const config = readAppleConfig();
  if ('error' in config) {
    console.error(config.error);
    return json({ error: 'Apple sign-in is not fully configured on the server.' }, 500);
  }

  const exchanged = await exchangeAuthorizationCode(config, authorizationCode);
  if (!exchanged.ok) {
    // Not fatal to the user's session — they are signed in either way. It is
    // fatal to our ability to revoke later, so it must be loud in the logs.
    console.error(`Apple code exchange failed for ${user.id}: ${exchanged.reason}`);
    return json({ stored: false, error: 'Could not complete Apple sign-in setup.' }, 502);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { error } = await admin
    .from('apple_credentials')
    .upsert({ user_id: user.id, refresh_token: exchanged.refreshToken }, { onConflict: 'user_id' });

  if (error) {
    console.error(`Could not store Apple refresh token for ${user.id}: ${error.message}`);
    return json({ stored: false }, 500);
  }

  return json({ stored: true });
});
