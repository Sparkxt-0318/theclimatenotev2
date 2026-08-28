/**
 * Apple identity-service helpers.
 *
 * Shared by `apple-link` (exchange an authorization code for a refresh token)
 * and `delete-account` (revoke it). Both need a client secret, which for Apple
 * is not a static string but a short-lived ES256 JWT signed with the private
 * key from the developer portal — so it is minted per request.
 */

import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

export type AppleConfig = {
  teamId: string;
  keyId: string;
  serviceId: string;
  privateKeyPem: string;
};

/** Reads the four Apple secrets, or explains precisely which one is missing. */
export function readAppleConfig(): AppleConfig | { error: string } {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const serviceId = Deno.env.get('APPLE_SERVICE_ID');
  const privateKeyPem = Deno.env.get('APPLE_PRIVATE_KEY');

  const missing = [
    ['APPLE_TEAM_ID', teamId],
    ['APPLE_KEY_ID', keyId],
    ['APPLE_SERVICE_ID', serviceId],
    ['APPLE_PRIVATE_KEY', privateKeyPem],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    return { error: `Apple secrets not configured: ${missing.join(', ')}` };
  }
  return {
    teamId: teamId as string,
    keyId: keyId as string,
    serviceId: serviceId as string,
    privateKeyPem: privateKeyPem as string,
  };
}

/** Imports the .p8 key downloaded from the Apple developer portal. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    // Secret stores commonly escape the newlines inside a PEM block.
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const der = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
}

/** The short-lived JWT Apple accepts in place of a client secret. */
async function mintClientSecret(config: AppleConfig): Promise<string> {
  return create(
    { alg: 'ES256', kid: config.keyId, typ: 'JWT' },
    {
      iss: config.teamId,
      iat: getNumericDate(0),
      // Apple rejects anything over six months; ten minutes is ample.
      exp: getNumericDate(600),
      aud: 'https://appleid.apple.com',
      sub: config.serviceId,
    },
    await importPrivateKey(config.privateKeyPem),
  );
}

export type AppleResult = { ok: true } | { ok: false; reason: string };

/**
 * Exchanges the one-time `authorizationCode` from a native Sign in with Apple
 * for a durable refresh token.
 *
 * The code expires within about five minutes of the sign-in and can be used
 * once, so this has to happen immediately after authentication, not later.
 */
export async function exchangeAuthorizationCode(
  config: AppleConfig,
  authorizationCode: string,
): Promise<{ ok: true; refreshToken: string } | { ok: false; reason: string }> {
  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.serviceId,
      client_secret: await mintClientSecret(config),
      code: authorizationCode,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    return { ok: false, reason: `Apple token exchange returned ${response.status}: ${await response.text()}` };
  }

  const body = (await response.json()) as { refresh_token?: string };
  if (!body.refresh_token) {
    return { ok: false, reason: 'Apple did not return a refresh token' };
  }
  return { ok: true, refreshToken: body.refresh_token };
}

/** Revokes the user's Sign in with Apple connection. */
export async function revokeRefreshToken(
  config: AppleConfig,
  refreshToken: string,
): Promise<AppleResult> {
  const response = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.serviceId,
      client_secret: await mintClientSecret(config),
      token: refreshToken,
      token_type_hint: 'refresh_token',
    }),
  });

  // Apple returns 200 with an empty body on success.
  if (!response.ok) {
    return { ok: false, reason: `Apple revoke returned ${response.status}: ${await response.text()}` };
  }
  return { ok: true };
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
