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
  archived: boolean;
  created_at: string;
  stats: Stats;
}

/** Corps envoyé pour créer un streak (POST). `Omit` retire les champs calculés par le serveur. */
export type StreakInput = Omit<Streak, "id" | "archived" | "created_at" | "stats" | "start_date"> & {
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
