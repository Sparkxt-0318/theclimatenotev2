/**
 * Emission factors.
 *
 * Every number a user ever sees comes from this table. Nothing is computed by a
 * model at request time — a climate publication that shows invented figures has
 * lost the only thing it was selling.
 *
 * The AI's role is narrow: map a user's free-text action onto one of these keys
 * and estimate a quantity. If it cannot do that confidently, the action is
 * recorded without a number rather than given a plausible-looking one.
 *
 * ── Reading these honestly ─────────────────────────────────────────────────
 * These are population averages, not measurements of any individual's life.
 * Real values vary several-fold with region, season, supply chain and
 * behaviour. `uncertainty` records that spread so the UI can present a figure
 * as approximate — the app says "about 9 kg", never "9.03 kg".
 *
 * Sources are recorded per row and surfaced in the app's methodology page, so
 * a curious reader can check our work.
 */

export type ImpactCategory = 'food' | 'transport' | 'energy' | 'waste' | 'water' | 'consumption';

export type ImpactFactor = {
  key: string;
  /** Short label shown next to a logged action. */
  label: string;
  category: ImpactCategory;
  /** What one unit means. Quantities are always expressed in this unit. */
  unit: string;
  /** Plain-language statement of what one unit assumes. */
  assumption: string;
  kgCo2ePerUnit: number;
  litresWaterPerUnit?: number;
  kgWastePerUnit?: number;
  /**
   * Rough multiplicative spread, e.g. 2 means "could plausibly be half or
   * double this". Drives the app's hedging language.
   */
  uncertainty: number;
  /** True where the figure depends heavily on local electricity generation. */
  gridDependent?: boolean;
  sourceName: string;
  sourceUrl: string;
};

/**
 * Ordered roughly by how often a teenage reader can actually act on them.
 * Keys are stable identifiers — reflection options reference them, so renaming
 * one orphans historical data. Add new keys instead.
 */
