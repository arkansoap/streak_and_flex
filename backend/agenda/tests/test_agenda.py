"""Tests de l'agenda : événement Google construit depuis le planning, synchronisation, OAuth."""

from datetime import date, time, timedelta

import httpx
import pytest
from django.utils import timezone
from ninja.testing import TestClient

from agenda import google, services
from agenda.models import GoogleAccount
from config.api import api
from streaks.models import Period, Streak

MONDAY = date(2026, 11, 16)
client = TestClient(api)


def make_streak(**kwargs) -> Streak:
    defaults = dict(
        name="Sport",
        emoji="🏃",
        period=Period.DAY,
        full_label="Séance",
        simplified_label="30 min",
        minimum_label="15 min",
        start_date=MONDAY,
        schedule_time=time(18, 30),
    )
    return Streak.objects.create(**(defaults | kwargs))


class FakeClient:
    """Double du CalendarClient : enregistre les appels, simule des événements existants."""

    def __init__(self, account, existing=None, missing=()):
        self.account = account
        self.calls = []
        self.missing = set(missing)
        self.calendars = [{"id": "cal-1", "summary": "flex_and_streak"}]

    def list_calendars(self):
        return self.calendars

    def create_calendar(self, summary):
        return {"id": "cal-new"}

    def insert_event(self, calendar_id, body):
        self.calls.append(("insert", body["summary"]))
        return {"id": f"ev-{len(self.calls)}"}

    def update_event(self, calendar_id, event_id, body):
        if event_id in self.missing:
            raise google.NotFound(event_id)
        self.calls.append(("update", event_id))
        return {"id": event_id}

    def delete_event(self, calendar_id, event_id):
        if event_id in self.missing:
            raise google.NotFound(event_id)
        self.calls.append(("delete", event_id))


@pytest.mark.django_db
def test_daily_event_has_time_and_daily_rule():
    s = make_streak(schedule_duration=45, reminder_minutes=15)
    body = services.event_body(s, today=MONDAY)
    assert body["summary"] == "🏃 Sport"
    assert body["recurrence"] == ["RRULE:FREQ=DAILY"]
    assert body["start"]["dateTime"] == "2026-11-16T18:30:00+01:00"
    assert body["end"]["dateTime"] == "2026-11-16T19:15:00+01:00"
    assert body["reminders"]["overrides"] == [{"method": "popup", "minutes": 15}]
    assert body["extendedProperties"]["private"]["streak_id"] == str(s.id)
    assert f"/streaks/{s.id}" in body["description"]


@pytest.mark.django_db
def test_weekly_all_day_event_starts_on_next_planned_day():
    s = make_streak(period=Period.WEEK, schedule_time=None, schedule_weekdays=[2, 5])
    body = services.event_body(s, today=MONDAY)
    assert body["recurrence"] == ["RRULE:FREQ=WEEKLY;BYDAY=WE,SA"]
    assert body["start"] == {"date": "2026-11-18"}
    assert body["end"] == {"date": "2026-11-19"}


@pytest.mark.django_db
def test_has_schedule_and_needs_sync():
    daily_without_time = make_streak(schedule_time=None)
    assert daily_without_time.has_schedule is False
    assert daily_without_time.needs_sync is False
    weekly = make_streak(period=Period.WEEK, schedule_weekdays=[0])
    assert weekly.has_schedule is True
    assert weekly.needs_sync is True
    weekly.google_event_id = "ev"
    weekly.google_synced_at = timezone.now() + timedelta(seconds=5)
    assert weekly.needs_sync is False
    weekly.archived_at = timezone.now()
    assert weekly.needs_sync is True


