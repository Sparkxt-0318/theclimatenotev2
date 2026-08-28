/**
 * Account deletion.
 *
 * App Store guideline 5.1.1(v) requires an account created in the app to be
 * deletable from inside the app. There is a specific trap that fails review:
 * an app offering Sign in with Apple must ALSO revoke the Apple token through
 * Apple's REST API. Deleting the database row alone is not enough — the app
 * keeps appearing under Settings → Sign in with Apple, and reviewers check.
 *
 * Revocation needs Apple credentials, which must never ship in a client
 * binary, so it happens here.
 *
 * Order matters: revoke with Apple FIRST, then delete locally. If revocation
 * fails we stop and report it, because deleting our record first would leave
 * the user with an orphaned Apple connection and no way for us to clean it up.
 *
 * Deploy with:
 *   supabase functions deploy delete-account --no-verify-jwt=false
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not signed in' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Identify the caller from their own token. The user being deleted is
  // whoever is making the request — never an id supplied in the body, which
  // would let anyone delete anyone.
  const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await asUser.auth.getUser();

  if (userError || !user) return json({ error: 'Not signed in' }, 401);

  const admin = createClient(supabaseUrl, serviceKey);

  // ── Revoke with Apple first ───────────────────────────────────────────────
  const appleIdentity = user.identities?.find((identity) => identity.provider === 'apple');

  if (appleIdentity) {
    try {
      const revoked = await revokeAppleToken(user.id, admin);
      if (!revoked.ok) {
        console.error('Apple revocation failed:', revoked.reason);
        return json(
          {
            deleted: false,
            error:
              'We could not fully disconnect your Apple sign-in. Nothing was deleted; please try again shortly.',
          },
          502,
        );
      }
    } catch (error) {
      console.error('Apple revocation threw:', error);
      return json({ deleted: false, error: 'Apple sign-in could not be disconnected.' }, 502);
    }
  }

  // ── Delete everything ─────────────────────────────────────────────────────
  // Deleting the auth user cascades: profiles, climate_notes and
  // note_completions all reference auth.users with ON DELETE CASCADE, so there
  // is nothing left behind to clean up separately.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error('User deletion failed:', deleteError.message);
    return json({ deleted: false, error: 'Deletion failed. Please try again.' }, 500);
  }

  console.log(`Deleted account ${user.id}`);
  return json({ deleted: true });
});

/**
 * Revokes the user's Sign in with Apple token.
 *
 * Apple requires a client secret that is itself a short-lived ES256 JWT signed
 * with the private key from the developer portal — it cannot be a static
 * string, so it is minted per request here.
 */
async function revokeAppleToken(
  userId: string,
  admin: ReturnType<typeof createClient>,
): Promise<{ ok: boolean; reason?: string }> {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const serviceId = Deno.env.get('APPLE_SERVICE_ID');
  const privateKeyPem = Deno.env.get('APPLE_PRIVATE_KEY');

  if (!teamId || !keyId || !serviceId || !privateKeyPem) {
    return { ok: false, reason: 'Apple revocation credentials are not configured' };
  }

  // Supabase stores the provider refresh token alongside the identity.
  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const appleIdentity = userData.user?.identities?.find((i) => i.provider === 'apple');

  const refreshToken =
    (appleIdentity?.identity_data?.provider_refresh_token as string | undefined) ??
    (appleIdentity?.identity_data?.refresh_token as string | undefined);

  if (!refreshToken) {
    // Nothing to revoke. Deleting the account still removes our copy of their
    // data, which is what the user asked for, so this is not a hard failure.
    console.warn(`No Apple refresh token stored for ${userId}; skipping revocation`);
    return { ok: true };
  }

  const clientSecret = await create(
    { alg: 'ES256', kid: keyId, typ: 'JWT' },
    {
      iss: teamId,
      iat: getNumericDate(0),
      // Apple rejects anything over six months; ten minutes is ample.
      exp: getNumericDate(600),
      aud: 'https://appleid.apple.com',
      sub: serviceId,
    },
    await importApplePrivateKey(privateKeyPem),
  );

  const response = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: serviceId,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: 'refresh_token',
    }),
  });

  // Apple returns 200 with an empty body on success.
  if (!response.ok) {
    return { ok: false, reason: `Apple returned ${response.status}: ${await response.text()}` };
  }

  return { ok: true };
}

/** Imports the .p8 key downloaded from the Apple developer portal. */
async function importApplePrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    // Secret stores commonly escape the newlines in a PEM block.
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const der = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}
