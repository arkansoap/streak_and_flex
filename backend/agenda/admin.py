"""Admin : voir le compte connecté et le résultat de la dernière synchronisation."""

from django.contrib import admin

from .models import GoogleAccount


@admin.register(GoogleAccount)
class GoogleAccountAdmin(admin.ModelAdmin):
    list_display = ("email", "calendar_id", "connected_at", "last_sync_at")
    readonly_fields = (
        "refresh_token",
        "access_token",
        "access_token_expires_at",
        "last_sync_summary",
    )
