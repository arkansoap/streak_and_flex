# Streak & Flex — repères pour Claude

Outil perso (Thibault) de motivation : suivi de streaks à trois niveaux (réel / simplifié /
minimum), puis page Flex. Monorepo : `backend/` Django 5.2 + django-ninja (uv, Python 3.12),
`frontend/` React 19 + TypeScript (Vite, React Router, TanStack Query), Postgres 16 en Docker.

## Commandes

```bash
scripts/dev.sh                                   # db + Django 8010 + Vite 5180
cd backend && uv run pytest && uv run ruff check . && uv run ruff format .
cd frontend && nvm use 22 && npm run build && npm run lint
docker compose -f docker-compose.prod.yml -p streak_prod up -d --build   # stack prod en local
```

Toujours `nvm use 22` avant npm (le Node par défaut de la machine est obsolète). `unset VIRTUAL_ENV`
si uv se plaint d'un venv étranger.

## Règles

- Règles métier uniquement dans `backend/streaks/services.py`, testées dans `streaks/tests/`.
  Le front n'interprète pas les check-ins pour recalculer un streak : il affiche `stats`.
- API : schémas `XxxIn`/`XxxOut`, erreurs `{"detail"}` en 400/404, `Status(...)` pour les codes
  non 200. Nouvelle route ⇒ ligne dans `docs/API.md` + type dans `frontend/src/api/types.ts`.
- Docstring de module + docstrings sur les fonctions (le pourquoi). Pas de commentaire inline
  superflu côté Python. Côté TS : commentaire d'en-tête par fichier, commentaires pédagogiques
  bienvenus (Thibault apprend TypeScript, vient de Vue).
- Dates ISO locales (`lib/dates.ts`, `timezone.localdate()`), semaine = lundi → dimanche.
- Couleur = identité du streak ; niveaux = même teinte clair → foncé ; jamais une couleur seule
  sans texte. Mode sombre automatique via tokens CSS.
- Langue de l'interface, des docs et des messages d'erreur : français.
- `erasableSyntaxOnly` dans tsconfig : pas d'`enum` TS, utiliser `as const`.

## Docs

`docs/DEV.md` (installation, structure, mémo Vue → React), `docs/DATA_MODEL.md` (règles du
streak), `docs/API.md`, `docs/DEPLOY.md` (scripts/deploy.sh, Caddy, sauvegardes).
