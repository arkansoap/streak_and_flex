/**
 * Appels à /api/streaks, un par route du backend (docs/API.md).
 * Aucun état ici : ce sont de simples fonctions asynchrones, testables sans React.
 */

import { api } from "./client";
import type { CheckIn, Level, PeriodStatus, Streak, StreakInput, StreakPatch } from "./types";

export const listStreaks = (archived = false) => api<Streak[]>(`/streaks?archived=${archived}`);

export const getStreak = (id: number) => api<Streak>(`/streaks/${id}`);

export const createStreak = (input: StreakInput) => api<Streak>("/streaks", { method: "POST", json: input });

export const updateStreak = (id: number, patch: StreakPatch) =>
  api<Streak>(`/streaks/${id}`, { method: "PATCH", json: patch });

export const deleteStreak = (id: number) => api<void>(`/streaks/${id}`, { method: "DELETE" });

export const getHistory = (id: number, periods = 12) =>
  api<PeriodStatus[]>(`/streaks/${id}/history?periods=${periods}`);

export const listCheckIns = (id: number, dateFrom?: string, dateTo?: string) => {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const query = params.size ? `?${params}` : "";
  return api<CheckIn[]>(`/streaks/${id}/checkins${query}`);
};

export const putCheckIn = (id: number, date: string, level: Level, note = "") =>
  api<CheckIn>(`/streaks/${id}/checkins/${date}`, { method: "PUT", json: { level, note } });

export const deleteCheckIn = (id: number, date: string) =>
  api<void>(`/streaks/${id}/checkins/${date}`, { method: "DELETE" });
