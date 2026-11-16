# Développement

## Prérequis

| Outil | Pourquoi | Vérifier |
|---|---|---|
| Docker + Compose v2 | Postgres en local, toute la stack en prod | `docker compose version` |
| `uv` | Python 3.12 et dépendances du backend, sans rien installer à la main | `uv --version` |
| Node 22 (via nvm) | Vite + TypeScript | `nvm use 22 && node -v` |

## Lancer

```bash
cp .env.example .env   # une fois
scripts/dev.sh         # tout démarre ; Ctrl+C arrête Django et Vite, la base reste up
```

| Service | URL |
|---|---|
| Interface | http://localhost:5180 |
| API (doc interactive) | http://localhost:8010/api/docs |
| Admin Django | http://localhost:8010/admin/ (`uv run python manage.py createsuperuser` d'abord) |
| Postgres | `localhost:5444`, base/utilisateur/mot de passe `streak` |

À la main, l'équivalent :

```bash
docker compose up -d db
cd backend && uv run python manage.py migrate && uv run python manage.py runserver 8010
cd frontend && nvm use 22 && npm install && npm run dev
```

Les ports (5444, 8010, 5180) sont décalés pour cohabiter avec les autres projets de la
machine. `.env` les pilote ; `vite.config.ts` relaie `/api` vers 8010.

## Commandes utiles

```bash
# Backend (dans backend/)
uv run pytest                      # tests (utilise la base Docker, crée test_streak)
uv run ruff check . && uv run ruff format .
uv run python manage.py makemigrations streaks
uv run python manage.py shell

# Frontend (dans frontend/, après nvm use 22)
npm run dev
npm run build                      # tsc -b puis vite build → dist/
npm run lint                       # oxlint
npx tsc -b                         # type-check seul
```

## Structure

```
streak_and_flex/
├── backend/
│   ├── config/            # settings, urls, api.py (NinjaAPI racine)
│   ├── agenda/            # Google Agenda : google.py (client REST), services.py (sync), api.py
│   ├── streaks/           # l'app métier
│   │   ├── models.py      # Streak, CheckIn, enums Period / Level
│   │   ├── services.py    # règles du streak (fonctions pures) — le cœur
│   │   ├── schemas.py     # XxxIn / XxxOut (pydantic)
│   │   ├── api.py         # routes /api/streaks (plomberie uniquement)
│   │   ├── admin.py
│   │   └── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/           # types.ts (miroir des schémas), client.ts (fetch), streaks.ts, agenda.ts
│   │   ├── hooks/         # useStreaks.ts, useAgenda.ts : React Query (cache serveur)
│   │   ├── lib/           # dates, niveaux, statut : fonctions pures
│   │   ├── components/    # StreakCard, LevelPicker, Heatmap, StatTile, Layout
│   │   ├── pages/         # StreaksPage, StreakDetailPage, StreakFormPage, AgendaPage
│   │   ├── App.tsx        # routes
│   │   ├── main.tsx       # providers
│   │   └── styles.css     # tokens CSS, mode sombre automatique
│   ├── nginx.conf         # prod
│   └── Dockerfile
├── scripts/               # dev.sh, deploy.sh, db-backup.sh
├── docker-compose.yml     # dev : Postgres seul
├── docker-compose.prod.yml
└── docs/
```

## Conventions

- **Règles métier dans `services.py`**, jamais dans les routes ni dans le front. Le front
  affiche ce que l'API calcule (`stats`), il ne recalcule pas un streak.
- **Docstrings** en tête de chaque module et sur les fonctions non triviales (le *pourquoi*).
  Côté TS, un commentaire d'en-tête par fichier.
- API : schémas `XxxIn` / `XxxOut`, erreurs `{"detail": "..."}` en 400/404, pas de 422.
  Toute nouvelle route se documente dans `docs/API.md`.
- Types TS = miroir des schémas Ninja. Quand un schéma change, `src/api/types.ts` change.
- Dates : toujours `YYYY-MM-DD` en heure locale (`lib/dates.ts`), jamais `toISOString()`.
- Couleurs : la couleur d'un streak est son identité ; les trois niveaux sont la même teinte
  du clair au foncé (`color-mix` sur `--c`). Un état n'est jamais porté par la couleur seule
  (toujours un texte à côté).
- Tests : chaque règle de `services.py` a un test dans `streaks/tests/test_services.py`.

## Responsive : ordinateur, tablette, téléphone

L'interface est pensée pour les trois supports, dans `frontend/src/styles.css` uniquement
(les composants ne changent pas selon l'écran, hors le défilement de la heatmap).

| Plage | Ce qui change |
|---|---|
| Téléphone (< 640 px) | navigation en barre d'onglets fixée en bas (icône + libellé, zone sûre iOS via `env(safe-area-inset-bottom)`) ; sur le détail, le panneau « cocher aujourd'hui » passe avant les stats (`order: -1`) ; actions du détail sur toute la largeur ; titres réduits |
| Tablette (640–1023 px) | barre en haut, cartes et stats sur 2 colonnes |
| Ordinateur (≥ 1024 px) | 3 colonnes de cartes, 4 tuiles de stats, heatmap à 16 px |
| Tactile (`pointer: coarse`) | cibles d'au moins 44 px, champs à 16 px (sinon iOS zoome au focus), cases de heatmap à 20 px, survols désactivés (`@media (hover: hover)`) |

Règles à garder :

- Pas d'information portée uniquement par un survol (`title`) : sur tactile il n'existe pas. La
  heatmap, par exemple, affiche la date et le niveau dans le panneau après un tap.
- Les grilles sont fluides (`auto-fill` / `flex-wrap`) ; les points de rupture n'ajustent que
  la navigation, l'ordre et les densités.
- La heatmap défile horizontalement et se positionne sur les semaines récentes au montage
  (`useRef` + `useEffect` dans `Heatmap.tsx`).
- `public/manifest.webmanifest` + icônes : l'app s'ajoute à l'écran d'accueil (Android, iOS)
  et s'ouvre en plein écran. Pas de service worker (pas de mode hors ligne) pour l'instant.

Pour vérifier : outils de développement du navigateur en mode appareil (iPhone, iPad), ou le
script Playwright de capture décrit dans la session de création (390 / 820 / 1280 px).

## Mémo Vue → React (pour ce projet)

| Vue | Ici | Où le voir |
|---|---|---|
| `ref` / `reactive` | `useState` | `StreakFormPage.tsx` |
| `v-model` | `value` + `onChange` à la main | `StreakFormPage.tsx` (`set(key, value)`) |
| `computed` | une simple variable calculée dans le composant (re-rendue à chaque changement) | `StreakDetailPage.tsx` (`levels`, `rate`) |
| `onMounted` + fetch + `loading` | `useQuery` | `hooks/useStreaks.ts` |
| `emit` | une prop fonction (`onChange`) | `LevelPicker.tsx` |
| `<slot>` | `children` ou `<Outlet />` pour le routeur | `Layout.tsx` |
| `<router-view>` / `<router-link>` | `<Outlet />` / `<Link>` `<NavLink>` | `Layout.tsx`, `App.tsx` |
| `watch` pour recopier des props dans l'état | éviter ; passer les données initiales à un sous-composant avec `key` | `StreakFormPage.tsx` |

Côté TypeScript, les notions utilisées ici : `type` vs `interface`, unions littérales
(`type Level = 1 \| 2 \| 3`), génériques (`api<T>()`), `Omit` / `Partial`, `as const`
+ `satisfies` (`lib/levels.ts`), `keyof` (`set<K extends keyof StreakInput>`).
