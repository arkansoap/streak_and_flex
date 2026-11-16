"""
Compte Google connecté à l'application.

Un seul compte : l'app est mono-utilisateur. On garde le jeton de rafraîchissement
(longue durée) et le jeton d'accès courant avec son expiration. L'identifiant du
calendrier dédié (`flex_and_streak`) est mémorisé pour ne pas le rechercher à chaque fois.
"""

from django.db import models


class GoogleAccount(models.Model):
    email = models.EmailField(help_text="Adresse du compte Google connecté.")
    refresh_token = models.TextField(
        help_text="Jeton longue durée délivré par Google à la connexion."
    )
    access_token = models.TextField(blank=True)
    access_token_expires_at = models.DateTimeField(null=True, blank=True)
    calendar_id = models.CharField(
        max_length=255, blank=True, help_text="Identifiant du calendrier dédié aux streaks."
    )
    connected_at = models.DateTimeField(auto_now_add=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_summary = models.JSONField(
        default=dict,
        blank=True,
        help_text="Résultat de la dernière synchronisation (compteurs, erreurs).",
    )

    def __str__(self) -> str:
        return self.email

    @classmethod
    def current(cls) -> "GoogleAccount | None":
        """Le compte connecté, ou None. Un seul enregistrement est attendu."""
        return cls.objects.order_by("-connected_at").first()
