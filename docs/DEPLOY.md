# Déploiement

Cible : une VM Linux avec Docker (Compose v2), `git`, `openssl`, `curl`. Tout tourne en
conteneurs : Postgres, gunicorn (Django), nginx (bundle React + proxy `/api`). Un seul port
est exposé sur la machine (`WEB_PORT`, défaut 8020) ; le TLS est à faire par un reverse
proxy devant (Caddy conseillé, deux lignes).

## Premier déploiement

```bash
git clone git@github.com:arkansoap/streak_and_flex.git
cd streak_and_flex
scripts/deploy.sh
```

Le script s'arrête une première fois après avoir créé `.env` avec des secrets générés.
Compléter :

```ini
DJANGO_ALLOWED_HOSTS=streak.mondomaine.fr
DJANGO_CSRF_TRUSTED_ORIGINS=https://streak.mondomaine.fr
WEB_PORT=8020
```

Relancer `scripts/deploy.sh` : il demande un identifiant et un mot de passe pour l'accès web
(`docker/htpasswd`, hors git), construit les images, démarre, migre, vérifie `/api/health`.

Compte admin Django (optionnel, pour `/admin/`) :

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

### TLS avec Caddy

`/etc/caddy/Caddyfile` :

```
streak.mondomaine.fr {
    reverse_proxy localhost:8020
}
```

Caddy obtient et renouvelle le certificat seul. Django lit `X-Forwarded-Proto` (réglé dans
`settings.py` quand `DJANGO_DEBUG=0`) pour savoir qu'il est en HTTPS.

## Mettre à jour

```bash
cd streak_and_flex && scripts/deploy.sh
```

`git pull --ff-only`, rebuild des images, `up -d`, `migrate`, vérification. Quelques
secondes d'indisponibilité pendant le redémarrage.

## Sauvegardes

```bash
scripts/db-backup.sh                      # → dumps/streak_YYYYMMDD_HHMM.sql.gz
# cron quotidien, par exemple :
# 0 3 * * * /home/user/streak_and_flex/scripts/db-backup.sh >> /home/user/streak_backup.log 2>&1
```

Restauration :

```bash
gunzip -c dumps/streak_X.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U streak streak
```

Rapatrier la base de prod en local : `scp` du dump puis la même commande avec
`docker-compose.yml` (sans `-f`).

## Exploitation

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend web
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

## Sécurité, en l'état

- Mot de passe HTTP basique sur tout le site (nginx), sauf `/api/health`.
- `DJANGO_DEBUG=0`, `SECRET_KEY` générée, cookies `Secure` derrière HTTPS.
- Postgres n'est pas exposé hors du réseau Docker.
- Pas de compte utilisateur applicatif : si l'outil doit servir à plusieurs personnes,
  ajouter une authentification Django avant.

## Tester la stack prod en local

```bash
printf 'test:%s\n' "$(openssl passwd -apr1 test)" > docker/htpasswd
docker compose -f docker-compose.prod.yml -p streak_prod up -d --build
docker compose -f docker-compose.prod.yml -p streak_prod exec backend python manage.py migrate
curl -u test:test localhost:8020/api/streaks
docker compose -f docker-compose.prod.yml -p streak_prod down -v   # nettoyage
```
