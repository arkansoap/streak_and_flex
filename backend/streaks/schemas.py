"""
Schémas d'entrée/sortie de l'API streaks (pydantic via django-ninja).

Convention : `XxxIn` = corps attendu, `XxxOut` = réponse. Les stats sont incluses dans
`StreakOut` pour que la page liste n'ait qu'un appel à faire.
"""

from datetime import date, datetime

from ninja import Field, Schema

from .models import Level, Period

HEX_COLOR = r"^#[0-9a-fA-F]{6}$"


class StreakIn(Schema):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    emoji: str = Field("", max_length=8)
    color: str = Field("#2563eb", pattern=HEX_COLOR)
    period: Period = Period.DAY
    required_count: int = Field(1, ge=1, le=7)
    full_label: str = Field(..., min_length=1, max_length=120)
    simplified_label: str = Field(..., min_length=1, max_length=120)
    minimum_label: str = Field(..., min_length=1, max_length=120)
    start_date: date | None = None


class StreakPatch(Schema):
    """Mise à jour partielle : seuls les champs fournis changent. `archived` bascule l'archivage."""

    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    emoji: str | None = Field(None, max_length=8)
    color: str | None = Field(None, pattern=HEX_COLOR)
    period: Period | None = None
    required_count: int | None = Field(None, ge=1, le=7)
    full_label: str | None = Field(None, min_length=1, max_length=120)
    simplified_label: str | None = Field(None, min_length=1, max_length=120)
    minimum_label: str | None = Field(None, min_length=1, max_length=120)
    start_date: date | None = None
    archived: bool | None = None


class PeriodOut(Schema):
    start: date
    end: date
    count: int
    required: int
    validated: bool
    level: int | None
    is_current: bool


class StatsOut(Schema):
    current_streak: int
    best_streak: int
    total_checkins: int
    periods_done: int
    periods_validated: int
    completion_rate: float | None
    level_counts: dict[int, int]
    current_period: PeriodOut | None
    last_checkin: date | None
    today_level: int | None
    days_left_in_period: int
    at_risk: bool


class StreakOut(Schema):
    id: int
    name: str
    description: str
    emoji: str
    color: str
    period: Period
    required_count: int
    full_label: str
    simplified_label: str
    minimum_label: str
    start_date: date
    archived: bool
    created_at: datetime
    stats: StatsOut


class CheckInIn(Schema):
    level: Level
    note: str = ""


class CheckInOut(Schema):
    date: date
    level: int
    note: str
    created_at: datetime
    updated_at: datetime


class Detail(Schema):
    detail: str
