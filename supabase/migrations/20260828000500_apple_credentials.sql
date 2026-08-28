-- ============================================================================
-- Apple refresh tokens, for Sign in with Apple revocation.
--
-- App Store guideline 5.1.1(v) requires that deleting an account also revokes
-- the Sign in with Apple connection, and reviewers check by looking for the app
-- under Settings -> Sign-In & Security -> Sign in with Apple.
--
-- Revocation needs an Apple REFRESH token. Getting one is less obvious than it
-- looks:
--
--   * Supabase does NOT store provider refresh tokens on the identity. The
--     `identity_data` column holds ID-token claims (sub, email, name) only.
--   * `signInWithIdToken` — the native flow this app uses, and the reason it
--     no longer opens a browser — never produces an Apple refresh token at all.
--
-- The only way to get one is to take the single-use `authorizationCode` Apple
-- returns alongside the identity token at sign-in, and exchange it at Apple's
-- token endpoint within its few-minute lifetime. That exchange needs the Apple
-- private key, so it happens in an Edge Function and the result is stored here.
--
-- An earlier version of this schema had no such table, and the delete-account
-- function looked for a refresh token on the identity that is never there. It
-- silently skipped revocation on every single deletion while reporting success.
-- ============================================================================

create table apple_credentials (
  user_id       uuid primary key references auth.users on delete cascade,
  -- Apple's refresh token. A durable credential for the user's Apple account
  -- connection to this app, which is why nothing but the service role may read
  -- it (see the RLS note below).
  refresh_token text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table apple_credentials is
  'Apple refresh tokens, used solely to revoke Sign in with Apple on account '
  'deletion. Written and read only by Edge Functions using the service role.';

create trigger apple_credentials_touch before update on apple_credentials
  for each row execute function touch_updated_at();

-- RLS on with NO policies at all. That is deliberate and is the strongest
-- setting available: every request through the anon or authenticated key is
-- denied, including the owner's own. Only the service role, which bypasses RLS,
-- can touch this table. A user has no reason to read their own Apple refresh
-- token, and neither does an administrator.
alter table apple_credentials enable row level security;
