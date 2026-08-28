-- ============================================================================
-- Local test shim.
--
-- Recreates just enough of a Supabase project — the auth and storage schemas,
-- auth.uid(), and the anon/authenticated/service_role roles — for the real
-- migrations to run against a plain Postgres. This is NOT applied to the
-- hosted project, which already provides all of it.
--
-- It exists so RLS can be tested for real: the policies are only meaningful if
-- something actually tries to read another user's rows and is refused.
-- ============================================================================

create schema if not exists auth;
create schema if not exists storage;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create table storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets,
  name      text not null,
  owner     uuid
);
alter table storage.objects enable row level security;

-- Supabase derives auth.uid() from the request JWT. Locally we drive it from a
-- session GUC, which lets a test say "now act as this user".
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

-- Supabase grants these in a hosted project; the shim must match, or every
-- policy fails on schema access before it ever evaluates.
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant select on auth.users to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
