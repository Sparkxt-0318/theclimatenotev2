-- ============================================================================
-- The Climate Note — initial schema
--
-- Two rules shape everything here:
--
--  1. Published articles are readable by anyone, signed in or not. The app
--     must work with no account, both because it is better for a teenage
--     reader and because App Store guideline 5.1.1 rejects apps that gate
--     content behind registration for no reason.
--
--  2. A user's notes and completions are visible to that user alone. RLS is
--     enabled on every table in this migration rather than added later, so
--     there is never a window where the default is open.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────────────────

create type article_status as enum ('draft', 'scheduled', 'published', 'archived');
create type asset_kind as enum ('cover', 'figure', 'embedded');
create type asset_placement as enum ('start', 'middle');
create type social_platform as enum ('instagram', 'substack', 'medium', 'youtube', 'other');
create type user_role as enum ('reader', 'admin');
create type ingestion_state as enum ('pending', 'running', 'succeeded', 'failed', 'skipped');
create type impact_category as enum ('food', 'transport', 'energy', 'waste', 'water', 'consumption');

-- ── Profiles ────────────────────────────────────────────────────────────────

create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  avatar_url    text,
  role          user_role not null default 'reader',
  -- The user's own timezone, so "today" on the calendar means their today.
  timezone      text not null default 'UTC',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table profiles is
  'One row per account. Created automatically by a trigger on auth.users.';

-- Admin checks run inside RLS policies on other tables. A plain subquery
-- against profiles would recurse through those policies, so this is SECURITY
-- DEFINER with a pinned search_path.
create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = uid and role = 'admin');
$$;

-- ── Articles ────────────────────────────────────────────────────────────────

create table articles (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  issue_number      integer unique,
  title             text not null,
  dek               text,
  status            article_status not null default 'draft',
  published_at      timestamptz,

  -- Typed block list extracted verbatim from the source .docx. Never written
  -- or altered by a model.
  body_blocks       jsonb not null default '[]'::jsonb,

  -- Provenance, used to detect that a Drive file changed and needs reingesting.
  source_file_id    text,
  source_modified_at timestamptz,
  source_checksum   text,

  word_count        integer not null default 0,
  reading_minutes   integer not null default 1,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A published article must have a date; anything else must not pretend to.
  constraint published_has_date check (
    (status = 'published' and published_at is not null) or status <> 'published'
  )
);

create index articles_published_idx
  on articles (published_at desc) where status = 'published';
create index articles_source_file_idx on articles (source_file_id);

comment on column articles.body_blocks is
  'ArticleBlock[] from packages/shared. Author text, copied verbatim.';

-- ── Social cross-posting links (admin-managed) ──────────────────────────────

create table article_links (
  id          uuid primary key default gen_random_uuid(),
  article_id  uuid not null references articles on delete cascade,
  platform    social_platform not null,
  url         text not null,
  label       text,
  created_at  timestamptz not null default now(),
  unique (article_id, platform)
);

comment on table article_links is
  'Where this issue also appeared. Filled in by an admin, not by the pipeline.';

-- ── Assets ──────────────────────────────────────────────────────────────────

create table article_assets (
  id            uuid primary key default gen_random_uuid(),
  article_id    uuid not null references articles on delete cascade,
  kind          asset_kind not null,
  placement     asset_placement,
  storage_path  text not null,
  alt_text      text not null,

  -- Licence provenance. Every externally sourced image carries these, and the
  -- admin console refuses to publish a cover without them.
  credit        text,
  source_url    text,
  license       text,

  -- Present when we rendered the image ourselves from article data.
  chart_spec    jsonb,
  blurhash      text,

  width         integer,
  height        integer,
  created_at    timestamptz not null default now(),

  -- An image we did not make must say where it came from and under what licence.
  constraint external_images_are_attributed check (
    chart_spec is not null or source_url is null or (credit is not null and license is not null)
  )
);

create index article_assets_article_idx on article_assets (article_id);

-- ── AI summary ──────────────────────────────────────────────────────────────

create table article_summaries (
  article_id      uuid primary key references articles on delete cascade,
  problem         text not null,
  why_it_matters  text not null,
  what_we_can_do  jsonb not null default '[]'::jsonb,
  jargon_avoided  jsonb not null default '[]'::jsonb,

  -- Measured, not asserted. Surfaced in the admin console.
  reading_grade   numeric(4,1),
  model           text,
  generated_at    timestamptz not null default now(),
  -- Edited by a human, so regeneration must not silently overwrite it.
  edited_by_admin boolean not null default false
);

