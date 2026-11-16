"""
Routes /api/google (connexion OAuth) et /api/agenda (synchronisation, lecture).

Le flux OAuth : le front demande `GET /google/connect`, reçoit l'URL Google, y envoie
le navigateur ; Google revient sur `GET /google/callback` qui stocke les jetons puis
redirige vers la page Agenda du front. Le `state` en session protège contre un
callback forgé.
"""

import secrets
from dataclasses import asdict
from datetime import date

from django.conf import settings
from django.http import HttpRequest, HttpResponseRedirect
from ninja import Query, Router, Status

from streaks.models import Streak
from streaks.schemas import Detail

from . import google, services
from .models import GoogleAccount
from .schemas import AgendaOut, ConnectOut, GoogleStatusOut, SyncOut

google_router = Router()
agenda_router = Router()


def _pending_sync() -> int:
    return sum(1 for s in Streak.objects.all() if s.needs_sync)


@google_router.get("/status", response=GoogleStatusOut, summary="État de la connexion Google")
def status(request: HttpRequest):
    account = GoogleAccount.current()
    return {
        "configured": google.is_configured(),
        "connected": account is not None,
        "email": account.email if account else "",
        "calendar_name": settings.GOOGLE_CALENDAR_NAME,
        "calendar_id": account.calendar_id if account else "",
        "last_sync_at": account.last_sync_at if account else None,
        "last_sync_summary": account.last_sync_summary if account else {},
        "pending_sync": _pending_sync(),
    }


@google_router.get(
    "/connect", response={200: ConnectOut, 400: Detail}, summary="URL d'autorisation Google"
)
def connect(request: HttpRequest):
    state = secrets.token_urlsafe(24)
    request.session["google_oauth_state"] = state
    try:
        return {"url": google.authorization_url(state)}
    except google.GoogleError as exc:
        return Status(400, {"detail": str(exc)})


@google_router.get(
    "/callback", summary="Retour de Google après autorisation", include_in_schema=False
)
def callback(
    request: HttpRequest, code: str = Query(""), state: str = Query(""), error: str = Query("")
):
    target = f"{settings.APP_URL}/agenda"
    if error or not code:
        return HttpResponseRedirect(f"{target}?google=refused")
    if not state or state != request.session.pop("google_oauth_state", None):
        return HttpResponseRedirect(f"{target}?google=bad_state")
    try:
        services.connect_account(google.exchange_code(code))
    except google.GoogleError:
        return HttpResponseRedirect(f"{target}?google=error")
    return HttpResponseRedirect(f"{target}?google=connected")


@google_router.post("/disconnect", response={204: None}, summary="Oublie le compte Google")
def disconnect(request: HttpRequest):
    GoogleAccount.objects.all().delete()
    Streak.objects.update(google_event_id="", google_synced_at=None)
    return Status(204, None)


def _client() -> google.CalendarClient | None:
    account = GoogleAccount.current()
    return google.CalendarClient(account) if account else None


@agenda_router.post(
    "/sync",
    response={200: SyncOut, 400: Detail, 502: Detail},
    summary="Pousse les plannings vers Google Agenda",
)
def sync(request: HttpRequest, force: bool = Query(False)):
    client = _client()
    if client is None:
        return Status(400, {"detail": "Aucun compte Google connecté."})
    try:
        return services.sync_streaks(client, force=force).as_dict()
    except google.GoogleError as exc:
        return Status(502, {"detail": str(exc)})


@agenda_router.get(
    "/events",
    response={200: AgendaOut, 400: Detail, 502: Detail},
    summary="Événements de tous les calendriers sur une plage",
)
def events(request: HttpRequest, start: date = Query(...), end: date = Query(...)):
    client = _client()
    if client is None:
        return Status(400, {"detail": "Aucun compte Google connecté."})
    if end <= start or (end - start).days > 62:
        return Status(400, {"detail": "Plage invalide (au plus 62 jours, fin après début)."})
    try:
        calendars, items = services.fetch_agenda(client, start, end)
    except google.GoogleError as exc:
        return Status(502, {"detail": str(exc)})
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calendars": calendars,
        "events": [asdict(e) for e in items],
    }
