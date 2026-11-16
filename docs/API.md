# API

Base : `/api`. Doc interactive générée : `/api/docs` (OpenAPI : `/api/openapi.json`).
Pas d'authentification applicative en v1 ; en prod, nginx protège tout par mot de passe.

Erreurs : `400 {"detail": "message"}` (règle métier ou validation), `404 {"detail": "Not Found"}`.

## Routes

| Méthode | Route | Corps | Réponse | Rôle |
|---|---|---|---|---|
| GET | `/health` | | `{"status":"ok"}` | Supervision (ouverte sans mot de passe) |
| GET | `/streaks?archived=false` | | `StreakOut[]` | Liste avec stats |
| POST | `/streaks` | `StreakIn` | `201 StreakOut` | Création (`start_date` = aujourd'hui si absent) |
| GET | `/streaks/{id}` | | `StreakOut` | Détail |
| PATCH | `/streaks/{id}` | `StreakPatch` | `StreakOut` | Modification partielle ; `archived: true/false` archive ou restaure |
| DELETE | `/streaks/{id}` | | `204` | Suppression définitive (check-ins compris) |
| GET | `/streaks/{id}/history?periods=12` | | `PeriodOut[]` | Les N dernières périodes, la courante en dernier |
| GET | `/streaks/{id}/checkins?date_from&date_to` | | `CheckInOut[]` | Check-ins, plus récents d'abord |
| PUT | `/streaks/{id}/checkins/{YYYY-MM-DD}` | `{"level": 1\|2\|3, "note": ""}` | `CheckInOut` | Coche ou remplace le niveau du jour |
| DELETE | `/streaks/{id}/checkins/{YYYY-MM-DD}` | | `204` / `404` | Décoche |

## Google et agenda

| Méthode | Route | Corps | Réponse | Rôle |
|---|---|---|---|---|
| GET | `/google/status` | | `GoogleStatusOut` | `configured` (clés présentes), `connected`, e-mail, dernière synchro, `pending_sync` |
| GET | `/google/connect` | | `{"url"}` | URL d'autorisation Google (pose un `state` en session) ; 400 si non configuré |
| GET | `/google/callback?code&state` | | redirection | Retour de Google → `APP_URL/agenda?google=connected\|refused\|bad_state\|error` |
| POST | `/google/disconnect` | | `204` | Oublie le compte et les identifiants d'événements |
| POST | `/agenda/sync?force=false` | | `SyncOut` | Pousse les plannings : `created`, `updated`, `deleted`, `unchanged`, `errors[]`. `force` réécrit tout |
| GET | `/agenda/events?start&end` | | `AgendaOut` | Événements de tous les calendriers visibles entre `start` (inclus) et `end` (exclu, 62 jours max) |

`StreakIn` / `StreakOut` portent aussi le planning : `schedule_weekdays` (0 = lundi … 6 = dimanche),
`schedule_time` (`"HH:MM:SS"` ou null), `schedule_duration`, `reminder_minutes`, et en sortie
`has_schedule`, `needs_sync`, `google_event_id`, `google_synced_at`. Voir docs/AGENDA.md.

## Schémas

`StreakIn`

```json
{
  "name": "Sport", "description": "", "emoji": "🏃", "color": "#2563eb",
  "period": "day", "required_count": 1,
  "full_label": "Séance prévue", "simplified_label": "30 min de sport",
  "minimum_label": "15 min à la maison", "start_date": "2026-11-16"
}
```

`StreakOut` = `StreakIn` + `id`, `archived`, `created_at`, `stats` :

```json
"stats": {
  "current_streak": 4, "best_streak": 6, "total_checkins": 13,
  "periods_done": 14, "periods_validated": 12, "completion_rate": 0.857,
  "level_counts": {"1": 4, "2": 5, "3": 4},
  "current_period": {"start": "2026-11-16", "end": "2026-11-16", "count": 1,
                     "required": 1, "validated": true, "level": 2, "is_current": true},
  "last_checkin": "2026-11-16", "today_level": 2,
  "days_left_in_period": 0, "at_risk": false
}
```

## Exemples

```bash
curl -X POST localhost:8010/api/streaks -H 'content-type: application/json' \
  -d '{"name":"Sport","period":"day","full_label":"Séance prévue","simplified_label":"30 min","minimum_label":"15 min"}'

curl -X PUT localhost:8010/api/streaks/1/checkins/2026-11-16 -H 'content-type: application/json' -d '{"level":2}'

curl localhost:8010/api/streaks/1/history?periods=4
```
