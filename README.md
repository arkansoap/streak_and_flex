# Streak & Flex

Outil perso de motivation et de suivi de projets. Première brique : la page **Streaks**.

Un streak suit une habitude ou un projet (« 30 min de sport chaque jour », « une session
sur le projet X par semaine »). Chaque jour se valide à l'un de **trois niveaux** pour ne
pas casser la chaîne les jours difficiles :

| Niveau | Nom | Exemple (plan d'entraînement) |
|---|---|---|
| 3 | Objectif réel | la séance prévue |
| 2 | Objectif simplifié | 30 min de sport |
| 1 | Objectif minimum | 15 min à la maison (renfo ou étirements) |

Les trois niveaux gardent le streak en vie ; le niveau sert à rester honnête et à voir,
dans le temps, à quel point on tient le vrai objectif.

## Stack

- **Backend** : Django 5.2 + django-ninja (API REST typée, doc OpenAPI sur `/api/docs`), Python 3.12 géré par `uv`.
- **Frontend** : React 19 + TypeScript, Vite, React Router, TanStack Query.
- **Base** : PostgreSQL 16 (Docker).
- **Prod** : Docker Compose (Postgres, gunicorn, nginx), un script `scripts/deploy.sh`.
- **Supports** : ordinateur, tablette, téléphone (navigation en bas sur mobile, installable sur l'écran d'accueil).

## Démarrer en local

Prérequis : Docker, `uv`, Node 22 (`nvm use 22`).

```bash
cp .env.example .env     # valeurs de dev déjà bonnes
scripts/dev.sh           # Postgres + Django (8010) + Vite (5180)
```

Puis ouvrir http://localhost:5180. Détail des commandes, structure du code et
conventions : [docs/DEV.md](docs/DEV.md).

## Documentation

| Fichier | Contenu |
|---|---|
| [docs/DEV.md](docs/DEV.md) | Installation, commandes, structure, conventions, mémo Vue → React |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Modèles et règles de calcul du streak |
| [docs/API.md](docs/API.md) | Contrat de l'API `/api/streaks` |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Mise en prod, mises à jour, sauvegardes |

## Suite envisagée

- Page **Flex** : journal des réussites / projets à montrer.
- Rappels (mail ou notification) quand une période est en danger.
- Jours de repos planifiés et « gel » de streak.
- Authentification applicative si l'outil s'ouvre à plus d'une personne (aujourd'hui : mot de passe nginx en prod).
