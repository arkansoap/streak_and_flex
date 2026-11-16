# Agenda Google

L'app pousse les créneaux des streaks dans un calendrier dédié de ton compte Google
(`flex_and_streak`, créé automatiquement) et affiche l'ensemble de tes calendriers sur la
page Agenda, en vue semaine ou mois. **La validation se fait uniquement dans l'app** :
Google ne sert qu'aux créneaux et aux rappels.

## Fonctionnement

| Streak | Événement Google |
|---|---|
| Quotidien avec une heure | récurrent tous les jours, à l'heure et pour la durée choisies |
| Quotidien sans heure | aucun événement |
| Hebdo avec des jours et une heure | récurrent chaque semaine ces jours-là, à l'heure choisie |
| Hebdo avec des jours sans heure | récurrent chaque semaine, journée entière |
| Archivé, ou planning retiré | événement supprimé au prochain « Synchroniser » |

Chaque événement porte un rappel (popup, `reminder_minutes` avant), la description avec
les trois niveaux et un lien vers la page du streak dans l'app, et une propriété privée
`streak_id` qui permet de le reconnaître dans l'agenda (affiché avec 🔥, cliquable vers le streak).

La synchronisation est **manuelle** (bouton sur la page Agenda) et **à sens unique** :
l'app écrit dans son calendrier, elle ne lit les autres que pour les afficher. Modifier
un événement à la main dans Google sera écrasé à la synchro suivante si le streak a changé ;
le supprimer à la main le fait recréer. Un compteur sur le bouton indique les streaks en
attente (`needs_sync` : jamais synchronisé, ou modifié depuis).

## Configuration côté Google (une fois)

1. Ouvrir https://console.cloud.google.com avec ton compte Google **perso** et créer un
   projet (par exemple « streak-and-flex »).
2. **API et services › Bibliothèque** : activer **Google Calendar API**.
3. **API et services › Écran de consentement OAuth** : type *Externe*, nom de l'app, ton
   adresse en contact. Ajouter le champ d'application
   `https://www.googleapis.com/auth/calendar`. Enregistrer.
4. Toujours sur l'écran de consentement : **passer l'app en production** (« Publier l'application »).
   Sans vérification Google tu verras un avertissement « application non validée » à la
   première connexion, c'est attendu ; en restant en mode *Test*, les jetons expirent tous
   les sept jours et il faudrait se reconnecter chaque semaine.
5. **API et services › Identifiants › Créer des identifiants › ID client OAuth**, type
   *Application Web*. URI de redirection autorisés :
   - `http://localhost:5180/api/google/callback` (dev)
   - `https://streak.mondomaine.fr/api/google/callback` (prod)
6. Copier l'ID client et le secret dans `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`),
   vérifier `APP_URL`, redémarrer le backend.

Puis dans l'app : page Agenda › « Se connecter avec Google » › accepter › « Synchroniser ».

## Côté code

- `backend/agenda/google.py` : client REST minimal (OAuth, rafraîchissement du jeton,
  calendriers, événements). Pas de SDK Google : dix appels suffisent et ils se testent
  avec `httpx.MockTransport`.
- `backend/agenda/services.py` : `event_body()` (planning → événement récurrent, règle
  RRULE), `sync_streaks()` (création / mise à jour / suppression, erreurs isolées par
  streak), `fetch_agenda()` (lecture de tous les calendriers visibles).
- `backend/agenda/models.py` : `GoogleAccount`, un seul enregistrement (app mono-utilisateur) :
  jetons, identifiant du calendrier dédié, résumé de la dernière synchro.
- Champs de planning sur `Streak` : `schedule_weekdays`, `schedule_time`,
  `schedule_duration`, `reminder_minutes`, `google_event_id`, `google_synced_at`.
- Front : `pages/AgendaPage.tsx`, `hooks/useAgenda.ts`, `api/agenda.ts`.

## Sécurité

Les jetons Google sont en base, en clair : la base n'est accessible que depuis le réseau
Docker, et l'app est derrière le mot de passe nginx en prod. Le `state` OAuth en session
empêche un retour forgé. « Déconnecter » oublie les jetons mais ne révoque pas l'accès
côté Google : pour cela, https://myaccount.google.com/permissions.
