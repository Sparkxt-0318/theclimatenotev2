/**
 * Impact totals, week strip and streak.
 *
 * The heavy lifting is in Postgres views and functions that run under the
 * caller's own privileges, so a reader can only ever see their own numbers.
 */

import { levelFor, toIsoDate, type CalendarDay } from '@climatenote/shared';
import { useQuery } from '@tanstack/react-query';

import {
  DEMO_CATEGORIES,
  DEMO_MODE,
  DEMO_STREAK,
  DEMO_TOTALS,
  DEMO_WEEK,
} from '@/demo';
import { useAuth } from '@/features/auth';
import { supabase } from '@/lib/supabase';

export type ImpactTotalsRow = {
  kg_co2e: number;
  litres_water: number;
  kg_waste: number;
  total_actions: number;
  unquantified_actions: number;
};

export type CategoryRow = { category: string; kg_co2e: number; actions: number };

export const impactKeys = {
  totals: ['impact', 'totals'] as const,
  week: (end: string) => ['impact', 'week', end] as const,
  categories: ['impact', 'categories'] as const,
};

export function useImpactTotals() {
  const { isSignedIn } = useAuth();

  return useQuery({
    queryKey: impactKeys.totals,
    enabled: isSignedIn || DEMO_MODE,
    queryFn: async (): Promise<ImpactTotalsRow> => {
      if (DEMO_MODE) return DEMO_TOTALS;

      const { data, error } = await supabase.from('user_impact_totals').select('*').maybeSingle();
      if (error) throw error;
      // No rows means no completions yet, which is a valid state for a new
      // account rather than an error.
      return (
        (data as ImpactTotalsRow | null) ?? {
          kg_co2e: 0,
          litres_water: 0,
          kg_waste: 0,
          total_actions: 0,
          unquantified_actions: 0,
        }
      );
    },
  });
}

export function useWeekProgress(endDate: Date = new Date()) {
  const { isSignedIn } = useAuth();
  const end = toIsoDate(endDate);

  return useQuery({
    queryKey: impactKeys.week(end),
    enabled: isSignedIn || DEMO_MODE,
    queryFn: async (): Promise<CalendarDay[]> => {
      if (DEMO_MODE) return DEMO_WEEK.map((day) => ({ ...day, level: levelFor(day) }));

      const { data, error } = await supabase.rpc('user_week_progress', { p_end: end });
      if (error) throw error;

      const rows = (data ?? []) as { day: string; committed: number; completed: number }[];
      return rows.map((row) => {
        const progress = {
          date: row.day,
          committed: row.committed,
          completed: row.completed,
        };
        // Level is computed client-side from the shared rule, so the app and
        // any future web view shade a day identically.
        return { ...progress, level: levelFor(progress) };
      });
    },
  });
}

export function useStreak(endDate: Date = new Date()) {
  const { isSignedIn } = useAuth();
  const end = toIsoDate(endDate);

  return useQuery({
    queryKey: ['impact', 'streak', end],
    enabled: isSignedIn || DEMO_MODE,
    queryFn: async (): Promise<number> => {
      if (DEMO_MODE) return DEMO_STREAK;

      const { data, error } = await supabase.rpc('user_current_streak', { p_end: end });
      if (error) throw error;
      return (data as number | null) ?? 0;
    },
  });
}

export function useImpactByCategory() {
  const { isSignedIn } = useAuth();

  return useQuery({
    queryKey: impactKeys.categories,
    enabled: isSignedIn || DEMO_MODE,
    queryFn: async (): Promise<CategoryRow[]> => {
      if (DEMO_MODE) return DEMO_CATEGORIES;

      const { data, error } = await supabase
        .from('user_impact_by_category')
        .select('category, kg_co2e, actions')
        .order('kg_co2e', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });
}