-- ── Impact factors ──────────────────────────────────────────────────────────

create table impact_factors (
  key                  text primary key,
  label                text not null,
  category             impact_category not null,
  unit                 text not null,
  assumption           text not null,
  kg_co2e_per_unit     numeric(10,4) not null check (kg_co2e_per_unit >= 0),
  litres_water_per_unit numeric(10,2),
  kg_waste_per_unit    numeric(10,4),
  uncertainty          numeric(4,2) not null default 2 check (uncertainty >= 1),
  grid_dependent       boolean not null default false,
  source_name          text not null,
  source_url           text not null,
  created_at           timestamptz not null default now()
);

comment on table impact_factors is
  'Seeded from packages/shared/src/impact/factors.ts, which is the source of '
  'truth. Mirrored here so the database can compute totals in a view.';

-- ── Reflection options ──────────────────────────────────────────────────────

create table reflection_options (
  id                 uuid primary key default gen_random_uuid(),
  article_id         uuid not null references articles on delete cascade,
  position           smallint not null check (position between 1 and 3),
  title              text not null,
  detail             text not null,

  -- The verbatim article quote justifying this action. Not decoration: the
  -- pipeline rejects an option whose span is not found in the body, and it is
  -- shown in the admin console so a human can check the link too.
  source_span        text not null,

  factor_key         text not null references impact_factors (key),
  estimated_quantity numeric(8,2) not null check (estimated_quantity > 0),
  difficulty         text not null default 'easy',

  -- Grader scores, kept for auditing how well the quality gates hold up.
  specificity_score  smallint,
  relevance_score    smallint,
  created_at         timestamptz not null default now(),
  unique (article_id, position)
);

create index reflection_options_article_idx on reflection_options (article_id);

-- ── User commitments ────────────────────────────────────────────────────────

create table climate_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  article_id  uuid not null references articles on delete cascade,

  -- Either one of the three generated options, or the reader's own words.
  option_id   uuid references reflection_options on delete set null,
  custom_text text,

  -- For a custom note, which factor we mapped it to and how sure we were.
  factor_key         text references impact_factors (key),
  estimated_quantity numeric(8,2),
  mapping_confidence numeric(3,2),

  created_at  timestamptz not null default now(),
  archived_at timestamptz,

  constraint note_has_content check (option_id is not null or custom_text is not null)
);

create index climate_notes_user_idx on climate_notes (user_id, created_at desc);
create index climate_notes_article_idx on climate_notes (article_id);

-- ── Completions ─────────────────────────────────────────────────────────────

create table note_completions (
  id            uuid primary key default gen_random_uuid(),
  note_id       uuid not null references climate_notes on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,

  -- Date in the USER's timezone, not UTC. Someone in Seoul checking something
  -- off at 8am must not have it land on yesterday's square.
  completed_on  date not null,

  -- Snapshotted at completion time so a later change to a factor cannot
  -- silently rewrite a user's history.
  kg_co2e       numeric(10,4) not null default 0,
  litres_water  numeric(10,2) not null default 0,
  kg_waste      numeric(10,4) not null default 0,
  quantified    boolean not null default true,

  created_at    timestamptz not null default now(),
  unique (note_id, completed_on)
);

create index note_completions_user_date_idx on note_completions (user_id, completed_on desc);

comment on column note_completions.kg_co2e is
  'Snapshot of the computed saving. Not recomputed on read, so revising a '
  'factor does not retroactively change what a user was already shown.';

-- ── Ingestion jobs ──────────────────────────────────────────────────────────

create table ingestion_jobs (
  id              uuid primary key default gen_random_uuid(),
  source_file_id  text not null,
  source_name     text,
  state           ingestion_state not null default 'pending',
  -- Which pipeline step to resume from, so a failure does not redo expensive
  -- AI work that already succeeded.
  step            text not null default 'discover',
  article_id      uuid references articles on delete set null,
  error           text,
  attempts        smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index ingestion_jobs_state_idx on ingestion_jobs (state, created_at);

-- ── updated_at maintenance ──────────────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger articles_touch before update on articles
  for each row execute function touch_updated_at();
create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();
create trigger ingestion_jobs_touch before update on ingestion_jobs
  for each row execute function touch_updated_at();

-- ── Profile creation ────────────────────────────────────────────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    -- Apple gives a name only on the very first sign-in and may withhold it
    -- entirely, so fall back rather than showing an empty header.
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'Reader'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
