/**
 * Les trois boutons de validation d'un jour.
 *
 * Composant « contrôlé » : il ne garde aucun état, il affiche `value` et appelle
 * `onChange`. Recliquer sur le niveau déjà choisi décoche (`null`). C'est au parent
 * (carte ou page détail) de parler à l'API.
 */

import type { CSSProperties } from "react";

import type { Level, Streak } from "../api/types";
import { LEVELS } from "../lib/levels";

interface Props {
  streak: Streak;
  value: Level | null;
  onChange: (level: Level | null) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function LevelPicker({ streak, value, onChange, disabled, compact }: Props) {
  return (
    <div className={`levels ${compact ? "levels-compact" : ""}`} style={{ "--c": streak.color } as CSSProperties}>
      {LEVELS.map(({ level, key, short, hint }) => {
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            className={`level level-${level} ${selected ? "selected" : ""}`}
            aria-pressed={selected}
            disabled={disabled}
            title={`${hint}${selected ? " — cliquer pour décocher" : ""}`}
            onClick={() => onChange(selected ? null : level)}
          >
            <span className="level-dot" aria-hidden="true" />
            <span className="level-text">
              <span className="level-short">{short}</span>
              <span className="level-label">{streak[key]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
