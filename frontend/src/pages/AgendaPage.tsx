/**
 * Page Agenda : connexion Google, bouton Synchroniser, et l'agenda complet (tous les
 * calendriers Google) en vue semaine ou mois.
 *
 * L'app ne fait que lire l'agenda et pousser les créneaux des streaks dans le calendrier
 * dédié. Aucune validation ne passe par Google.
 *
 * `useSearchParams` lit `?google=connected|refused|bad_state|error`, posé par le backend
 * au retour de Google, pour afficher un message une fois.
 *
 * Les calendriers se cochent / décochent sous la grille ; le filtre est côté navigateur
 * (l'API renvoie tout) et le choix est mémorisé dans `localStorage`, par appareil.
 */

import type { CSSProperties } from "react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { AgendaEvent } from "../api/types";
import { useAgenda, useDisconnectGoogle, useGoogleStatus, useSyncAgenda, startGoogleConnect } from "../hooks/useAgenda";
import {
  WEEKDAY_SHORT,
  addDays,
  addMonths,
  dayOf,
  firstOfMonth,
  formatLong,
  formatMonth,
  formatShort,
  formatTime,
  isToday,
  mondayOf,
  monthGrid,
  todayIso,
} from "../lib/dates";
import { errorMessage } from "../lib/status";

type View = "week" | "month";

const HIDDEN_KEY = "agenda.hiddenCalendars";

/** Lecture tolérante du localStorage : vide en navigation privée ou si le stockage est bloqué. */
function loadHidden(): Set<string> {
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveHidden(hidden: Set<string>) {
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
  } catch {
    /* stockage indisponible : le choix ne survit pas au rechargement, rien de grave */
  }
}

const GOOGLE_MESSAGES: Record<string, string> = {
  connected: "Compte Google connecté. Tu peux synchroniser tes streaks.",
  refused: "Connexion refusée côté Google.",
  bad_state: "Retour Google invalide (session expirée ?). Réessaie.",
  error: "Google a refusé l'échange de jetons. Vérifie la configuration (docs/AGENDA.md).",
};

