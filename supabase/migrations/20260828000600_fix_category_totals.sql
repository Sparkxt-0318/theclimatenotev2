-- ============================================================================
-- Make the Impact tab's category breakdown add up.
--
-- `user_impact_by_category` INNER JOINed impact_factors on
-- coalesce(note.factor_key, option.factor_key). A note the reader wrote
-- themselves that we could not confidently map has neither, so it was dropped
-- entirely — and the breakdown silently failed to sum to the headline figure
-- shown right above it on the same screen.
--
-- Two numbers that disagree on one screen is exactly the kind of thing that
-- erodes trust in a publication built on being careful with numbers.
--
-- Unmapped notes now appear under their own category so the parts add up to
-- the whole. Their carbon contribution is zero by design, because we decline
-- to invent a figure we cannot defend.
-- ============================================================================

-- Dropped and recreated rather than replaced: the category column changes from
-- the impact_category enum to text (to carry the 'unmeasured' bucket), and
-- CREATE OR REPLACE VIEW cannot change a column's type.
drop view if exists user_impact_by_category;

create view user_impact_by_category
with (security_invoker = true)
as
select
  c.user_id,
  coalesce(f.category::text, 'unmeasured') as category,
  sum(c.kg_co2e)::numeric(12,4)            as kg_co2e,
  count(*)                                  as actions
from note_completions c
join climate_notes n on n.id = c.note_id
left join reflection_options o on o.id = n.option_id
-- LEFT, not INNER: a completion with no mappable factor is still something the
-- reader did, and dropping it understates their week.
left join impact_factors f on f.key = coalesce(n.factor_key, o.factor_key)
group by c.user_id, coalesce(f.category::text, 'unmeasured');

comment on view user_impact_by_category is
  'Savings grouped by category. Actions we cannot measure appear as '
  '"unmeasured" with zero carbon, so the breakdown sums to the headline total.';
