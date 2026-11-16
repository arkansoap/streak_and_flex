#!/usr/bin/env bash
# Déploiement / mise à jour de Streak & Flex sur le serveur.
#
# À lancer depuis la racine du repo cloné sur le serveur :
#   scripts/deploy.sh            # git pull + build + migrate + redémarrage
#   scripts/deploy.sh --no-pull  # idem sans git pull (déploiement d'un état local)
#
# Premier déploiement : le script crée .env depuis .env.example et le fichier
# htpasswd s'ils manquent, puis s'arrête pour que tu les complètes. Voir docs/DEPLOY.md.

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
PULL=1
[[ "${1:-}" == "--no-pull" ]] && PULL=0

log() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "docker introuvable"
docker compose version >/dev/null 2>&1 || die "docker compose (v2) introuvable"

if [[ ! -f .env ]]; then
  cp .env.example .env
  secret=$(python3 -c 'import secrets;print(secrets.token_urlsafe(50))' 2>/dev/null || openssl rand -base64 48 | tr -d '\n=/+')
  pgpass=$(openssl rand -hex 16)
  sed -i "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=${secret}|; s|^DJANGO_DEBUG=.*|DJANGO_DEBUG=0|; s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pgpass}|; s|^DATABASE_URL=.*|# DATABASE_URL est fixé par docker-compose.prod.yml|" .env
  die ".env créé avec des secrets générés. Renseigne DJANGO_ALLOWED_HOSTS et DJANGO_CSRF_TRUSTED_ORIGINS, puis relance."
fi

if [[ ! -f docker/htpasswd ]]; then
  read -rp "Identifiant pour l'accès web : " user
  read -rsp "Mot de passe : " pass; echo
  mkdir -p docker
  printf '%s:%s\n' "$user" "$(openssl passwd -apr1 "$pass")" > docker/htpasswd
  chmod 600 docker/htpasswd
  log "docker/htpasswd créé pour '$user'"
fi

if [[ $PULL -eq 1 ]]; then
  log "git pull"
  git pull --ff-only
fi

log "Build des images"
$COMPOSE build --pull

log "Démarrage"
$COMPOSE up -d --remove-orphans

log "Migrations"
$COMPOSE exec -T backend python manage.py migrate --noinput

log "Vérification"
port=$(grep -E '^WEB_PORT=' .env | cut -d= -f2); port=${port:-8020}
for i in $(seq 1 15); do
  if curl -fsS "http://localhost:${port}/api/health" >/dev/null 2>&1; then
    printf '\033[1;32m✔ En ligne sur http://localhost:%s\033[0m\n' "$port"
    $COMPOSE ps
    exit 0
  fi
  sleep 2
done
$COMPOSE logs --tail=50 backend web
die "L'API ne répond pas sur /api/health"
