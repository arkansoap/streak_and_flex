/**
 * Hooks React Query de l'agenda. La synchronisation invalide aussi les streaks :
 * leurs champs `google_event_id` / `needs_sync` changent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as agendaApi from "../api/agenda";
import { keys as streakKeys } from "./useStreaks";

export const agendaKeys = {
  status: ["google", "status"] as const,
  range: (start: string, end: string) => ["agenda", start, end] as const,
};

export function useGoogleStatus() {
  return useQuery({ queryKey: agendaKeys.status, queryFn: agendaApi.getGoogleStatus });
}

export function useAgenda(start: string, end: string, enabled: boolean) {
  return useQuery({
    queryKey: agendaKeys.range(start, end),
    queryFn: () => agendaApi.getAgenda(start, end),
    enabled,
    staleTime: 60_000,
  });
}

export function useSyncAgenda() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (force: boolean) => agendaApi.syncAgenda(force),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["agenda"] });
      client.invalidateQueries({ queryKey: agendaKeys.status });
      client.invalidateQueries({ queryKey: streakKeys.all });
    },
  });
}

export function useDisconnectGoogle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: agendaApi.disconnectGoogle,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: agendaKeys.status });
      client.invalidateQueries({ queryKey: streakKeys.all });
    },
  });
}

/** Demande l'URL d'autorisation à l'API puis y envoie le navigateur (Google reviendra sur /agenda). */
export async function startGoogleConnect() {
  const { url } = await agendaApi.getConnectUrl();
  window.location.href = url;
}
