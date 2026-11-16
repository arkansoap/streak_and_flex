/**
 * Grille façon GitHub : une colonne par semaine, une ligne par jour (lundi en haut).
 *
 * Couleur = échelle séquentielle à une teinte (celle du streak) : plus le niveau est
 * haut, plus la case est foncée. Une légende textuelle accompagne toujours la grille.
 * Cliquer une case passée la sélectionne pour la cocher/décocher dans le parent.
 *
 * Sur écran étroit la grille déborde : elle défile horizontalement et se positionne
 * d'emblée sur les semaines les plus récentes (à droite), les seules qui comptent au
 * quotidien. `useRef` donne accès à l'élément DOM, `useEffect` agit après le rendu.
 */

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

import type { Level } from "../api/types";
import { addDays, formatLong, isToday, mondayOf, todayIso } from "../lib/dates";

interface Props {
  color: string;
  /** date ISO → niveau coché. */
  levels: Map<string, Level>;
  weeks?: number;
  startDate: string;
  selected: string | null;
  onSelect: (date: string) => void;
  labels: { 1: string; 2: string; 3: string };
}

const DAY_NAMES = ["L", "M", "M", "J", "V", "S", "D"];

export function Heatmap({ color, levels, weeks = 16, startDate, selected, onSelect, labels }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  const today = todayIso();
  const firstMonday = addDays(mondayOf(today), -7 * (weeks - 1));

  // Construit la liste des colonnes (semaines), chacune avec ses 7 jours.
  const columns = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(firstMonday, w * 7 + d)),
  );

  return (
    <div className="heatmap" style={{ "--c": color } as CSSProperties}>
      <div className="heatmap-scroll" ref={scroller}>
      <div className="heatmap-days" aria-hidden="true">
        {DAY_NAMES.map((name, i) => (
          <span key={i}>{name}</span>
        ))}
      </div>
      <div className="heatmap-grid" role="grid" aria-label="Historique des jours">
        {columns.map((days, w) => (
          <div className="heatmap-col" key={w} role="row">
            {days.map((date) => {
              const level = levels.get(date) ?? null;
              const future = date > today;
              const beforeStart = date < startDate;
              const title = future
                ? formatLong(date)
                : `${formatLong(date)} — ${level ? labels[level] : "rien"}`;
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  className={[
                    "cell",
                    `cell-${level ?? 0}`,
                    future ? "cell-future" : "",
                    beforeStart ? "cell-before" : "",
                    isToday(date) ? "cell-today" : "",
                    selected === date ? "cell-selected" : "",
                  ].join(" ")}
                  title={title}
                  aria-label={title}
                  disabled={future}
                  onClick={() => onSelect(date)}
                />
              );
            })}
          </div>
        ))}
      </div>
      </div>
      <div className="heatmap-legend">
        <span>
          <i className="cell cell-0" /> rien
        </span>
        <span>
          <i className="cell cell-1" /> {labels[1]}
        </span>
        <span>
          <i className="cell cell-2" /> {labels[2]}
        </span>
        <span>
          <i className="cell cell-3" /> {labels[3]}
        </span>
      </div>
    </div>
  );
}
