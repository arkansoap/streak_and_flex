# Modèle de données et règles du streak

## Tables

### `streaks_streak`

| Champ | Type | Rôle |
|---|---|---|
| `name` | varchar(100) | Nom affiché |
| `description` | text | Pourquoi ce streak |
| `emoji`, `color` | varchar | Identité visuelle (couleur hex `#rrggbb`) |
| `period` | `day` \| `week` | Granularité de validation |
| `required_count` | smallint (1–7) | Check-ins nécessaires par période (utile en hebdo : « 2 fois par semaine ») |
| `full_label`, `simplified_label`, `minimum_label` | varchar(120) | Libellés des niveaux 3, 2, 1 |
| `start_date` | date | Premier jour compté |
| `schedule_weekdays` | json (liste d'entiers) | Jours planifiés, 0 = lundi … 6 = dimanche (hebdo) |
| `schedule_time` | time nullable | Heure du créneau ; vide = journée entière |
| `schedule_duration` | smallint | Durée du créneau en minutes |
| `reminder_minutes` | smallint | Rappel Google, minutes avant |
| `google_event_id` | varchar | Événement récurrent Google lié (vide = jamais synchronisé) |
| `google_synced_at` | timestamp nullable | Dernière synchro réussie ; `updated_at` plus récent ⇒ `needs_sync` |
| `archived_at` | timestamp nullable | Archivé = caché de la liste, historique conservé |
| `created_at`, `updated_at` | timestamp | |

### `streaks_checkin`

| Champ | Type | Rôle |
|---|---|---|
| `streak_id` | FK | |
| `date` | date | Le jour validé — **unique par streak** |
| `level` | smallint | 3 = réel, 2 = simplifié, 1 = minimum |
| `note` | text | Libre |
| `created_at`, `updated_at` | timestamp | |

Un seul check-in par jour : recocher un jour remplace le niveau. Les niveaux sont des
entiers ordonnés pour pouvoir prendre le « meilleur niveau » d'une période (`max`).

### `agenda_googleaccount`

Un seul enregistrement : e-mail, `refresh_token`, `access_token` + expiration, `calendar_id`
du calendrier dédié, `last_sync_at`, `last_sync_summary` (json). Voir docs/AGENDA.md.

## Périodes

- **Jour** : la période est le jour.
- **Semaine** : lundi → dimanche (semaine ISO), identique en Python (`weekday()`) et en TS (`mondayOf`).
- « Aujourd'hui » = date locale Europe/Paris (`timezone.localdate()`), jamais UTC.

Les périodes sont énumérées depuis `min(start_date, premier check-in)` jusqu'à la période
courante : un rattrapage antérieur à `start_date` n'est pas perdu.

## Règles (backend/streaks/services.py)

| Règle | Détail |
|---|---|
| Période validée | `nombre de check-ins ≥ required_count`, quel que soit le niveau |
| Streak en cours | nombre de périodes validées consécutives en remontant depuis maintenant. **La période en cours ne casse pas le streak** si elle n'est pas encore validée : on la saute et on compte depuis la précédente. Si la précédente n'est pas validée non plus → 0 |
| Record | plus longue suite de périodes validées consécutives, période courante incluse si validée |
| Taux de réussite | périodes validées / périodes **terminées** (la courante est exclue). `null` tant qu'aucune période n'est terminée |
| `at_risk` | période courante non validée **et** c'est son dernier jour (toujours vrai pour un streak quotidien non coché) |
| `today_level` | niveau coché aujourd'hui, pour les boutons de la carte |
| Check-in futur | refusé (400) |
| Check-in sur streak archivé | refusé (400) |

Exemples (streak quotidien, aujourd'hui = J) :

| Check-ins | Streak | Pourquoi |
|---|---|---|
| J-3, J-2, J-1 | 3 | J pas encore coché, pas cassé |
| J-3, J-2, J-1, J | 4 | |
| J-4, J-3, J-1 | 1 | trou en J-2 |
| J-2 | 0 | J-1 manqué, J pas coché |

Toutes ces règles sont couvertes par `backend/streaks/tests/test_services.py`.
