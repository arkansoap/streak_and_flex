#!/usr/bin/env bash
# Démarre tout l'environnement de dev en une commande : Postgres (Docker), Django (8010),
# Vite (5180). Ctrl+C arrête les deux serveurs ; la base reste en route.
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -f .env ]] || { cp .env.example .env; echo ".env créé depuis .env.example"; }

docker compose up -d db
until docker compose exec -T db pg_isready -U streak -d streak >/dev/null 2>&1; do sleep 1; done

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh" && nvm use 22 >/dev/null
unset VIRTUAL_ENV

(cd backend && uv sync -q && uv run python manage.py migrate --noinput)
[[ -d frontend/node_modules ]] || (cd frontend && npm install)

trap 'kill 0' EXIT INT TERM
(cd backend && uv run python manage.py runserver 8010) &
(cd frontend && npm run dev) &
echo
echo "  Front : http://localhost:5180   API : http://localhost:8010/api/docs   Admin : http://localhost:8010/admin/"
echo
wait
