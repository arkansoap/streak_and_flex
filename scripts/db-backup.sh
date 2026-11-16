#!/usr/bin/env bash
# Sauvegarde la base de prod dans dumps/streak_<date>.sql.gz (à lancer sur le serveur).
# Restauration : gunzip -c dumps/streak_X.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U streak streak
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dumps
file="dumps/streak_$(date +%Y%m%d_%H%M).sql.gz"
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U streak --clean --if-exists streak | gzip > "$file"
echo "→ $file ($(du -h "$file" | cut -f1))"
