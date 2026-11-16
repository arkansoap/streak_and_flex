"""
Logique de l'agenda : planning d'un streak → événement récurrent Google, synchronisation,
lecture de l'agenda complet pour l'affichage.

Un streak = au plus un événement récurrent dans le calendrier dédié. La règle de
récurrence est quotidienne (streak quotidien, heure obligatoire) ou hebdomadaire sur les
jours choisis (streak hebdo, heure facultative : sans heure, journée entière).
La validation ne passe jamais par Google : l'agenda sert aux créneaux et aux rappels.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone

from streaks.models import Period, Streak

from .google import CalendarClient, GoogleError, NotFound
from .models import GoogleAccount

WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]


def tz() -> ZoneInfo:
    return ZoneInfo(settings.TIME_ZONE)


def first_occurrence(streak: Streak, today: date) -> date:
    """Premier jour, à partir d'aujourd'hui, qui tombe sur un jour planifié."""
    days = streak.schedule_weekdays if streak.period == Period.WEEK else list(range(7))
    for offset in range(7):
        candidate = today + timedelta(days=offset)
        if candidate.weekday() in days:
            return candidate
    return today


def event_body(streak: Streak, today: date | None = None) -> dict:
    """Corps de l'événement récurrent Google décrivant le planning du streak."""
    today = today or timezone.localdate()
    start_day = first_occurrence(streak, today)
    levels = f"3 · {streak.full_label}\n2 · {streak.simplified_label}\n1 · {streak.minimum_label}"
    body: dict = {
        "summary": f"{streak.emoji} {streak.name}".strip(),
        "description": (
            f"Streak & Flex — à valider dans l'app :\n{settings.APP_URL}/streaks/{streak.id}"
            f"\n\n{levels}"
        ),
        "extendedProperties": {"private": {"streak_id": str(streak.id)}},
        "reminders": {
            "useDefault": False,
            "overrides": [{"method": "popup", "minutes": streak.reminder_minutes}],
        },
    }
    if streak.period == Period.DAY:
        body["recurrence"] = ["RRULE:FREQ=DAILY"]
    else:
        by_day = ",".join(WEEKDAY_CODES[d] for d in streak.schedule_weekdays)
        body["recurrence"] = [f"RRULE:FREQ=WEEKLY;BYDAY={by_day}"]

    if streak.schedule_time:
        start = datetime.combine(start_day, streak.schedule_time, tzinfo=tz())
        end = start + timedelta(minutes=streak.schedule_duration)
        body["start"] = {"dateTime": start.isoformat(), "timeZone": settings.TIME_ZONE}
        body["end"] = {"dateTime": end.isoformat(), "timeZone": settings.TIME_ZONE}
    else:
        body["start"] = {"date": start_day.isoformat()}
        body["end"] = {"date": (start_day + timedelta(days=1)).isoformat()}
    return body


@dataclass
class SyncResult:
    created: int = 0
    updated: int = 0
    deleted: int = 0
    unchanged: int = 0
    errors: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "created": self.created,
            "updated": self.updated,
            "deleted": self.deleted,
            "unchanged": self.unchanged,
            "errors": self.errors,
        }


def ensure_calendar(client: CalendarClient) -> str:
    """Identifiant du calendrier dédié, créé s'il n'existe pas (ou a été supprimé à la main)."""
    account = client.account
    name = settings.GOOGLE_CALENDAR_NAME
    calendars = client.list_calendars()
    if account.calendar_id and any(c["id"] == account.calendar_id for c in calendars):
        return account.calendar_id
    existing = next((c for c in calendars if c.get("summary") == name), None)
    calendar_id = existing["id"] if existing else client.create_calendar(name)["id"]
    account.calendar_id = calendar_id
    account.save(update_fields=["calendar_id"])
    return calendar_id


