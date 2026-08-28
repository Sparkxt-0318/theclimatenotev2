/**
 * Climate notes: the reader's commitments, and checking them off.
 *
 * The impact figure on a completion is computed HERE, from the shared factor
 * table, and stored alongside the row. It is deliberately a snapshot: revising
 * a factor later must not retroactively change a number a reader was already
 * shown.
 */

import { getFactor, toIsoDate, UNQUANTIFIED_KEY } from '@climatenote/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { supabase } from '@/lib/supabase';

export type NoteRow = {
  id: string;
  article_id: string;
  option_id: string | null;
  custom_text: string | null;
  factor_key: string | null;
  estimated_quantity: number | null;
  created_at: string;
  archived_at: string | null;
  reflection_options: { title: string; detail: string; factor_key: string; estimated_quantity: number } | null;
  articles: { title: string; slug: string } | null;
  note_completions: { completed_on: string }[];
};

export const noteKeys = {
  all: ['notes'] as const,
  forArticle: (articleId: string) => ['notes', 'article', articleId] as const,
};

export function useNotes() {
  const { isSignedIn } = useAuth();

  return useQuery({
    queryKey: noteKeys.all,
    enabled: isSignedIn,
    queryFn: async (): Promise<NoteRow[]> => {
      const { data, error } = await supabase
        .from('climate_notes')
        .select(
          `id, article_id, option_id, custom_text, factor_key, estimated_quantity,
           created_at, archived_at,
           reflection_options (title, detail, factor_key, estimated_quantity),
           articles (title, slug),
           note_completions (completed_on)`,
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as NoteRow[];
    },
  });
}

/** Commit to one of the generated options, or to the reader's own words. */
export function useCreateNote() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      articleId: string;
      optionId?: string;
      customText?: string;
      factorKey?: string;
      estimatedQuantity?: number;
      mappingConfidence?: number;
    }) => {
      if (!userId) throw new Error('Sign in to save a note.');

      const { data, error } = await supabase
        .from('climate_notes')
        .insert({
          user_id: userId,
          article_id: input.articleId,
          option_id: input.optionId ?? null,
          custom_text: input.customText ?? null,
          factor_key: input.factorKey ?? null,
          estimated_quantity: input.estimatedQuantity ?? null,
          mapping_confidence: input.mappingConfidence ?? null,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: noteKeys.all });
    },
  });
}

/**
 * Check a note off for a day.
 *
 * Idempotent by design: the table has a unique constraint on
 * (note_id, completed_on), so a double tap cannot double-count a day.
 */
export function useCompleteNote() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      noteId: string;
      factorKey: string | null;
      quantity: number | null;
      date?: Date;
    }) => {
      if (!userId) throw new Error('Sign in to track an action.');

      const factor = input.factorKey ? getFactor(input.factorKey) : undefined;
      const quantity = input.quantity ?? 1;

      // An action we cannot map is still logged — it just carries no number.
      // Inventing one would be worse than showing none.
      const quantified = factor !== undefined && factor.key !== UNQUANTIFIED_KEY;

      const { error } = await supabase.from('note_completions').insert({
        note_id: input.noteId,
        user_id: userId,
        completed_on: toIsoDate(input.date ?? new Date()),
        kg_co2e: quantified ? factor.kgCo2ePerUnit * quantity : 0,
        litres_water: quantified ? (factor.litresWaterPerUnit ?? 0) * quantity : 0,
        kg_waste: quantified ? (factor.kgWastePerUnit ?? 0) * quantity : 0,
        quantified,
      });

      // 23505 is the unique violation: already checked off today. That is the
      // user tapping twice, not a failure worth surfacing.
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: noteKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['impact'] });
    },
  });
}

export function useUncompleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { noteId: string; date?: Date }) => {
      const { error } = await supabase
        .from('note_completions')
        .delete()
        .eq('note_id', input.noteId)
        .eq('completed_on', toIsoDate(input.date ?? new Date()));
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: noteKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['impact'] });
    },
  });
}