@pytest.mark.django_db
def test_sync_creates_updates_deletes():
    account = GoogleAccount.objects.create(email="a@b.c", refresh_token="r", calendar_id="cal-1")
    new = make_streak(name="Nouveau")
    synced = make_streak(name="Déjà", google_event_id="ev-old")
    Streak.objects.filter(pk=synced.pk).update(
        google_synced_at=timezone.now() + timedelta(seconds=5)
    )
    changed = make_streak(name="Modifié", google_event_id="ev-changed")
    Streak.objects.filter(pk=changed.pk).update(google_synced_at=timezone.now() - timedelta(days=1))
    archived = make_streak(name="Archivé", google_event_id="ev-arch", archived_at=timezone.now())
    lost = make_streak(name="Perdu", google_event_id="ev-lost")
    Streak.objects.filter(pk=lost.pk).update(google_synced_at=timezone.now() - timedelta(days=1))

    fake = FakeClient(account, missing={"ev-lost"})
    result = services.sync_streaks(fake)

    assert (result.created, result.updated, result.deleted, result.unchanged) == (1, 2, 1, 1)
    assert result.errors == []
    assert ("insert", "🏃 Nouveau") in fake.calls
    assert ("update", "ev-changed") in fake.calls
    assert ("delete", "ev-arch") in fake.calls
    new.refresh_from_db()
    assert new.google_event_id.startswith("ev-") and new.google_synced_at is not None
    archived.refresh_from_db()
    assert archived.google_event_id == ""
    lost.refresh_from_db()
    assert lost.google_event_id != "ev-lost", "événement supprimé à la main → recréé"
    account.refresh_from_db()
    assert account.last_sync_summary["created"] == 1


@pytest.mark.django_db
def test_ensure_calendar_creates_when_absent():
    account = GoogleAccount.objects.create(email="a@b.c", refresh_token="r", calendar_id="gone")
    fake = FakeClient(account)
    fake.calendars = [{"id": "other", "summary": "Perso"}]
    assert services.ensure_calendar(fake) == "cal-new"
    account.refresh_from_db()
    assert account.calendar_id == "cal-new"


@pytest.mark.django_db
def test_client_refreshes_expired_token(settings):
    settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET = "id", "secret"
    account = GoogleAccount.objects.create(
        email="a@b.c", refresh_token="r", access_token="old", access_token_expires_at=timezone.now()
    )
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, request.url.path))
        if request.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"access_token": "fresh", "expires_in": 3600})
        assert request.headers["Authorization"] == "Bearer fresh"
        return httpx.Response(200, json={"items": [{"id": "c1", "summary": "x"}]})

    c = google.CalendarClient(account, transport=httpx.MockTransport(handler))
    assert c.list_calendars() == [{"id": "c1", "summary": "x"}]
    assert seen[0] == ("POST", "/token")
    account.refresh_from_db()
    assert account.access_token == "fresh"


@pytest.mark.django_db
def test_status_and_connect_without_config(settings):
    settings.GOOGLE_CLIENT_ID = ""
    r = client.get("/google/status")
    assert r.status_code == 200
    assert r.json()["configured"] is False and r.json()["connected"] is False
    assert client.get("/google/connect").status_code == 400
    assert client.post("/agenda/sync").status_code == 400
    assert client.get("/agenda/events?start=2026-11-16&end=2026-11-23").status_code == 400


@pytest.mark.django_db
def test_callback_rejects_bad_state(settings):
    settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET = "id", "secret"
    r = client.get("/google/callback?code=abc&state=forged")
    assert r.status_code == 302
    assert r["Location"].endswith("/agenda?google=bad_state")


@pytest.mark.django_db
def test_streak_api_exposes_schedule():
    r = client.post(
        "/streaks",
        json={
            "name": "Projet",
            "period": "week",
            "full_label": "2 h",
            "simplified_label": "45 min",
            "minimum_label": "ouvrir",
            "schedule_weekdays": [3, 1, 1],
            "schedule_time": "20:00",
        },
    )
    assert r.status_code == 201, r.json()
    body = r.json()
    assert body["schedule_weekdays"] == [1, 3]
    assert body["schedule_time"] == "20:00:00"
    assert body["has_schedule"] is True and body["needs_sync"] is True
    r = client.post(
        "/streaks",
        json={
            **{
                k: v
                for k, v in body.items()
                if k in ("name", "period", "full_label", "simplified_label", "minimum_label")
            },
            "schedule_weekdays": [9],
        },
    )
    assert r.status_code == 400
