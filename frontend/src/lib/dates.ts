/**
 * Dates au format ISO `YYYY-MM-DD` en heure locale, jamais en UTC : un check-in
 * fait à 23 h 30 à Paris doit tomber sur le bon jour. `Date.toISOString()` est
 * donc banni ici.
 */

export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** Lundi de la semaine contenant `iso` (semaine ISO, comme le backend). */
export function mondayOf(iso: string): string {
  const date = parseIso(iso);
  const offset = (date.getDay() + 6) % 7;
  return addDays(iso, -offset);
}

const longFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const shortFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export const formatLong = (iso: string) => longFormat.format(parseIso(iso));
export const formatShort = (iso: string) => shortFormat.format(parseIso(iso));

export function isToday(iso: string): boolean {
  return iso === todayIso();
}

export const WEEKDAY_SHORT = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
export const WEEKDAY_LETTER = ["L", "M", "M", "J", "V", "S", "D"];

const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

export const formatMonth = (iso: string) => monthFormat.format(parseIso(iso));

/** "18:30" depuis une date RFC 3339 (événement horodaté). */
export const formatTime = (rfc3339: string) => timeFormat.format(new Date(rfc3339));

/** "HH:MM" depuis "HH:MM:SS" (heure de planning renvoyée par Django). */
export const shortTime = (hms: string) => hms.slice(0, 5);

/** Jour local (ISO) d'un début d'événement : date nue ou date-heure avec fuseau. */
export function dayOf(start: string): string {
  return start.length === 10 ? start : toIso(new Date(start));
}

export function firstOfMonth(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function addMonths(iso: string, months: number): string {
  const d = parseIso(firstOfMonth(iso));
  d.setMonth(d.getMonth() + months);
  return toIso(d);
}

/** Grille du mois : du lundi de la 1re semaine au dimanche de la dernière, par semaines de 7. */
export function monthGrid(iso: string): string[][] {
  const first = firstOfMonth(iso);
  const last = addDays(addMonths(first, 1), -1);
  const start = mondayOf(first);
  const end = addDays(mondayOf(last), 6);
  const weeks: string[][] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
  }
  return weeks;
}

/** Résumé lisible d'un planning : « tous les jours à 18:30 », « mer. et sam. (journée) ». */
export function describeSchedule(period: "day" | "week", weekdays: number[], time: string | null): string {
  const when = time ? `à ${shortTime(time)}` : "(journée)";
  if (period === "day") return time ? `tous les jours ${when}` : "";
  if (weekdays.length === 0) return "";
  const names = weekdays.map((d) => WEEKDAY_SHORT[d]);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names[0];
  return `${list} ${when}`;
}