export function AgendaPage() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(todayIso());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(loadHidden);

  function toggleCalendar(id: string) {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveHidden(next);
    setHidden(next);
  }

  const status = useGoogleStatus();
  const sync = useSyncAgenda();
  const disconnect = useDisconnectGoogle();

  // Plage demandée à l'API : la semaine affichée, ou la grille complète du mois.
  const range =
    view === "week"
      ? { start: mondayOf(anchor), end: addDays(mondayOf(anchor), 7) }
      : (() => {
          const grid = monthGrid(anchor);
          return { start: grid[0][0], end: addDays(grid[grid.length - 1][6], 1) };
        })();
  const connected = status.data?.connected ?? false;
  const agenda = useAgenda(range.start, range.end, connected);

  const googleMessage = params.get("google");

  function move(direction: -1 | 0 | 1) {
    if (direction === 0) return setAnchor(todayIso());
    setAnchor(view === "week" ? addDays(anchor, 7 * direction) : addMonths(anchor, direction));
  }

  // Index jour → événements, un événement journée-entière multi-jours apparaissant chaque jour.
  const byDay = new Map<string, AgendaEvent[]>();
  for (const event of agenda.data?.events ?? []) {
    if (hidden.has(event.calendar_id)) continue;
    const first = dayOf(event.start);
    const last = event.all_day ? addDays(event.end, -1) : first;
    for (let day = first; day <= last; day = addDays(day, 1)) {
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(event);
    }
  }

  return (
    <div className="agenda">
      <header className="agenda-head">
        <h1>Agenda</h1>
        {connected && (
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={sync.isPending}
              onClick={() => sync.mutate(false)}
              title="Crée ou met à jour les créneaux des streaks dans Google Agenda"
            >
              {sync.isPending ? "Synchronisation…" : "Synchroniser"}
              {status.data && status.data.pending_sync > 0 && <span className="pill">{status.data.pending_sync}</span>}
            </button>
          </div>
        )}
      </header>

      {googleMessage && GOOGLE_MESSAGES[googleMessage] && (
        <p className={`notice ${googleMessage === "connected" ? "notice-good" : "notice-warning"}`}>
          {GOOGLE_MESSAGES[googleMessage]}
          <button type="button" className="link" onClick={() => setParams({})}>
            fermer
          </button>
        </p>
      )}

      <ConnectionPanel
        status={status}
        onDisconnect={() => {
          if (window.confirm("Déconnecter le compte Google ? Les événements déjà créés restent dans ton agenda.")) disconnect.mutate();
        }}
        sync={sync}
      />

      {connected && (
        <section className="panel">
          <div className="agenda-toolbar">
            <div className="btn-group" role="group" aria-label="Navigation">
              <button type="button" className="btn" onClick={() => move(-1)} aria-label="Précédent">
                ‹
              </button>
              <button type="button" className="btn" onClick={() => move(0)}>
                Aujourd'hui
              </button>
              <button type="button" className="btn" onClick={() => move(1)} aria-label="Suivant">
                ›
              </button>
            </div>
            <h2 className="agenda-title">
              {view === "week" ? `Semaine du ${formatShort(range.start)}` : formatMonth(anchor)}
            </h2>
            <div className="btn-group" role="group" aria-label="Vue">
              <button type="button" className={`btn ${view === "week" ? "btn-active" : ""}`} aria-pressed={view === "week"} onClick={() => setView("week")}>
                Semaine
              </button>
              <button type="button" className={`btn ${view === "month" ? "btn-active" : ""}`} aria-pressed={view === "month"} onClick={() => setView("month")}>
                Mois
              </button>
            </div>
          </div>

          {agenda.isPending && <p className="muted">Chargement de l'agenda…</p>}
          {agenda.isError && <p className="error">{errorMessage(agenda.error)}</p>}

          {agenda.data && view === "week" && (
            <div className="week">
              {Array.from({ length: 7 }, (_, i) => addDays(range.start, i)).map((day) => (
                <div key={day} className={`week-day ${isToday(day) ? "is-today" : ""}`}>
                  <h3>
                    <span className="week-day-name">{WEEKDAY_SHORT[i(day)]}</span>
                    <span className="week-day-num">{day.slice(8)}</span>
                  </h3>
                  <EventList events={byDay.get(day) ?? []} />
                </div>
              ))}
            </div>
          )}

          {agenda.data && view === "month" && (
            <>
              <div className="month">
                {WEEKDAY_SHORT.map((name) => (
                  <div key={name} className="month-head">
                    {name}
                  </div>
                ))}
                {monthGrid(anchor).flat().map((day) => {
                  const events = byDay.get(day) ?? [];
                  const outside = day.slice(0, 7) !== firstOfMonth(anchor).slice(0, 7);
                  return (
                    <button
                      type="button"
                      key={day}
                      className={`month-cell ${outside ? "outside" : ""} ${isToday(day) ? "is-today" : ""} ${selectedDay === day ? "selected" : ""}`}
                      onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                      aria-label={`${formatLong(day)}, ${events.length} événement${events.length > 1 ? "s" : ""}`}
                    >
                      <span className="month-num">{Number(day.slice(8))}</span>
                      <span className="month-chips">
                        {events.slice(0, 3).map((e) => (
                          <span key={e.id} className="chip" style={{ "--c": e.color } as CSSProperties} title={e.title}>
                            {e.streak_id ? "🔥 " : ""}
                            {e.title}
                          </span>
                        ))}
                        {events.length > 3 && <span className="chip-more">+{events.length - 3}</span>}
                      </span>
                      <span className="month-dots" aria-hidden="true">
                        {events.slice(0, 4).map((e) => (
                          <i key={e.id} style={{ background: e.color }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedDay && (
                <div className="month-selected">
                  <h3>{formatLong(selectedDay)}</h3>
                  <EventList events={byDay.get(selectedDay) ?? []} />
                </div>
              )}
            </>
          )}

          {agenda.data && (
            <div className="agenda-calendars" role="group" aria-label="Calendriers affichés">
              {agenda.data.calendars.map((c) => {
                const shown = !hidden.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`cal-toggle ${shown ? "" : "off"}`}
                    aria-pressed={shown}
                    onClick={() => toggleCalendar(c.id)}
                    title={shown ? "Masquer ce calendrier" : "Afficher ce calendrier"}
                  >
                    <i className="dot" style={{ background: c.color }} />
                    {c.name}
                    {c.is_streak_calendar && " (streaks)"}
                  </button>
                );
              })}
              {hidden.size > 0 && (
                <button type="button" className="link" onClick={() => { saveHidden(new Set()); setHidden(new Set()); }}>
                  tout afficher
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** Index 0–6 (lundi = 0) d'un jour ISO, pour retrouver son nom. */
function i(day: string): number {
  return (new Date(day + "T12:00:00").getDay() + 6) % 7;
}

function EventList({ events }: { events: AgendaEvent[] }) {
  if (events.length === 0) return <p className="muted small">—</p>;
  return (
    <ul className="events">
      {events.map((e) => (
        <li key={e.id} className={`event ${e.streak_id ? "event-streak" : ""}`} style={{ "--c": e.color } as CSSProperties}>
          <span className="event-time">{e.all_day ? "journée" : formatTime(e.start)}</span>
          {e.streak_id ? (
            <Link to={`/streaks/${e.streak_id}`} className="event-title" title="Ouvrir le streak">
              🔥 {e.title}
            </Link>
          ) : (
            <a className="event-title" href={e.link || undefined} target="_blank" rel="noreferrer" title={e.calendar_name}>
              {e.title}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function ConnectionPanel({
  status,
  onDisconnect,
  sync,
}: {
  status: ReturnType<typeof useGoogleStatus>;
  onDisconnect: () => void;
  sync: ReturnType<typeof useSyncAgenda>;
}) {
  if (status.isPending) return <p className="muted">Chargement…</p>;
  if (status.isError) return <p className="error">{errorMessage(status.error)}</p>;
  const s = status.data;

  if (!s.configured) {
    return (
      <section className="panel">
        <h2>Google Agenda non configuré</h2>
        <p className="muted">
          Renseigne <code>GOOGLE_CLIENT_ID</code> et <code>GOOGLE_CLIENT_SECRET</code> dans le fichier <code>.env</code> puis
          redémarre le backend. La marche à suivre est dans <code>docs/AGENDA.md</code>.
        </p>
      </section>
    );
  }

  if (!s.connected) {
    return (
      <section className="panel connect">
        <h2>Connecter mon Google Agenda</h2>
        <p className="muted">
          L'app créera un calendrier « {s.calendar_name} » dans ton compte et y placera les créneaux de tes streaks. Elle
          lira tes autres calendriers pour les afficher ici, sans les modifier.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => startGoogleConnect()}>
          Se connecter avec Google
        </button>
      </section>
    );
  }

  const summary = sync.data ?? s.last_sync_summary;
  return (
    <section className="panel connection">
      <div>
        <strong>{s.email}</strong>
        <span className="muted"> · calendrier « {s.calendar_name} »</span>
        <p className="muted small">
          {s.last_sync_at ? `Dernière synchro : ${formatLong(dayOf(s.last_sync_at))} à ${formatTime(s.last_sync_at)}` : "Jamais synchronisé"}
          {summary && summary.created !== undefined && ` — ${summary.created} créé(s), ${summary.updated} mis à jour, ${summary.deleted} supprimé(s)`}
          {s.pending_sync > 0 && ` — ${s.pending_sync} streak(s) à synchroniser`}
        </p>
        {sync.isError && <p className="error">{errorMessage(sync.error)}</p>}
        {summary?.errors?.map((err) => (
          <p key={err} className="error">
            {err}
          </p>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={() => sync.mutate(true)} disabled={sync.isPending} title="Réécrit tous les événements">
          Tout resynchroniser
        </button>
        <button type="button" className="btn btn-danger" onClick={onDisconnect}>
          Déconnecter
        </button>
      </div>
    </section>
  );
}
