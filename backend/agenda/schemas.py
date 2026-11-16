"""Schémas de l'API agenda."""

from datetime import datetime

from ninja import Schema


class GoogleStatusOut(Schema):
    configured: bool
    connected: bool
    email: str
    calendar_name: str
    calendar_id: str
    last_sync_at: datetime | None
    last_sync_summary: dict
    pending_sync: int


class ConnectOut(Schema):
    url: str


class SyncOut(Schema):
    created: int
    updated: int
    deleted: int
    unchanged: int
    errors: list[str]


class CalendarOut(Schema):
    id: str
    name: str
    color: str
    is_streak_calendar: bool


class EventOut(Schema):
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


class AgendaOut(Schema):
    start: str
    end: str
    calendars: list[CalendarOut]
    events: list[EventOut]
