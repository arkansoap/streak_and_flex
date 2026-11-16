/**
 * Tout ce qui décrit les trois niveaux côté interface.
 *
 * `as const` fige le tableau : TypeScript sait alors que `level` vaut 3, 2 ou 1 et
 * pas « un number quelconque ». C'est l'équivalent d'un enum sans enum (le projet
 * compile avec `erasableSyntaxOnly`, qui interdit les enums TS).
 */

import type { Level, Streak } from "../api/types";

export const LEVELS = [
  { level: 3, key: "full_label", short: "Réel", hint: "L'objectif tel que prévu" },
  { level: 2, key: "simplified_label", short: "Simplifié", hint: "La version allégée" },
  { level: 1, key: "minimum_label", short: "Minimum", hint: "Le strict minimum pour tenir" },
] as const satisfies readonly { level: Level; key: keyof Streak; short: string; hint: string }[];

export function labelFor(streak: Streak, level: Level): string {
  const def = LEVELS.find((l) => l.level === level);
  return def ? streak[def.key] : "";
}

/**
 * Intensité de couleur d'un niveau : échelle séquentielle, une seule teinte (celle du
 * streak), du clair au foncé. 0 = rien fait. Utilisée via `color-mix` dans le CSS.
 */
export function intensity(level: Level | null): 0 | 1 | 2 | 3 {
  return level ?? 0;
}
