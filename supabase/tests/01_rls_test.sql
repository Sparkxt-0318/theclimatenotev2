-- ============================================================================
-- Row-level security tests.
--
-- Every assertion here is an attempted breach. A policy that has never been
-- attacked is a policy nobody has checked.
--
-- Run with: pnpm db:test
-- ============================================================================

\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Counts every assertion so the run can prove they actually executed. A test
-- file that silently skips its body would otherwise still report success.
create table if not exists _assertions (n integer not null);
insert into _assertions values (0);

create or replace function assert(condition boolean, description text)
returns void language plpgsql as $$
begin
  update _assertions set n = n + 1;
  if condition then
    raise notice 'PASS  %', description;
  else
    raise exception 'FAIL  %', description;
  end if;
end;
$$;

-- Acting as a given user, the way Supabase does via the request JWT.
create or replace function act_as(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  execute 'set local role authenticated';
end;
$$;

create or replace function act_anonymous()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end;
$$;

-- ── Fixtures (created as the owner, bypassing RLS) ──────────────────────────

do $$
declare
  alice uuid; bob uuid; admin uuid;
  live_article uuid; draft_article uuid;
  alice_note uuid; bob_note uuid;
  opt uuid;
begin
  insert into auth.users (email) values ('alice@example.com') returning id into alice;
  insert into auth.users (email) values ('bob@example.com')   returning id into bob;
  insert into auth.users (email) values ('admin@example.com') returning id into admin;
  update profiles set role = 'admin' where id = admin;

  insert into articles (slug, title, status, published_at, issue_number)
  values ('live-issue', 'A published issue', 'published', now(), 1)
  returning id into live_article;

  insert into articles (slug, title, status, issue_number)
  values ('secret-draft', 'An unpublished draft', 'draft', 2)
  returning id into draft_article;

  insert into article_summaries (article_id, problem, why_it_matters)
  values (draft_article, 'Secret problem', 'Secret reason');

  insert into reflection_options
    (article_id, position, title, detail, source_span, factor_key, estimated_quantity)
  values
    (live_article, 1, 'Swap two beef meals for beans this week', 'Detail here.',
     'quoted span from the article', 'meal.beef_to_plant', 2)
  returning id into opt;

  insert into climate_notes (user_id, article_id, option_id)
  values (alice, live_article, opt) returning id into alice_note;
  insert into climate_notes (user_id, article_id, custom_text, factor_key, estimated_quantity)
  values (bob, live_article, 'My own idea', 'waste.reusable_bottle', 5)
  returning id into bob_note;

  insert into note_completions (note_id, user_id, completed_on, kg_co2e)
  values (alice_note, alice, current_date, 9.8);
  insert into note_completions (note_id, user_id, completed_on, kg_co2e)
  values (bob_note, bob, current_date, 0.4);

  -- Stash ids for the tests below.
  create table if not exists _fixtures (k text primary key, v uuid);
  insert into _fixtures values
    ('alice', alice), ('bob', bob), ('admin', admin),
    ('live', live_article), ('draft', draft_article),
    ('alice_note', alice_note), ('bob_note', bob_note), ('option', opt);
end
$$;

-- ── Anonymous readers ───────────────────────────────────────────────────────

do $$
declare alice uuid := (select v from _fixtures where k = 'alice');
begin
  perform act_anonymous();

  perform assert(
    (select count(*) from articles where status = 'published') = 1,
    'anonymous can read published articles (the app works with no account)');

  perform assert(
    (select count(*) from articles where status = 'draft') = 0,
    'anonymous cannot read unpublished drafts');

  perform assert(
    (select count(*) from article_summaries) = 0,
    'anonymous cannot read a draft summary through the child table');

  perform assert(
    (select count(*) from reflection_options) = 1,
    'anonymous can read reflection options on published articles');

  perform assert(
    (select count(*) from climate_notes) = 0,
    'anonymous cannot read anyone''s private notes');

  perform assert(
    (select count(*) from note_completions) = 0,
    'anonymous cannot read anyone''s completions');

  perform assert(
    (select count(*) from impact_factors) > 0,
    'anonymous can read the impact factors (the methodology is public)');

  reset role;
end
$$;

-- ── One user against another ────────────────────────────────────────────────

do $$
declare
  alice uuid := (select v from _fixtures where k = 'alice');
  bob   uuid := (select v from _fixtures where k = 'bob');
  bob_note uuid := (select v from _fixtures where k = 'bob_note');
  live uuid := (select v from _fixtures where k = 'live');
  blocked boolean := false;
begin
  perform act_as(alice);

  perform assert(
    (select count(*) from climate_notes) = 1,
    'alice sees exactly her own note, not bob''s');

  perform assert(
    (select count(*) from climate_notes where user_id = bob) = 0,
    'alice cannot read bob''s note even by naming his id');

  perform assert(
    (select count(*) from note_completions where user_id = bob) = 0,
    'alice cannot read bob''s completions');

  perform assert(
    (select count(*) from profiles where id = bob) = 0,
    'alice cannot read bob''s profile');

  -- Forging a note_id must not let alice attach activity to bob's commitment.
  begin
    insert into note_completions (note_id, user_id, completed_on)
    values (bob_note, alice, current_date);
    blocked := false;
  exception when others then
    blocked := true;
  end;
  perform assert(blocked, 'alice cannot complete a note that belongs to bob');

  -- Nor may she write a row stamped with his user_id.
  begin
    insert into climate_notes (user_id, article_id, custom_text)
    values (bob, live, 'impersonation attempt');
    blocked := false;
  exception when others then
    blocked := true;
  end;
  perform assert(blocked, 'alice cannot create a note owned by bob');

  reset role;
end
$$;

-- ── Ordinary users may not act as editors ───────────────────────────────────

do $$
declare
  alice uuid := (select v from _fixtures where k = 'alice');
  draft uuid := (select v from _fixtures where k = 'draft');
  blocked boolean := false;
  affected integer;
begin
  perform act_as(alice);

  perform assert(
    (select count(*) from articles where status = 'draft') = 0,
    'a normal reader cannot see drafts');

  begin
    insert into articles (slug, title, status) values ('rogue', 'Rogue article', 'published');
    blocked := false;
  exception when others then
    blocked := true;
  end;
  perform assert(blocked, 'a normal reader cannot publish an article');

  -- An UPDATE filtered out by RLS affects zero rows rather than raising.
  update articles set title = 'Defaced' where id = draft;
  get diagnostics affected = row_count;
  perform assert(affected = 0, 'a normal reader cannot edit an article');

  begin
    insert into impact_factors (key, label, category, unit, assumption,
                                kg_co2e_per_unit, source_name, source_url)
    values ('fake.factor', 'Fake', 'food', 'meal', 'Invented factor.', 999, 'x', 'https://x');
    blocked := false;
  exception when others then
    blocked := true;
  end;
  perform assert(blocked, 'a normal reader cannot invent an impact factor');

  reset role;
end
$$;

-- ── Admins ──────────────────────────────────────────────────────────────────

do $$
declare
  admin uuid := (select v from _fixtures where k = 'admin');
  alice uuid := (select v from _fixtures where k = 'alice');
begin
  perform act_as(admin);

  perform assert(
    (select count(*) from articles) = 2,
    'an admin can see drafts as well as published issues');

  perform assert(
    (select count(*) from article_summaries) = 1,
    'an admin can review the draft summary');

  -- The deliberate omission: there is no admin policy on climate_notes.
  perform assert(
    (select count(*) from climate_notes) = 0,
    'an admin cannot read readers'' private notes');

  perform assert(
    (select count(*) from note_completions) = 0,
    'an admin cannot read readers'' completions');

  reset role;
end
$$;

-- ── Calendar and totals ─────────────────────────────────────────────────────

do $$
declare
  alice uuid := (select v from _fixtures where k = 'alice');
  rows_returned integer;
  todays_completed integer;
  alice_total numeric;
begin
  perform act_as(alice);

  select count(*) into rows_returned from user_week_progress(current_date);
  perform assert(rows_returned = 7, 'the week strip always returns seven days');

  select completed into todays_completed
  from user_week_progress(current_date) where day = current_date;
  perform assert(todays_completed = 1, 'today counts alice''s single completion');

  perform assert(user_current_streak(current_date) = 1, 'alice has a one-day streak');

  select kg_co2e into alice_total from user_impact_totals;
  perform assert(alice_total = 9.8, 'alice''s total is her own snapshot, not bob''s');

  perform assert(
    (select count(*) from user_impact_totals) = 1,
    'the totals view exposes one row: the caller''s');

  reset role;
end
$$;

-- ── Data integrity constraints ──────────────────────────────────────────────

do $$
declare blocked boolean;
begin
  begin
    insert into articles (slug, title, status) values ('bad', 'Published with no date', 'published');
    blocked := false;
  exception when check_violation then
    blocked := true;
  end;
  perform assert(blocked, 'an article cannot be published without a date');

  begin
    insert into article_assets (article_id, kind, storage_path, alt_text, source_url)
    values ((select v from _fixtures where k = 'live'), 'cover', 'x.jpg', 'Alt text', 'https://example.com/photo.jpg');
    blocked := false;
  exception when check_violation then
    blocked := true;
  end;
  perform assert(blocked, 'an externally sourced image cannot be stored without credit and licence');

  begin
    insert into climate_notes (user_id, article_id)
    values ((select v from _fixtures where k = 'alice'), (select v from _fixtures where k = 'live'));
    blocked := false;
  exception when check_violation then
    blocked := true;
  end;
  perform assert(blocked, 'a note must contain either a chosen option or the reader''s own words');

  begin
    insert into note_completions (note_id, user_id, completed_on)
    values ((select v from _fixtures where k = 'alice_note'),
            (select v from _fixtures where k = 'alice'), current_date);
    blocked := false;
  exception when unique_violation then
    blocked := true;
  end;
  perform assert(blocked, 'the same note cannot be completed twice on one day');
end
$$;

-- Fails loudly if assertions were skipped rather than passed.
do $$
declare ran integer := (select n from _assertions);
declare expected constant integer := 30;
begin
  if ran <> expected then
    raise exception 'Expected % assertions, only % ran. Tests were skipped.', expected, ran;
  end if;
  raise notice 'ALL % RLS ASSERTIONS PASSED', ran;
end
$$;
