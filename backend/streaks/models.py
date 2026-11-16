"""
Modèles du suivi de streaks.

Un `Streak` est une habitude ou un projet à tenir dans la durée (« 30 min de sport
tous les jours », « une session sur le projet X par semaine »). Il se mesure par
période (jour ou semaine) : la période est validée dès qu'elle contient au moins
`required_count` check-ins, quel que soit leur niveau.

Un `CheckIn` est la case cochée pour un jour donné, avec l'un des trois niveaux :
objectif réel, objectif simplifié, objectif minimum. Les trois comptent pour garder
le streak en vie ; le niveau sert à l'honnêteté et aux statistiques, pas à punir.
"""

from django.db import models


class Period(models.TextChoices):
    """Granularité à laquelle on juge le streak."""

    DAY = "day", "Jour"
    WEEK = "week", "Semaine"


class Level(models.IntegerChoices):
    """Niveau d'accomplissement d'un check-in. Ordonné : plus grand = plus exigeant."""

    MINIMUM = 1, "Objectif minimum"
    SIMPLIFIED = 2, "Objectif simplifié"
    FULL = 3, "Objectif réel"


class Streak(models.Model):
    name = models.CharField(max_length=100, help_text="Nom court affiché sur la carte.")
    description = models.TextField(
        blank=True, help_text="Pourquoi ce streak, contexte, règles perso."
    )
    emoji = models.CharField(
        max_length=8, blank=True, help_text="Un emoji pour reconnaître la carte."
    )
    color = models.CharField(
        max_length=7, default="#2563eb", help_text="Couleur d'accent de la carte (hex #rrggbb)."
    )
    period = models.CharField(
        max_length=4, choices=Period.choices, default=Period.DAY, help_text="Jour ou semaine."
    )
    required_count = models.PositiveSmallIntegerField(
        default=1, help_text="Nombre de check-ins (jours) nécessaires pour valider une période."
    )
    full_label = models.CharField(
        max_length=120, help_text="Niveau 3 : l'objectif réel, ex. « la séance prévue »."
    )
    simplified_label = models.CharField(
        max_length=120, help_text="Niveau 2 : la version simplifiée, ex. « 30 min de sport »."
    )
    minimum_label = models.CharField(
        max_length=120, help_text="Niveau 1 : le strict minimum, ex. « 15 min à la maison »."
    )
    start_date = models.DateField(
        help_text="Premier jour compté. Les périodes avant sont ignorées."
    )
    archived_at = models.DateTimeField(
        null=True, blank=True, help_text="Renseigné quand le streak est mis de côté (non supprimé)."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["archived_at", "created_at"]

    def __str__(self) -> str:
        return self.name

    @property
    def archived(self) -> bool:
        return self.archived_at is not None

    def label_for(self, level: int) -> str:
        """Libellé configuré par l'utilisateur pour un niveau donné."""
        return {
            Level.FULL: self.full_label,
            Level.SIMPLIFIED: self.simplified_label,
            Level.MINIMUM: self.minimum_label,
        }[Level(level)]


class CheckIn(models.Model):
    streak = models.ForeignKey(Streak, on_delete=models.CASCADE, related_name="checkins")
    date = models.DateField(help_text="Jour validé (un seul check-in par jour et par streak).")
    level = models.PositiveSmallIntegerField(choices=Level.choices)
    note = models.TextField(blank=True, help_text="Ressenti, détail de la séance, etc.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(fields=["streak", "date"], name="uniq_checkin_per_day"),
        ]

    def __str__(self) -> str:
        return f"{self.streak} — {self.date} (niveau {self.level})"
