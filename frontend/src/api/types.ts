/**
 * Types miroir des schémas de l'API (backend/streaks/schemas.py).
 *
 * En TypeScript, un `type` ou une `interface` n'existe qu'à la compilation : il ne
 * reste rien dans le JS final. Ils servent à ce que l'éditeur et `tsc` nous
 * préviennent quand on se trompe de champ. Si le backend change, on change ici.
 */

export type Period = "day" | "week";

/** Les trois niveaux, ordonnés : 3 = objectif réel, 1 = minimum. */
export type Level = 1 | 2 | 3;

export interface PeriodStatus {
  start: string;
  end: string;
  count: number;
  required: number;
  validated: boolean;
  level: Level | null;
  is_current: boolean;
}

export interface Stats {
  current_streak: number;
  best_streak: number;
  total_checkins: number;
  periods_done: number;
  periods_validated: number;
  completion_rate: number | null;
  level_counts: Record<string, number>;
  current_period: PeriodStatus | null;
  last_checkin: string | null;
  today_level: Level | null;
  days_left_in_period: number;
  at_risk: boolean;
}

export interface Streak {
  id: number;
  name: string;
  description: string;
  emoji: string;
  color: string;
  period: Period;
  required_count: number;
  full_label: string;
  simplified_label: string;
  minimum_label: string;
  start_date: string;
  /** Jours planifiés, 0 = lundi … 6 = dimanche (hebdo). Vide en quotidien = tous les jours. */
  schedule_weekdays: number[];
  /** "HH:MM:SS" ou null (journée entière). */
  schedule_time: string | null;
  schedule_duration: number;
  reminder_minutes: number;
  has_schedule: boolean;
  google_event_id: string;
  google_synced_at: string | null;
  needs_sync: boolean;
  archived: boolean;
  created_at: string;
  stats: Stats;
}

/** Champs calculés par le serveur, jamais envoyés. */
type ServerOnly = "id" | "archived" | "created_at" | "stats" | "start_date" | "has_schedule" | "google_event_id" | "google_synced_at" | "needs_sync";

/** Corps envoyé pour créer un streak (POST). `Omit` retire les champs calculés par le serveur. */
export type StreakInput = Omit<Streak, ServerOnly> & {
  start_date: string | null;
};

/** PATCH : tous les champs optionnels, plus le bouton d'archivage. */
export type StreakPatch = Partial<StreakInput> & { archived?: boolean };

export interface CheckIn {
  date: string;
  level: Level;
  note: string;
  created_at: string;
  updated_at: string;
}

/* --- Agenda --------------------------------------------------------------- */

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string;
  calendar_name: string;
  calendar_id: string;
  last_sync_at: string | null;
  last_sync_summary: Partial<SyncResult>;
  pending_sync: number;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  errors: string[];
}

export interface AgendaCalendar {
  id: string;
  name: string;
  color: string;
  is_streak_calendar: boolean;
}

export interface AgendaEvent {
  id: string;
  calendar_id: string;
  calendar_name: string;
  color: string;
  title: string;
  /** "YYYY-MM-DD" si journée entière, sinon RFC 3339 avec fuseau. */
  start: string;
  end: string;
  all_day: boolean;
  streak_id: number | null;
  link: string;
}

export interface Agenda {
  start: string;
  end: string;
  calendars: AgendaCalendar[];
  events: AgendaEvent[];
}
