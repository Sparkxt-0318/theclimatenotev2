/**
 * Impact arithmetic and the weekly calendar.
 *
 * All of this is deterministic and testable. Given the same completions it
 * always produces the same numbers, which is what lets us show a figure to a
 * reader and stand behind it.
 */

import { getFactor, UNQUANTIFIED_KEY, type ImpactCategory } from './factors';

export type Completion = {
  /** ISO date, `YYYY-MM-DD`, in the user's local timezone. */
  completedOn: string;
  factorKey: string;
  /** How many units of the factor. Defaults to 1. */
  quantity: number;
};

export type ImpactTotals = {
  kgCo2e: number;
  litresWater: number;
  kgWaste: number;
  /** Actions logged that carry no carbon figure, counted separately. */
  unquantifiedActions: number;
  totalActions: number;
};

export const EMPTY_TOTALS: ImpactTotals = {
  kgCo2e: 0,
  litresWater: 0,
  kgWaste: 0,
  unquantifiedActions: 0,
  totalActions: 0,
};

export function impactOf(completion: Completion): ImpactTotals {
  const factor = getFactor(completion.factorKey);
  // An unknown key means data we cannot interpret. Count the action, claim no
  // savings — silently dropping it would understate the user's week, and
  // guessing would overstate it.
  if (!factor) {
    return { ...EMPTY_TOTALS, unquantifiedActions: 1, totalActions: 1 };
  }

  const quantity = Number.isFinite(completion.quantity) ? Math.max(0, completion.quantity) : 0;
  const unquantified = factor.key === UNQUANTIFIED_KEY ? 1 : 0;

  return {
    kgCo2e: factor.kgCo2ePerUnit * quantity,
    litresWater: (factor.litresWaterPerUnit ?? 0) * quantity,
    kgWaste: (factor.kgWastePerUnit ?? 0) * quantity,
    unquantifiedActions: unquantified,
    totalActions: 1,
  };
}

export function sumImpact(completions: readonly Completion[]): ImpactTotals {
  return completions.reduce<ImpactTotals>((total, completion) => {
    const one = impactOf(completion);
    return {
      kgCo2e: total.kgCo2e + one.kgCo2e,
      litresWater: total.litresWater + one.litresWater,
      kgWaste: total.kgWaste + one.kgWaste,
      unquantifiedActions: total.unquantifiedActions + one.unquantifiedActions,
      totalActions: total.totalActions + one.totalActions,
    };
  }, EMPTY_TOTALS);
}

export function impactByCategory(
  completions: readonly Completion[],
): Partial<Record<ImpactCategory, number>> {
  const byCategory: Partial<Record<ImpactCategory, number>> = {};
  for (const completion of completions) {
    const factor = getFactor(completion.factorKey);
    if (!factor) continue;
    const kg = factor.kgCo2ePerUnit * Math.max(0, completion.quantity);
    byCategory[factor.category] = (byCategory[factor.category] ?? 0) + kg;
  }
  return byCategory;
}

// ── Calendar ────────────────────────────────────────────────────────────────

/** 0 = nothing logged, 4 = everything committed for that day was completed. */
export type CalendarLevel = 0 | 1 | 2 | 3 | 4;

export type DayProgress = {
  date: string;
  /** Commitments the user had open on that day. */
  committed: number;
  /** How many of them they checked off. */
  completed: number;
};

export type CalendarDay = DayProgress & { level: CalendarLevel };

/**
 * Maps a day's progress onto the five-step green scale.
 *
 * Deliberately generous at the bottom: checking off anything at all lifts the
 * day off zero. The scale is about showing up, not about hitting a quota — a
 * teenager who did one thing should see green, not a nearly-empty square.
 */
export function levelFor({ committed, completed }: DayProgress): CalendarLevel {
  if (completed <= 0) return 0;
  if (committed <= 0) return 2; // completed something with nothing formally committed
  const ratio = completed / committed;
  if (ratio >= 1) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.3) return 2;
  return 1;
}

/** ISO `YYYY-MM-DD` for a Date, in local time rather than UTC. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/**
 * The seven days ending on `endDate` inclusive, oldest first. Days with no
 * activity are present with level 0 rather than missing, so the strip always
 * renders seven cells.
 */
export function weekStrip(endDate: string, progress: readonly DayProgress[]): CalendarDay[] {
  const byDate = new Map(progress.map((p) => [p.date, p]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(endDate, index - 6);
    const day = byDate.get(date) ?? { date, committed: 0, completed: 0 };
    return { ...day, level: levelFor(day) };
  });
}

/**
 * Consecutive days ending at `endDate` on which the user completed something.
 *
 * The current day is exempt: a streak should not appear broken at 9am simply
 * because the day is not over yet. Yesterday is where the streak is judged.
 */
export function currentStreak(endDate: string, progress: readonly DayProgress[]): number {
  const active = new Set(progress.filter((p) => p.completed > 0).map((p) => p.date));
  let streak = 0;
  let cursor = active.has(endDate) ? endDate : addDays(endDate, -1);
  while (active.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// ── Presentation ────────────────────────────────────────────────────────────

/**
 * Formats a carbon figure at a precision the underlying data can support.
 *
 * These factors carry uncertainty of 1.5-3x, so rendering "9.83 kg" would be
 * false precision. Anything above 10 kg rounds to whole numbers, and large
 * values switch to tonnes.
 */
export function formatKgCo2e(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return '0 kg';
  if (kg < 1) return `${kg.toFixed(1)} kg`;
  if (kg < 10) return `${kg.toFixed(1)} kg`;
  if (kg < 1000) return `${Math.round(kg)} kg`;
  return `${(kg / 1000).toFixed(1)} tonnes`;
}

/**
 * A comparison that means something to a teenager. Returns null rather than
 * reaching for a strained analogy when the total is too small to compare.
 */
export function equivalentOf(kgCo2e: number): string | null {
  if (kgCo2e < 2) return null;
  // 0.17 kg CO2e per car km, per the transport factors.
  const carKm = kgCo2e / 0.17;
  if (carKm < 400) return `about ${Math.round(carKm)} km not driven`;
  // A tree absorbs very roughly 21 kg CO2 a year.
  const treeYears = kgCo2e / 21;
  if (treeYears < 50) return `about what ${Math.round(treeYears)} trees absorb in a year`;
  return `about ${(kgCo2e / 1000).toFixed(1)} tonnes of CO2e`;
}
