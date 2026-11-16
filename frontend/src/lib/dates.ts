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
