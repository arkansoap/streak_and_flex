"""
Client minimal de l'API Google Calendar (OAuth 2 + REST v3), sans SDK Google.

Pourquoi à la main : on n'utilise qu'une dizaine d'appels, le client officiel tire
des dizaines de dépendances, et un client maison se teste avec `httpx.MockTransport`.

Documentation : https://developers.google.com/calendar/api/v3/reference
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
from django.conf import settings
from django.utils import timezone

from .models import GoogleAccount

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
API_URL = "https://www.googleapis.com/calendar/v3"
SCOPE = "https://www.googleapis.com/auth/calendar"


class GoogleError(Exception):
    """Erreur renvoyée par Google ou configuration manquante ; l'API la rend en 502/400."""


def is_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def authorization_url(state: str) -> str:
    """URL vers laquelle envoyer le navigateur pour autoriser l'app.

    `access_type=offline` + `prompt=consent` garantissent un refresh_token, y compris
    si l'utilisateur a déjà autorisé l'app une fois.
    """
    if not is_configured():
        raise GoogleError(
            "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ne sont pas renseignés dans .env."
        )
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def _token_request(data: dict[str, str], transport: httpx.BaseTransport | None = None) -> dict:
    with httpx.Client(transport=transport, timeout=15) as client:
        response = client.post(
            TOKEN_URL,
            data={
                **data,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
            },
        )
    if response.status_code != 200:
        raise GoogleError(f"Échange de jeton refusé par Google : {response.text[:200]}")
    return response.json()


def exchange_code(code: str, transport: httpx.BaseTransport | None = None) -> dict:
    """Code d'autorisation → jetons. Renvoie la réponse brute de Google."""
    return _token_request(
        {
            "code": code,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        transport,
    )


class CalendarClient:
    """Appels REST authentifiés pour un compte, avec rafraîchissement automatique du jeton."""

    def __init__(self, account: GoogleAccount, transport: httpx.BaseTransport | None = None):
        self.account = account
        self.transport = transport

    def _ensure_token(self) -> str:
        acc = self.account
        margin = timezone.now() + timedelta(seconds=60)
        if (
            acc.access_token
            and acc.access_token_expires_at
            and acc.access_token_expires_at > margin
        ):
            return acc.access_token
        data = _token_request(
            {"refresh_token": acc.refresh_token, "grant_type": "refresh_token"}, self.transport
        )
        acc.access_token = data["access_token"]
        acc.access_token_expires_at = timezone.now() + timedelta(
            seconds=int(data.get("expires_in", 3600))
        )
        acc.save(update_fields=["access_token", "access_token_expires_at"])
        return acc.access_token

    def request(self, method: str, path: str, **kwargs: Any) -> dict:
        token = self._ensure_token()
        with httpx.Client(transport=self.transport, timeout=20) as client:
            response = client.request(
                method, f"{API_URL}{path}", headers={"Authorization": f"Bearer {token}"}, **kwargs
            )
        if response.status_code == 404:
            raise NotFound(path)
        if response.status_code >= 400:
            raise GoogleError(
                f"Google a répondu {response.status_code} sur {method} {path} : "
                f"{response.text[:200]}"
            )
        if response.status_code == 204 or not response.content:
            return {}
        return response.json()

    def list_calendars(self) -> list[dict]:
        return self.request("GET", "/users/me/calendarList", params={"maxResults": 250}).get(
            "items", []
        )

    def primary_calendar(self) -> dict:
        return self.request("GET", "/calendars/primary")

    def create_calendar(self, summary: str) -> dict:
        return self.request(
            "POST", "/calendars", json={"summary": summary, "timeZone": settings.TIME_ZONE}
        )

    def list_events(self, calendar_id: str, time_min: str, time_max: str) -> list[dict]:
        """Occurrences (événements récurrents dépliés) entre deux instants RFC 3339."""
        items: list[dict] = []
        params: dict[str, Any] = {
            "timeMin": time_min,
            "timeMax": time_max,
            "singleEvents": "true",
            "orderBy": "startTime",
            "maxResults": 250,
        }
        while True:
            page = self.request("GET", f"/calendars/{calendar_id}/events", params=params)
            items.extend(page.get("items", []))
            token = page.get("nextPageToken")
            if not token:
                return items
            params["pageToken"] = token

    def insert_event(self, calendar_id: str, body: dict) -> dict:
        return self.request("POST", f"/calendars/{calendar_id}/events", json=body)

    def update_event(self, calendar_id: str, event_id: str, body: dict) -> dict:
        return self.request("PUT", f"/calendars/{calendar_id}/events/{event_id}", json=body)

    def delete_event(self, calendar_id: str, event_id: str) -> None:
        self.request("DELETE", f"/calendars/{calendar_id}/events/{event_id}")


class NotFound(GoogleError):
    """Ressource absente côté Google (calendrier ou événement supprimé à la main)."""
