/**
 * Hooks React Query : le cache serveur de l'application.
 *
 * Pour qui vient de Vue : `useQuery` remplace « un `ref` + un `onMounted` qui fetch +
 * un `loading` à la main ». Il gère le chargement, l'erreur, le cache et le
 * rafraîchissement. `useMutation` encapsule une écriture ; après succès on
 * *invalide* les clés concernées et React Query re-télécharge ce qui est affiché.
 *
 * Les clés sont hiérarchiques : invalider ["streaks"] rafraîchit aussi
 * ["streaks", 3], ["streaks", 3, "history"]… d'un coup.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as streaksApi from "../api/streaks";
import type { CheckIn, Level, StreakInput, StreakPatch } from "../api/types";

export const keys = {
  all: ["streaks"] as const,
  list: (archived: boolean) => ["streaks", "list", archived] as const,
  one: (id: number) => ["streaks", id] as const,
  history: (id: number, periods: number) => ["streaks", id, "history", periods] as const,
  checkins: (id: number, from?: string, to?: string) => ["streaks", id, "checkins", from, to] as const,
};

export function useStreaks(archived = false) {
  return useQuery({ queryKey: keys.list(archived), queryFn: () => streaksApi.listStreaks(archived) });
}

/** `enabled: false` quand il n'y a pas d'id (page de création) : aucun appel n'est fait. */
export function useStreak(id: number | null) {
  return useQuery({ queryKey: keys.one(id ?? 0), queryFn: () => streaksApi.getStreak(id ?? 0), enabled: id !== null });
}

export function useHistory(id: number, periods = 12) {
  return useQuery({ queryKey: keys.history(id, periods), queryFn: () => streaksApi.getHistory(id, periods) });
}

export function useCheckIns(id: number, from?: string, to?: string) {
  return useQuery({
    queryKey: keys.checkins(id, from, to),
    queryFn: () => streaksApi.listCheckIns(id, from, to),
  });
}

/** Petit utilitaire : un hook qui renvoie « invalide tout ce qui touche aux streaks ». */
function useInvalidateStreaks() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: keys.all });
}

export function useCreateStreak() {
  const invalidate = useInvalidateStreaks();
  return useMutation({ mutationFn: (input: StreakInput) => streaksApi.createStreak(input), onSuccess: invalidate });
}

export function useUpdateStreak(id: number) {
  const invalidate = useInvalidateStreaks();
  return useMutation({ mutationFn: (patch: StreakPatch) => streaksApi.updateStreak(id, patch), onSuccess: invalidate });
}

export function useDeleteStreak() {
  const invalidate = useInvalidateStreaks();
  return useMutation({ mutationFn: (id: number) => streaksApi.deleteStreak(id), onSuccess: invalidate });
}

/**
 * Coche ou décoche un jour. `level: null` = décocher.
 * Un seul hook pour les deux pour que les composants n'aient qu'un bouton à brancher.
 */
export function useSetCheckIn(streakId: number) {
  const invalidate = useInvalidateStreaks();
  return useMutation({
    mutationFn: async ({ date, level, note }: { date: string; level: Level | null; note?: string }): Promise<CheckIn | null> => {
      if (level === null) {
        await streaksApi.deleteCheckIn(streakId, date);
        return null;
      }
      return streaksApi.putCheckIn(streakId, date, level, note);
    },
    onSuccess: invalidate,
  });
}
