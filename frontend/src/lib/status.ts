/** Phrase d'état d'un streak pour la carte et le détail (jamais une couleur seule). */

import type { Streak } from "../api/types";

export type Tone = "good" | "warning" | "neutral";

export function unit(streak: Streak, count: number): string {
  if (streak.period === "week") return count > 1 ? "semaines" : "semaine";
  return count > 1 ? "jours" : "jour";
}

export function statusOf(streak: Streak): { label: string; tone: Tone } {
  const { current_period: period, at_risk, days_left_in_period: left } = streak.stats;
  if (!period) return { label: "Pas encore commencé", tone: "neutral" };
  if (period.validated) {
    return { label: streak.period === "day" ? "Validé aujourd'hui ✓" : "Semaine validée ✓", tone: "good" };
  }
  if (streak.period === "day") return { label: "À faire aujourd'hui", tone: at_risk ? "warning" : "neutral" };
  const progress = period.required > 1 ? `${period.count}/${period.required} · ` : "";
  if (at_risk) return { label: `${progress}dernier jour de la semaine !`, tone: "warning" };
  return { label: `${progress}encore ${left} ${left > 1 ? "jours" : "jour"}`, tone: "neutral" };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