const FACTOR_LITERALS = [
  // ── Food ────────────────────────────────────────────────────────────────
  {
    key: 'meal.beef_to_plant',
    label: 'Swapped a beef meal for a plant-based one',
    category: 'food',
    unit: 'meal',
    assumption: 'One meal containing about 100 g of beef, replaced by beans, lentils or tofu.',
    kgCo2ePerUnit: 9.8,
    litresWaterPerUnit: 1540,
    uncertainty: 1.6,
    sourceName: 'Poore & Nemecek (2018), Science — via Our World in Data',
    sourceUrl: 'https://ourworldindata.org/environmental-impacts-of-food',
  },
  {
    key: 'meal.lamb_to_plant',
    label: 'Swapped a lamb meal for a plant-based one',
    category: 'food',
    unit: 'meal',
    assumption: 'One meal containing about 100 g of lamb.',
    kgCo2ePerUnit: 3.8,
    uncertainty: 1.6,
    sourceName: 'Poore & Nemecek (2018), Science — via Our World in Data',
    sourceUrl: 'https://ourworldindata.org/environmental-impacts-of-food',
  },
  {
    key: 'meal.cheese_to_plant',
    label: 'Swapped a cheese-heavy meal for a plant-based one',
    category: 'food',
    unit: 'meal',
    assumption: 'One meal containing about 80 g of cheese.',
    kgCo2ePerUnit: 1.8,
    uncertainty: 1.7,
    sourceName: 'Poore & Nemecek (2018), Science — via Our World in Data',
    sourceUrl: 'https://ourworldindata.org/environmental-impacts-of-food',
  },
  {
    key: 'meal.chicken_to_plant',
    label: 'Swapped a chicken meal for a plant-based one',
    category: 'food',
    unit: 'meal',
    assumption: 'One meal containing about 120 g of chicken.',
    kgCo2ePerUnit: 1.0,
    uncertainty: 1.6,
    sourceName: 'Poore & Nemecek (2018), Science — via Our World in Data',
    sourceUrl: 'https://ourworldindata.org/environmental-impacts-of-food',
  },
  {
    key: 'meal.meat_free_day',
    label: 'Ate no meat for a day',
    category: 'food',
    unit: 'day',
    assumption: 'A typical mixed-diet day, with all meat replaced by plant protein.',
    kgCo2ePerUnit: 3.4,
    uncertainty: 1.8,
    sourceName: 'Poore & Nemecek (2018), Science — via Our World in Data',
    sourceUrl: 'https://ourworldindata.org/environmental-impacts-of-food',
  },
  {
    key: 'food.waste_avoided',
    label: 'Ate leftovers instead of throwing food away',
    category: 'food',
    unit: 'kg of food',
    assumption: 'Mixed household food, counting both production and landfill methane.',
    kgCo2ePerUnit: 2.5,
    kgWastePerUnit: 1,
    uncertainty: 2,
    sourceName: 'US EPA WARM model / FAO food wastage footprint',
    sourceUrl: 'https://www.epa.gov/warm',
  },
  {
    key: 'food.dairy_milk_to_plant',
    label: 'Chose a plant milk over dairy',
    category: 'food',
    unit: 'litre',
    assumption: 'One litre of dairy milk replaced with oat or soy milk.',
    kgCo2ePerUnit: 2.3,
    litresWaterPerUnit: 550,
    uncertainty: 1.5,
    sourceName: 'Poore & Nemecek (2018), Science — via Our World in Data',
    sourceUrl: 'https://ourworldindata.org/environmental-impacts-of-food',
  },

  // ── Transport ───────────────────────────────────────────────────────────
  {
    key: 'transport.car_trip_avoided',
    label: 'Walked, cycled or skipped a car trip',
    category: 'transport',
    unit: 'km',
    assumption: 'An average petrol or diesel car, carrying one person.',
    kgCo2ePerUnit: 0.17,
    uncertainty: 1.4,
    sourceName: 'UK DEFRA/DESNZ greenhouse gas conversion factors',
    sourceUrl: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
  },
  {
    key: 'transport.car_to_bus',
    label: 'Took the bus instead of a car',
    category: 'transport',
    unit: 'km',
    assumption: 'Difference between a single-occupancy car and an average local bus.',
    kgCo2ePerUnit: 0.07,
    uncertainty: 1.5,
    sourceName: 'UK DEFRA/DESNZ greenhouse gas conversion factors',
    sourceUrl: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
  },
  {
    key: 'transport.car_to_train',
    label: 'Took the train instead of a car',
    category: 'transport',
    unit: 'km',
    assumption: 'Difference between a single-occupancy car and an average national rail journey.',
    kgCo2ePerUnit: 0.13,
    uncertainty: 1.5,
    sourceName: 'UK DEFRA/DESNZ greenhouse gas conversion factors',
    sourceUrl: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
  },
  {
    key: 'transport.carpooled',
    label: 'Shared a ride instead of travelling alone',
    category: 'transport',
    unit: 'km',
    assumption: 'One car trip shared with one other person, halving each share.',
    kgCo2ePerUnit: 0.085,
    uncertainty: 1.4,
    sourceName: 'UK DEFRA/DESNZ greenhouse gas conversion factors',
    sourceUrl: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
  },

  // ── Energy ──────────────────────────────────────────────────────────────
  {
    key: 'energy.electricity_saved',
    label: 'Used less electricity',
    category: 'energy',
    unit: 'kWh',
    assumption: 'Average US grid mix. Much lower on a clean grid, much higher on a coal-heavy one.',
    kgCo2ePerUnit: 0.37,
    uncertainty: 2.2,
    gridDependent: true,
    sourceName: 'US EPA eGRID, national average',
    sourceUrl: 'https://www.epa.gov/egrid',
  },
  {
    key: 'energy.laundry_cold_wash',
    label: 'Washed clothes on cold instead of hot',
    category: 'energy',
    unit: 'load',
    assumption: 'One machine load switched from a 40-60C cycle to cold.',
    kgCo2ePerUnit: 0.6,
    uncertainty: 1.8,
    gridDependent: true,
    sourceName: 'US EPA / Energy Saving Trust appliance figures',
    sourceUrl: 'https://www.energysavingtrust.org.uk/',
  },
  {
    key: 'energy.air_dried_laundry',
    label: 'Air-dried laundry instead of tumble drying',
    category: 'energy',
    unit: 'load',
    assumption: 'One full tumble-dryer cycle avoided.',
    kgCo2ePerUnit: 1.4,
    uncertainty: 1.8,
    gridDependent: true,
    sourceName: 'US EPA / Energy Saving Trust appliance figures',
    sourceUrl: 'https://www.energysavingtrust.org.uk/',
  },
  {
    key: 'energy.shorter_shower',
    label: 'Took a shorter shower',
    category: 'energy',
    unit: 'minute',
    assumption: 'One minute less under a 9 L/min showerhead with electric water heating.',
    kgCo2ePerUnit: 0.19,
    litresWaterPerUnit: 9,
    uncertainty: 2,
    gridDependent: true,
    sourceName: 'US EPA WaterSense / Energy Saving Trust',
    sourceUrl: 'https://www.epa.gov/watersense',
  },
  {
    key: 'energy.heating_turned_down',
    label: 'Turned the heating down a degree',
    category: 'energy',
    unit: 'day',
    assumption: 'One degree Celsius lower for a day in a typical heated home during the heating season.',
    kgCo2ePerUnit: 0.9,
    uncertainty: 2.5,
    sourceName: 'Energy Saving Trust home heating figures',
    sourceUrl: 'https://www.energysavingtrust.org.uk/',
  },

  // ── Waste and consumption ───────────────────────────────────────────────
  {
    key: 'waste.reusable_bottle',
    label: 'Used a reusable bottle instead of buying a plastic one',
    category: 'waste',
    unit: 'bottle',
    assumption: 'One 500 ml single-use PET bottle avoided, including production and disposal.',
    kgCo2ePerUnit: 0.08,
    kgWastePerUnit: 0.02,
    uncertainty: 1.6,
    sourceName: 'US EPA WARM model',
    sourceUrl: 'https://www.epa.gov/warm',
  },
  {
    key: 'waste.reusable_cup',
    label: 'Brought a reusable cup',
    category: 'waste',
    unit: 'cup',
    assumption: 'One disposable coffee cup and lid avoided.',
    kgCo2ePerUnit: 0.05,
    kgWastePerUnit: 0.015,
    uncertainty: 1.8,
    sourceName: 'US EPA WARM model',
    sourceUrl: 'https://www.epa.gov/warm',
  },
  {
    key: 'waste.recycled_can',
    label: 'Recycled an aluminium can',
    category: 'waste',
    unit: 'can',
    assumption: 'One can recycled rather than landfilled, counting avoided primary smelting.',
    kgCo2ePerUnit: 0.09,
    kgWastePerUnit: 0.015,
    uncertainty: 1.5,
    sourceName: 'US EPA WARM model',
    sourceUrl: 'https://www.epa.gov/warm',
  },
  {
    key: 'waste.declined_single_use_plastic',
    label: 'Turned down single-use plastic',
    category: 'waste',
    unit: 'item',
    assumption: 'One small plastic item — bag, straw, cutlery, wrapper.',
    kgCo2ePerUnit: 0.03,
    kgWastePerUnit: 0.008,
    uncertainty: 2,
    sourceName: 'US EPA WARM model',
    sourceUrl: 'https://www.epa.gov/warm',
  },
  {
    key: 'consumption.secondhand_clothing',
    label: 'Bought secondhand instead of new',
    category: 'consumption',
    unit: 'garment',
    assumption: 'One cotton t-shirt-equivalent garment, counting the new one not manufactured.',
    kgCo2ePerUnit: 2.1,
    litresWaterPerUnit: 2700,
    uncertainty: 2,
    sourceName: 'Ellen MacArthur Foundation / WRAP textiles data',
    sourceUrl: 'https://wrap.org.uk/taking-action/textiles',
  },
  {
    key: 'consumption.repaired_instead_of_replaced',
    label: 'Repaired something instead of replacing it',
    category: 'consumption',
    unit: 'item',
    assumption: 'A small household or electronic item kept in use for another year.',
    kgCo2ePerUnit: 5,
    uncertainty: 3,
    sourceName: 'WRAP product lifetime research',
    sourceUrl: 'https://wrap.org.uk/',
  },

  // ── Actions with no defensible number ───────────────────────────────────
  {
    key: 'engagement.not_quantified',
    label: 'Took action (not measured in carbon)',
    category: 'consumption',
    unit: 'action',
    assumption:
      'Learning, talking to someone, writing to a representative, joining a group. Real effects that carbon maths cannot honestly capture, so we log them and show no number.',
    kgCo2ePerUnit: 0,
    uncertainty: 1,
    sourceName: 'Not applicable',
    sourceUrl: '',
  },
] as const satisfies readonly ImpactFactor[];

/**
 * Keys stay literal (so `ImpactFactorKey` is a precise union and the AI schema
 * can enumerate them), while the exported array is widened to `ImpactFactor[]`.
 * Without the widening, optional fields like `gridDependent` are absent from
 * the union type for any factor that does not set them, and reading one fails
 * to compile at every call site.
 */
export type ImpactFactorKey = (typeof FACTOR_LITERALS)[number]['key'];

export const IMPACT_FACTORS: readonly ImpactFactor[] = FACTOR_LITERALS;

const BY_KEY = new Map<string, ImpactFactor>(IMPACT_FACTORS.map((f) => [f.key, f]));

export function getFactor(key: string): ImpactFactor | undefined {
  return BY_KEY.get(key);
}

export function isFactorKey(key: string): key is ImpactFactorKey {
  return BY_KEY.has(key);
}

/** Every key, for prompting the model with the exact allowed vocabulary. */
export const FACTOR_KEYS: readonly string[] = IMPACT_FACTORS.map((f) => f.key);

/** The key used when an action is real but not honestly quantifiable. */
export const UNQUANTIFIED_KEY = 'engagement.not_quantified';
