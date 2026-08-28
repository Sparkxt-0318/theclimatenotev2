-- ============================================================================
-- Row-level security.
--
-- Enabled on every table. The default is deny; each policy below is a
-- deliberate exception. Read this file as the answer to "who can see what",
-- because it is the only thing standing between one reader's private notes
-- and another's.
--
-- The service role bypasses RLS entirely and is used only by the ingestion
-- worker and server-side web routes. It is never shipped to a client.
-- ============================================================================

alter table profiles           enable row level security;
alter table articles           enable row level security;
alter table article_links      enable row level security;
alter table article_assets     enable row level security;
alter table article_summaries  enable row level security;
alter table reflection_options enable row level security;
alter table impact_factors     enable row level security;
alter table climate_notes      enable row level security;
alter table note_completions   enable row level security;
alter table ingestion_jobs     enable row level security;

-- ── Profiles ────────────────────────────────────────────────────────────────
-- Your own profile only. There is no social layer, so there is no reason for
-- one reader to be able to read another's row.

create policy "read own profile" on profiles
  for select using (auth.uid() = id);

create policy "update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "admins read all profiles" on profiles
  for select using (is_admin(auth.uid()));

-- ── Articles ────────────────────────────────────────────────────────────────
-- Published articles are world-readable, including to anonymous clients. This
-- is what lets the app open straight into content with no account.
--
-- Note `using` covers both anon and authenticated: an unauthenticated request
-- has auth.uid() = null, which the admin branch simply fails.

create policy "anyone reads published articles" on articles
  for select using (status = 'published');

create policy "admins read every article" on articles
  for select using (is_admin(auth.uid()));

create policy "admins write articles" on articles
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Article children follow their parent's visibility exactly. Each policy joins
-- back to articles rather than repeating the status test, so there is one
-- definition of "published" to keep correct.

create policy "anyone reads links of published articles" on article_links
  for select using (
    exists (select 1 from articles a where a.id = article_id and a.status = 'published')
  );
create policy "admins manage links" on article_links
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "anyone reads assets of published articles" on article_assets
  for select using (
    exists (select 1 from articles a where a.id = article_id and a.status = 'published')
  );
create policy "admins manage assets" on article_assets
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "anyone reads summaries of published articles" on article_summaries
  for select using (
    exists (select 1 from articles a where a.id = article_id and a.status = 'published')
  );
create policy "admins manage summaries" on article_summaries
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "anyone reads options of published articles" on reflection_options
  for select using (
    exists (select 1 from articles a where a.id = article_id and a.status = 'published')
  );
create policy "admins manage options" on reflection_options
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- ── Impact factors ──────────────────────────────────────────────────────────
-- Public on purpose. The methodology page shows every factor and its source;
-- a reader who wants to check our arithmetic should be able to.

create policy "anyone reads impact factors" on impact_factors
  for select using (true);
create policy "admins manage impact factors" on impact_factors
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- ── User content ────────────────────────────────────────────────────────────
-- Owner-only, with no admin exception. An administrator has no business
-- reading what a fifteen-year-old privately committed to doing, and not
-- granting the access means it cannot be abused or leaked.

create policy "read own notes" on climate_notes
  for select using (auth.uid() = user_id);
create policy "create own notes" on climate_notes
  for insert with check (auth.uid() = user_id);
create policy "update own notes" on climate_notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own notes" on climate_notes
  for delete using (auth.uid() = user_id);

create policy "read own completions" on note_completions
  for select using (auth.uid() = user_id);
create policy "create own completions" on note_completions
  for insert with check (
    auth.uid() = user_id
    -- Belt and braces: the note being completed must also belong to you, so a
    -- forged note_id cannot attach a completion to someone else's commitment.
    and exists (select 1 from climate_notes n where n.id = note_id and n.user_id = auth.uid())
  );
create policy "delete own completions" on note_completions
  for delete using (auth.uid() = user_id);

-- ── Operational tables ──────────────────────────────────────────────────────

create policy "admins read ingestion jobs" on ingestion_jobs
  for select using (is_admin(auth.uid()));
create policy "admins manage ingestion jobs" on ingestion_jobs
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Article images are public: they appear in the app, on the website and in
-- social previews. Writes are service-role only, which the pipeline uses.

insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do nothing;

create policy "anyone reads article images" on storage.objects
  for select using (bucket_id = 'article-images');

create policy "admins upload article images" on storage.objects
  for insert with check (bucket_id = 'article-images' and is_admin(auth.uid()));