def sync_streaks(client: CalendarClient, force: bool = False) -> SyncResult:
    """Aligne Google sur les plannings des streaks.

    - streak actif avec planning et sans événement → création ;
    - streak modifié depuis la dernière synchro (ou `force`) → mise à jour ;
    - streak archivé ou sans planning mais avec un événement → suppression.
    Les erreurs sont isolées par streak : un échec n'empêche pas les autres.
    """
    result = SyncResult()
    calendar_id = ensure_calendar(client)
    now = timezone.now()
    for streak in Streak.objects.all():
        try:
            wants_event = streak.has_schedule and not streak.archived
            if wants_event and not streak.google_event_id:
                created = client.insert_event(calendar_id, event_body(streak))
                streak.google_event_id = created["id"]
                streak.google_synced_at = now
                result.created += 1
            elif wants_event and (force or streak.needs_sync):
                try:
                    client.update_event(calendar_id, streak.google_event_id, event_body(streak))
                except NotFound:
                    created = client.insert_event(calendar_id, event_body(streak))
                    streak.google_event_id = created["id"]
                streak.google_synced_at = now
                result.updated += 1
            elif not wants_event and streak.google_event_id:
                try:
                    client.delete_event(calendar_id, streak.google_event_id)
                except NotFound:
                    pass
                streak.google_event_id = ""
                streak.google_synced_at = None
                result.deleted += 1
            else:
                result.unchanged += 1
                continue
            Streak.objects.filter(pk=streak.pk).update(
                google_event_id=streak.google_event_id, google_synced_at=streak.google_synced_at
            )
        except GoogleError as exc:
            result.errors.append(f"{streak.name} : {exc}")
    account = client.account
    account.last_sync_at = now
    account.last_sync_summary = result.as_dict()
    account.save(update_fields=["last_sync_at", "last_sync_summary"])
    return result


@dataclass
class AgendaEvent:
    id: str
    calendar_id: str
    calendar_name: str
    color: str
    title: str
    start: str
    end: str
    all_day: bool
    streak_id: int | None
    link: str


def _normalize(event: dict, calendar: dict) -> AgendaEvent:
    start, end = event.get("start", {}), event.get("end", {})
    all_day = "date" in start
    streak_id = event.get("extendedProperties", {}).get("private", {}).get("streak_id")
    return AgendaEvent(
        id=event["id"],
        calendar_id=calendar["id"],
        calendar_name=calendar.get("summaryOverride") or calendar.get("summary", ""),
        color=calendar.get("backgroundColor", "#9aa0a6"),
        title=event.get("summary") or "(sans titre)",
        start=start.get("date") or start.get("dateTime", ""),
        end=end.get("date") or end.get("dateTime", ""),
        all_day=all_day,
        streak_id=int(streak_id) if streak_id else None,
        link=event.get("htmlLink", ""),
    )


def fetch_agenda(
    client: CalendarClient, start: date, end: date
) -> tuple[list[dict], list[AgendaEvent]]:
    """Événements de tous les calendriers visibles entre `start` (inclus) et `end` (exclu)."""
    time_min = datetime.combine(start, datetime.min.time(), tzinfo=tz()).isoformat()
    time_max = datetime.combine(end, datetime.min.time(), tzinfo=tz()).isoformat()
    calendars = [
        c for c in client.list_calendars() if c.get("selected", True) and not c.get("hidden")
    ]
    events: list[AgendaEvent] = []
    for calendar in calendars:
        try:
            for item in client.list_events(calendar["id"], time_min, time_max):
                if item.get("status") == "cancelled":
                    continue
                events.append(_normalize(item, calendar))
        except GoogleError:
            continue
    events.sort(key=lambda e: (e.start[:10], not e.all_day, e.start))
    summaries = [
        {
            "id": c["id"],
            "name": c.get("summaryOverride") or c.get("summary", ""),
            "color": c.get("backgroundColor", "#9aa0a6"),
            "is_streak_calendar": c["id"] == client.account.calendar_id,
        }
        for c in calendars
    ]
    return summaries, events


def connect_account(token_data: dict, transport=None) -> GoogleAccount:
    """Enregistre (ou remplace) le compte connecté à partir de la réponse d'échange de jeton."""
    refresh = token_data.get("refresh_token")
    if not refresh:
        raise GoogleError(
            "Google n'a pas renvoyé de refresh_token : révoque l'accès de l'app dans ton compte "
            "Google puis reconnecte-toi."
        )
    GoogleAccount.objects.all().delete()
    account = GoogleAccount(
        email="",
        refresh_token=refresh,
        access_token=token_data.get("access_token", ""),
        access_token_expires_at=timezone.now()
        + timedelta(seconds=int(token_data.get("expires_in", 3600))),
    )
    account.save()
    client = CalendarClient(account, transport)
    account.email = client.primary_calendar().get("id", "")
    account.save(update_fields=["email"])
    Streak.objects.update(google_event_id="", google_synced_at=None)
    return account
