"""
Routes /api/streaks. Monté par `config.api`. Le contrat complet est dans docs/API.md.

Les routes ne contiennent aucune règle métier : elles chargent, délèguent à
`services`, sérialisent.
"""

from dataclasses import asdict
from datetime import date

from django.db import transaction
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Query, Router, Status

from . import services
from .models import CheckIn, Streak
from .schemas import (
    CheckInIn,
    CheckInOut,
    Detail,
    PeriodOut,
    StreakIn,
    StreakOut,
    StreakPatch,
)

router = Router()


def serialize(streak: Streak) -> dict:
    """Streak + stats calculées. Les stats partent de dataclasses, d'où `asdict`."""
    stats = services.compute_stats(streak)
    return {
        "id": streak.id,
        "name": streak.name,
        "description": streak.description,
        "emoji": streak.emoji,
        "color": streak.color,
        "period": streak.period,
        "required_count": streak.required_count,
        "full_label": streak.full_label,
        "simplified_label": streak.simplified_label,
        "minimum_label": streak.minimum_label,
        "start_date": streak.start_date,
        "schedule_weekdays": streak.schedule_weekdays,
        "schedule_time": streak.schedule_time,
        "schedule_duration": streak.schedule_duration,
        "reminder_minutes": streak.reminder_minutes,
        "has_schedule": streak.has_schedule,
        "google_event_id": streak.google_event_id,
        "google_synced_at": streak.google_synced_at,
        "needs_sync": streak.needs_sync,
        "archived": streak.archived,
        "created_at": streak.created_at,
        "stats": asdict(stats),
    }


@router.get("", response=list[StreakOut], summary="Liste des streaks avec leurs stats")
def list_streaks(request: HttpRequest, archived: bool = Query(False)):
    qs = Streak.objects.filter(archived_at__isnull=not archived).prefetch_related("checkins")
    return [serialize(s) for s in qs]


@router.post("", response={201: StreakOut}, summary="Crée un streak")
def create_streak(request: HttpRequest, payload: StreakIn):
    data = payload.dict()
    data["start_date"] = data["start_date"] or services.today()
    streak = Streak.objects.create(**data)
    return Status(201, serialize(streak))


@router.get("/{streak_id}", response={200: StreakOut, 404: Detail}, summary="Détail d'un streak")
def get_streak(request: HttpRequest, streak_id: int):
    return serialize(get_object_or_404(Streak, pk=streak_id))


@router.patch("/{streak_id}", response={200: StreakOut, 404: Detail}, summary="Modifie un streak")
def update_streak(request: HttpRequest, streak_id: int, payload: StreakPatch):
    streak = get_object_or_404(Streak, pk=streak_id)
    data = payload.dict(exclude_unset=True)
    archived = data.pop("archived", None)
    for key, value in data.items():
        setattr(streak, key, value)
    if archived is True and not streak.archived:
        streak.archived_at = timezone.now()
    elif archived is False:
        streak.archived_at = None
    streak.save()
    return serialize(streak)


@router.delete("/{streak_id}", response={204: None, 404: Detail}, summary="Supprime un streak")
def delete_streak(request: HttpRequest, streak_id: int):
    get_object_or_404(Streak, pk=streak_id).delete()
    return Status(204, None)


@router.get(
    "/{streak_id}/history",
    response={200: list[PeriodOut], 404: Detail},
    summary="Dernières périodes (validées ou non)",
)
def history(request: HttpRequest, streak_id: int, periods: int = Query(12, ge=1, le=120)):
    streak = get_object_or_404(Streak, pk=streak_id)
    all_periods = services.compute_periods(streak, list(streak.checkins.all()))
    return [asdict(p) for p in all_periods[-periods:]]


@router.get(
    "/{streak_id}/checkins",
    response={200: list[CheckInOut], 404: Detail},
    summary="Check-ins d'un streak sur une plage de dates",
)
def list_checkins(
    request: HttpRequest,
    streak_id: int,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
):
    streak = get_object_or_404(Streak, pk=streak_id)
    qs = CheckIn.objects.filter(streak=streak)
    if date_from:
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)
    return list(qs.order_by("-date"))


@router.put(
    "/{streak_id}/checkins/{day}",
    response={200: CheckInOut, 400: Detail, 404: Detail},
    summary="Coche un jour (crée ou remplace le niveau)",
)
@transaction.atomic
def put_checkin(request: HttpRequest, streak_id: int, day: date, payload: CheckInIn):
    streak = get_object_or_404(Streak, pk=streak_id)
    return services.record_checkin(streak, day, int(payload.level), payload.note)


@router.delete(
    "/{streak_id}/checkins/{day}",
    response={204: None, 404: Detail},
    summary="Décoche un jour",
)
def remove_checkin(request: HttpRequest, streak_id: int, day: date):
    streak = get_object_or_404(Streak, pk=streak_id)
    if not services.delete_checkin(streak, day):
        return Status(404, {"detail": "Aucun check-in ce jour-là."})
    return Status(204, None)
