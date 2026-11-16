/** Appels à /api/google (connexion) et /api/agenda (synchronisation, lecture). */

import { api } from "./client";
import type { Agenda, GoogleStatus, SyncResult } from "./types";

export const getGoogleStatus = () => api<GoogleStatus>("/google/status");

export const getConnectUrl = () => api<{ url: string }>("/google/connect");

export const disconnectGoogle = () => api<void>("/google/disconnect", { method: "POST" });

export const syncAgenda = (force = false) => api<SyncResult>(`/agenda/sync?force=${force}`, { method: "POST" });

export const getAgenda = (start: string, end: string) => api<Agenda>(`/agenda/events?start=${start}&end=${end}`);
