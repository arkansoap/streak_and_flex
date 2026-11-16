/**
 * Carte d'un streak sur la page liste : état du jour, compteur, trois boutons pour
 * cocher aujourd'hui sans quitter la page.
 */

import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

import type { Streak } from "../api/types";
import { useSetCheckIn } from "../hooks/useStreaks";
import { todayIso } from "../lib/dates";
import { errorMessage, statusOf, unit } from "../lib/status";
import { LevelPicker } from "./LevelPicker";

interface Props {
  streak: Streak;
}

export function StreakCard({ streak }: Props) {
  const setCheckIn = useSetCheckIn(streak.id);
  const { label, tone } = statusOf(streak);
  const { stats } = streak;

  return (
    <article className="card" style={{ "--c": streak.color } as CSSProperties}>
      <header className="card-head">
        <Link to={`/streaks/${streak.id}`} className="card-title">
          <span className="emoji">{streak.emoji || "•"}</span>
          <span>{streak.name}</span>
        </Link>
        <span className={`badge badge-${tone}`}>{label}</span>
      </header>

      <div className="card-streak">
        <span className="flame" aria-hidden="true">
          🔥
        </span>
        <span className="count">{stats.current_streak}</span>
        <span className="unit">{unit(streak, stats.current_streak)}</span>
        {stats.best_streak > stats.current_streak && <span className="muted">· record {stats.best_streak}</span>}
      </div>

      {!streak.archived && (
        <>
          <p className="muted small">Aujourd'hui, j'ai fait :</p>
          <LevelPicker
            streak={streak}
            value={stats.today_level}
            disabled={setCheckIn.isPending}
            onChange={(level) => setCheckIn.mutate({ date: todayIso(), level })}
            compact
          />
          {setCheckIn.isError && <p className="error">{errorMessage(setCheckIn.error)}</p>}
        </>
      )}
    </article>
  );
}
