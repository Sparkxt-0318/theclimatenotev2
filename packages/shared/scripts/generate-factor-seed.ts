/**
 * Generates the impact_factors seed migration from the TypeScript table.
 *
 * The TS file is the source of truth — it is what the worker and the apps
 * import. Writing the SQL by hand would let the two drift, and a mismatch
 * means the database computes a total the app cannot explain. Regenerate with:
 *
 *   pnpm --filter @climatenote/shared gen:factor-seed
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { IMPACT_FACTORS } from '../src/impact/factors';

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
const nullable = (value: number | undefined) => (value === undefined ? 'null' : String(value));

const rows = IMPACT_FACTORS.map(
  (f) =>
    `  (${quote(f.key)}, ${quote(f.label)}, ${quote(f.category)}, ${quote(f.unit)},\n` +
    `   ${quote(f.assumption)},\n` +
    `   ${f.kgCo2ePerUnit}, ${nullable(f.litresWaterPerUnit)}, ${nullable(f.kgWastePerUnit)},\n` +
    `   ${f.uncertainty}, ${f.gridDependent ?? false}, ${quote(f.sourceName)}, ${quote(f.sourceUrl)})`,
).join(',\n');

const sql = `-- ============================================================================
-- Impact factor seed.
--
-- GENERATED FILE — do not edit by hand.
-- Source: packages/shared/src/impact/factors.ts
-- Regenerate: pnpm --filter @climatenote/shared gen:factor-seed
--
-- Every figure the app shows a reader traces back to a row here, with its
-- assumption and source recorded alongside it.
-- ============================================================================

insert into impact_factors (
  key, label, category, unit, assumption,
  kg_co2e_per_unit, litres_water_per_unit, kg_waste_per_unit,
  uncertainty, grid_dependent, source_name, source_url
) values
${rows}
on conflict (key) do update set
  label                 = excluded.label,
  category              = excluded.category,
  unit                  = excluded.unit,
  assumption            = excluded.assumption,
  kg_co2e_per_unit      = excluded.kg_co2e_per_unit,
  litres_water_per_unit = excluded.litres_water_per_unit,
  kg_waste_per_unit     = excluded.kg_waste_per_unit,
  uncertainty           = excluded.uncertainty,
  grid_dependent        = excluded.grid_dependent,
  source_name           = excluded.source_name,
  source_url            = excluded.source_url;
`;

const target = join(
  import.meta.dirname,
  '../../../supabase/migrations/20260828000400_seed_impact_factors.sql',
);
writeFileSync(target, sql);
console.log(`Wrote ${IMPACT_FACTORS.length} factors to ${target}`);
