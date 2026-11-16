/**
 * Détail d'un streak : stats, heatmap cliquable pour (dé)cocher n'importe quel jour
 * passé, historique des périodes, actions (modifier, archiver, supprimer).
 */

import type { CSSProperties } from "react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { Level } from "../api/types";
import { Heatmap } from "../components/Heatmap";
import { LevelPicker } from "../components/LevelPicker";
import { StatTile } from "../components/StatTile";
import { useCheckIns, useDeleteStreak, useHistory, useSetCheckIn, useStreak, useUpdateStreak } from "../hooks/useStreaks";
import { addDays, formatLong, formatShort, mondayOf, todayIso } from "../lib/dates";
import { LEVELS } from "../lib/levels";
import { errorMessage, statusOf, unit } from "../lib/status";

const WEEKS = 16;

export function StreakDetailPage() {
  // `useParams` lit `:id` de la route ; c'est une string, on la convertit.
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const from = addDays(mondayOf(todayIso()), -7 * (WEEKS - 1));
  const streakQuery = useStreak(id);
  const checkinsQuery = useCheckIns(id, from);
  const historyQuery = useHistory(id, 12);
  const setCheckIn = useSetCheckIn(id);
  const update = useUpdateStreak(id);
  const remove = useDeleteStreak();

  if (streakQuery.isPending) return <p className="muted">Chargement…</p>;
  if (streakQuery.isError) return <p className="error">{errorMessage(streakQuery.error)}</p>;

  const streak = streakQuery.data;
  const { stats } = streak;
  const { label, tone } = statusOf(streak);
  const levels = new Map<string, Level>((checkinsQuery.data ?? []).map((c) => [c.date, c.level]));
  const labels = { 1: streak.minimum_label, 2: streak.simplified_label, 3: streak.full_label };
  const day = selectedDay ?? todayIso();
  const dayCheckIn = (checkinsQuery.data ?? []).find((c) => c.date === day);
  const rate = stats.completion_rate === null ? "—" : `${Math.round(stats.completion_rate * 100)} %`;

  function onLevel(level: Level | null) {
    setCheckIn.mutate({ date: day, level, note: note || dayCheckIn?.note }, { onSuccess: () => setNote("") });
  }

  async function onDelete() {
    if (!window.confirm(`Supprimer « ${streak.name} » et tout son historique ?`)) return;
    await remove.mutateAsync(id);
    navigate("/");
  }

  return (
    <div className="detail" style={{ "--c": streak.color } as CSSProperties}>
      <header className="detail-head">
        <div>
          <h1>
            <span className="emoji">{streak.emoji}</span> {streak.name}
          </h1>
          <p className="muted">
            {streak.period === "day" ? "Chaque jour" : `${streak.required_count} × par semaine`} · depuis le{" "}
            {formatShort(streak.start_date)}
            {streak.archived && " · archivé"}
          </p>
          {streak.description && <p className="description">{streak.description}</p>}
        </div>
        <div className="actions">
          <Link to={`/streaks/${id}/edit`} className="btn">
            Modifier
          </Link>
          <button type="button" className="btn" onClick={() => update.mutate({ archived: !streak.archived })}>
            {streak.archived ? "Désarchiver" : "Archiver"}
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            Supprimer
          </button>
        </div>
      </header>

      <section className="stats">
        <StatTile label={`streak en cours (${unit(streak, 2)})`} value={stats.current_streak} hint={label} />
        <StatTile label="record" value={stats.best_streak} />
        <StatTile label="réussite" value={rate} hint={`${stats.periods_validated}/${stats.periods_done} périodes terminées`} />
        <StatTile label="check-ins" value={stats.total_checkins} />
      </section>

      <section className="panel">
        <h2>
          {formatLong(day)} <span className={`badge badge-${selectedDay ? "neutral" : tone}`}>{selectedDay ? "jour sélectionné" : label}</span>
        </h2>
        {streak.archived ? (
          <p className="muted">Streak archivé : désarchive-le pour cocher.</p>
        ) : (
          <>
            <LevelPicker streak={streak} value={dayCheckIn?.level ?? null} onChange={onLevel} disabled={setCheckIn.isPending} />
            <input
              className="input"
              placeholder={dayCheckIn?.note || "Note (facultatif) — enregistrée au clic sur un niveau"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {setCheckIn.isError && <p className="error">{errorMessage(setCheckIn.error)}</p>}
          </>
        )}
        {selectedDay && (
          <button type="button" className="link" onClick={() => setSelectedDay(null)}>
            Revenir à aujourd'hui
          </button>
        )}
      </section>

      <section className="panel">
        <h2>Les {WEEKS} dernières semaines</h2>
        <Heatmap
          color={streak.color}
          levels={levels}
          weeks={WEEKS}
          startDate={streak.start_date}
          selected={day}
          onSelect={(d) => setSelectedDay(d === todayIso() ? null : d)}
          labels={labels}
        />
        <p className="muted small">Clique une case pour cocher ou corriger un jour passé.</p>
      </section>

      <section className="panel two-cols">
        <div>
          <h2>Répartition</h2>
          <ul className="plain">
            {LEVELS.map(({ level, key, short }) => (
              <li key={level}>
                <strong>{stats.level_counts[level] ?? 0}</strong> × {short} <span className="muted">— {streak[key]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Dernières périodes</h2>
          {historyQuery.data && (
            <ul className="plain periods">
              {[...historyQuery.data].reverse().map((p) => (
                <li key={p.start} className={p.validated ? "ok" : p.is_current ? "current" : "ko"}>
                  <span>
                    {streak.period === "day" ? formatShort(p.start) : `${formatShort(p.start)} → ${formatShort(p.end)}`}
                  </span>
                  <span>
                    {p.validated ? "validée" : p.is_current ? "en cours" : "manquée"}
                    {p.required > 1 && ` (${p.count}/${p.required})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
