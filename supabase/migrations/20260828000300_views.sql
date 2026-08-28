-- ============================================================================
-- Derived reads: the impact totals and the weekly calendar.
--
-- These are SECURITY INVOKER (the default), so they run with the caller's
-- privileges and RLS still applies. A user querying them sees their own rows
-- and nobody else's, without the function having to filter by hand.
-- ============================================================================

-- Lifetime and windowed totals for the signed-in user.
create or replace view user_impact_totals
with (security_invoker = true)
as
select
  c.user_id,
  coalesce(sum(c.kg_co2e), 0)::numeric(12,4)      as kg_co2e,
  coalesce(sum(c.litres_water), 0)::numeric(12,2) as litres_water,
  coalesce(sum(c.kg_waste), 0)::numeric(12,4)     as kg_waste,
  count(*)                                         as total_actions,
  count(*) filter (where not c.quantified)         as unquantified_actions,
  min(c.completed_on)                              as first_action_on,
  max(c.completed_on)                              as last_action_on
from note_completions c
group by c.user_id;

comment on view user_impact_totals is
  'Sums the snapshotted savings on each completion. Never recomputed from the '
  'factor table, so revising a factor cannot rewrite a user''s history.';

-- Savings grouped by category, for the Impact tab's breakdown.
create or replace view user_impact_by_category
with (security_invoker = true)
as
select
  c.user_id,
  f.category,
  sum(c.kg_co2e)::numeric(12,4) as kg_co2e,
  count(*)                       as actions
from note_completions c
join climate_notes n on n.id = c.note_id
left join reflection_options o on o.id = n.option_id
join impact_factors f on f.key = coalesce(n.factor_key, o.factor_key)
group by c.user_id, f.category;

-- ── Weekly calendar ─────────────────────────────────────────────────────────

/**
 * The seven days ending at p_end, with what the caller had committed and what
 * they completed on each.
 *
 * Returns a row for every day including empty ones, so the strip always renders
 * seven cells rather than collapsing to however many had activity.
 *
 * `committed` counts notes that were open on that date — created on or before
 * it and not yet archived. That is what makes "you finished everything you had
 * going that day" a fair statement rather than a comparison against a total
 * that includes commitments made later in the week.
 */
create or replace function user_week_progress(p_end date default current_date)
returns table (day date, committed integer, completed integer)
language sql
stable
security invoker
set search_path = public
as $$
  with days as (
    select generate_series(p_end - interval '6 days', p_end, interval '1 day')::date as day
  )
  select
    d.day,
    (
      select count(*)::integer from climate_notes n
      where n.user_id = auth.uid()
        and n.created_at::date <= d.day
        and (n.archived_at is null or n.archived_at::date > d.day)
    ) as committed,
    (
      select count(*)::integer from note_completions c
      where c.user_id = auth.uid() and c.completed_on = d.day
    ) as completed
  from days d
  order by d.day;
$$;

/**
 * Consecutive days ending at p_end on which the caller completed something.
 *
 * Today is exempt: at 9am a streak is not broken simply because the day is
 * young. The judgement starts at yesterday.
 */
create or replace function user_current_streak(p_end date default current_date)
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  cursor_date date;
  streak integer := 0;
begin
  if exists (
    select 1 from note_completions
    where user_id = auth.uid() and completed_on = p_end
  ) then
    cursor_date := p_end;
  else
    cursor_date := p_end - 1;
  end if;

  while exists (
    select 1 from note_completions
    where user_id = auth.uid() and completed_on = cursor_date
  ) loop
    streak := streak + 1;
    cursor_date := cursor_date - 1;
  end loop;

  return streak;
end;
$$;

-- ── Feed ────────────────────────────────────────────────────────────────────

/**
 * Published articles with their cover asset, for the Read tab.
 *
 * Exists so the feed is one round trip instead of an N+1 over assets, which on
 * a phone is the difference between the list appearing instantly and appearing
 * in pieces.
 */
create or replace view published_articles
with (security_invoker = true)
as
select
  a.id,
  a.slug,
  a.issue_number,
  a.title,
  a.dek,
  a.published_at,
  a.reading_minutes,
  a.word_count,
  cover.storage_path as cover_path,
  cover.alt_text     as cover_alt,
  cover.blurhash     as cover_blurhash,
  cover.credit       as cover_credit
from articles a
left join lateral (
  select storage_path, alt_text, blurhash, credit
  from article_assets
  where article_id = a.id and kind in ('cover', 'figure')
  order by case when kind = 'cover' then 0 else 1 end
  limit 1
) cover on true
where a.status = 'published'
order by a.published_at desc;
