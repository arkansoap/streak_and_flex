/**
 * Création et modification d'un streak (même formulaire).
 *
 * Formulaire « contrôlé » : chaque champ lit sa valeur dans `form` et écrit via
 * `set(...)`. En Vue ce serait un `v-model` sur un `reactive` ; ici on le fait à la
 * main, c'est le prix de React, mais tout reste explicite.
 *
 * Deux composants : `StreakFormPage` charge le streak en édition, puis rend
 * `StreakForm` avec les valeurs initiales. Ainsi `useState(initial)` suffit, sans
 * `useEffect` pour recopier les données après chargement (anti-pattern React).
 */

import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { Period, StreakInput } from "../api/types";
import { useCreateStreak, useStreak, useUpdateStreak } from "../hooks/useStreaks";
import { WEEKDAY_LETTER, WEEKDAY_SHORT, describeSchedule, todayIso } from "../lib/dates";
import { errorMessage } from "../lib/status";

const EMPTY: StreakInput = {
  name: "",
  description: "",
  emoji: "",
  color: "#2563eb",
  period: "day",
  required_count: 1,
  full_label: "",
  simplified_label: "",
  minimum_label: "",
  start_date: todayIso(),
  schedule_weekdays: [],
  schedule_time: null,
  schedule_duration: 30,
  reminder_minutes: 10,
};

export function StreakFormPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const existing = useStreak(id);

  if (!id) return <StreakForm id={null} initial={EMPTY} />;
  if (existing.isPending) return <p className="muted">Chargement…</p>;
  if (existing.isError) return <p className="error">{errorMessage(existing.error)}</p>;

  const { id: _id, archived: _archived, created_at: _created, stats: _stats, ...initial } = existing.data;
  return <StreakForm key={id} id={id} initial={initial} />;
}

function StreakForm({ id, initial }: { id: number | null; initial: StreakInput }) {
  const navigate = useNavigate();
  const create = useCreateStreak();
  const update = useUpdateStreak(id ?? 0);
  const [form, setForm] = useState<StreakInput>(initial);
  const mutation = id ? update : create;

  function set<K extends keyof StreakInput>(key: K, value: StreakInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(day: number) {
    const days = form.schedule_weekdays.includes(day)
      ? form.schedule_weekdays.filter((d) => d !== day)
      : [...form.schedule_weekdays, day].sort();
    set("schedule_weekdays", days);
  }

  const schedule = describeSchedule(form.period, form.schedule_weekdays, form.schedule_time);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const saved = id ? await update.mutateAsync(form) : await create.mutateAsync(form);
    navigate(`/streaks/${saved.id}`);
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <h1>{id ? "Modifier le streak" : "Nouveau streak"}</h1>

      <div className="row">
        <label className="field grow">
          Nom
          <input className="input" required maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Sport, Projet X, Lecture…" />
        </label>
        <label className="field">
          Emoji
          <input className="input" maxLength={8} value={form.emoji} onChange={(e) => set("emoji", e.target.value)} placeholder="🏃" />
        </label>
        <label className="field">
          Couleur
          <input type="color" className="input" value={form.color} onChange={(e) => set("color", e.target.value)} />
        </label>
      </div>

      <label className="field">
        Pourquoi ce streak (facultatif)
        <textarea className="input" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </label>

      <fieldset>
        <legend>Rythme</legend>
        <div className="row">
          <label className="field">
            Période
            <select className="input" value={form.period} onChange={(e) => set("period", e.target.value as Period)}>
              <option value="day">Chaque jour</option>
              <option value="week">Chaque semaine</option>
            </select>
          </label>
          {form.period === "week" && (
            <label className="field">
              Fois par semaine
              <input type="number" className="input" min={1} max={7} value={form.required_count} onChange={(e) => set("required_count", Number(e.target.value))} />
            </label>
          )}
          <label className="field">
            Date de début
            <input type="date" className="input" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} />
          </label>
        </div>
        <p className="muted small">
          {form.period === "day"
            ? "La journée est validée dès qu'un des trois niveaux est coché."
            : `La semaine (lundi → dimanche) est validée avec ${form.required_count} jour${form.required_count > 1 ? "s" : ""} coché${form.required_count > 1 ? "s" : ""}, quel que soit le niveau.`}
        </p>
      </fieldset>

      <fieldset>
        <legend>Les trois niveaux</legend>
        <p className="muted small">Du plus exigeant au plus accessible. Les trois gardent le streak en vie ; le niveau sert à rester honnête avec soi-même.</p>
        <label className="field">
          3 · Objectif réel
          <input className="input" required maxLength={120} value={form.full_label} onChange={(e) => set("full_label", e.target.value)} placeholder="La séance prévue au plan" />
        </label>
        <label className="field">
          2 · Objectif simplifié
          <input className="input" required maxLength={120} value={form.simplified_label} onChange={(e) => set("simplified_label", e.target.value)} placeholder="30 min de sport" />
        </label>
        <label className="field">
          1 · Objectif minimum
          <input className="input" required maxLength={120} value={form.minimum_label} onChange={(e) => set("minimum_label", e.target.value)} placeholder="15 min à la maison (renfo ou étirements)" />
        </label>
      </fieldset>

      <fieldset>
        <legend>Planning dans l'agenda</legend>
        <p className="muted small">
          Facultatif. Le créneau est poussé dans ton Google Agenda (calendrier dédié) au prochain « Synchroniser » sur la
          page Agenda, avec un rappel. La validation se fait toujours ici, dans l'app.
        </p>
        {form.period === "week" && (
          <div className="field">
            Jours
            <div className="weekdays" role="group" aria-label="Jours planifiés">
              {WEEKDAY_LETTER.map((letter, day) => (
                <button
                  key={day}
                  type="button"
                  className={`weekday ${form.schedule_weekdays.includes(day) ? "selected" : ""}`}
                  aria-pressed={form.schedule_weekdays.includes(day)}
                  aria-label={WEEKDAY_SHORT[day]}
                  onClick={() => toggleDay(day)}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="row">
          <label className="field">
            {form.period === "day" ? "Heure (tous les jours)" : "Heure (vide = journée entière)"}
            <input
              type="time"
              className="input"
              value={form.schedule_time ? form.schedule_time.slice(0, 5) : ""}
              onChange={(e) => set("schedule_time", e.target.value ? `${e.target.value}:00` : null)}
            />
          </label>
          <label className="field">
            Durée (min)
            <input type="number" className="input" min={5} max={720} step={5} value={form.schedule_duration} onChange={(e) => set("schedule_duration", Number(e.target.value))} disabled={!form.schedule_time} />
          </label>
          <label className="field">
            Rappel (min avant)
            <input type="number" className="input" min={0} max={1440} step={5} value={form.reminder_minutes} onChange={(e) => set("reminder_minutes", Number(e.target.value))} />
          </label>
        </div>
        <p className="muted small">{schedule ? `Dans l'agenda : ${schedule}.` : "Aucun créneau ne sera créé."}</p>
      </fieldset>

      {mutation.isError && <p className="error">{errorMessage(mutation.error)}</p>}

      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {id ? "Enregistrer" : "Créer"}
        </button>
        <button type="button" className="btn" onClick={() => navigate(-1)}>
          Annuler
        </button>
      </div>
    </form>
  );
}
