"""
Règles métier du streak : découpage en périodes, calcul des stats, enregistrement
d'un check-in.

Tout le « quand le streak casse-t-il ? » est ici, en fonctions pures testables, pour
que l'API et l'admin ne fassent que de la plomberie.

Règles :
- une période (jour ou semaine, lundi → dimanche) est validée si elle contient au
  moins `required_count` check-ins, quel que soit leur niveau ;
- la période en cours ne casse jamais le streak tant qu'elle n'est pas finie : si
  elle n'est pas encore validée, on la saute et on compte à partir de la précédente ;
- le meilleur streak est la plus longue suite de périodes validées consécutives ;
- le taux de réussite ne regarde que les périodes terminées ;
- `today_level` est le niveau coché le jour même, pour les boutons de la carte.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta

from django.utils import timezone

from .models import CheckIn, Level, Period, Streak


class StreakError(Exception):
    """Règle métier violée ; l'API la rend en 400 avec le message tel quel."""


def period_start(day: date, period: str) -> date:
    """Premier jour de la période qui contient `day` (lundi pour une semaine)."""
    if period == Period.WEEK:
        return day - timedelta(days=day.weekday())
    return day


def period_end(start: date, period: str) -> date:
    """Dernier jour (inclus) de la période qui commence à `start`."""
    if period == Period.WEEK:
        return start + timedelta(days=6)
    return start


def shift_period(start: date, period: str, steps: int) -> date:
    """Début de la période située `steps` périodes plus tard (négatif = plus tôt)."""
    delta = timedelta(days=7 * steps if period == Period.WEEK else steps)
    return start + delta


@dataclass
class PeriodStatus:
    """État d'une période : combien de check-ins, validée ou non, meilleur niveau atteint."""

    start: date
    end: date
    count: int
    required: int
    validated: bool
    level: int | None
    is_current: bool


@dataclass
class StreakStats:
    current_streak: int
    best_streak: int
    total_checkins: int
    periods_done: int
    periods_validated: int
    completion_rate: float | None
    level_counts: dict[int, int] = field(default_factory=dict)
    current_period: PeriodStatus | None = None
    last_checkin: date | None = None
    today_level: int | None = None
    days_left_in_period: int = 0
    at_risk: bool = False


def today() -> date:
    """Date du jour dans le fuseau du projet (Europe/Paris), pas en UTC."""
    return timezone.localdate()


def compute_periods(
    streak: Streak, checkins: list[CheckIn], ref_day: date | None = None
) -> list[PeriodStatus]:
    """Toutes les périodes depuis le début du streak jusqu'à celle de `ref_day`, dans l'ordre.

    Le début est la plus ancienne des deux dates : `start_date` ou le premier check-in,
    pour qu'un rattrapage antérieur à `start_date` ne soit pas perdu.
    """
    ref_day = ref_day or today()
    by_period: dict[date, list[CheckIn]] = defaultdict(list)
    for c in checkins:
        by_period[period_start(c.date, streak.period)].append(c)

    first_day = min([streak.start_date, *[c.date for c in checkins]])
    cursor = period_start(first_day, streak.period)
    current = period_start(ref_day, streak.period)
    if cursor > current:
        return []

    periods: list[PeriodStatus] = []
    while cursor <= current:
        items = by_period.get(cursor, [])
        periods.append(
            PeriodStatus(
                start=cursor,
                end=period_end(cursor, streak.period),
                count=len(items),
                required=streak.required_count,
                validated=len(items) >= streak.required_count,
                level=max((c.level for c in items), default=None),
                is_current=cursor == current,
            )
        )
        cursor = shift_period(cursor, streak.period, 1)
    return periods


def _current_run(periods: list[PeriodStatus]) -> int:
    """Longueur de la suite validée qui se termine maintenant (période en cours tolérée)."""
    run = 0
    for i, p in enumerate(reversed(periods)):
        if p.validated:
            run += 1
        elif i == 0 and p.is_current:
            continue
        else:
            break
    return run


def _best_run(periods: list[PeriodStatus]) -> int:
    best = run = 0
    for p in periods:
        run = run + 1 if p.validated else 0
        best = max(best, run)
    return best


def compute_stats(streak: Streak, ref_day: date | None = None) -> StreakStats:
    """Toutes les statistiques affichées sur une carte, en une requête SQL."""
    ref_day = ref_day or today()
    checkins = list(streak.checkins.all().order_by("date"))
    periods = compute_periods(streak, checkins, ref_day)
    current = periods[-1] if periods else None
    done = [p for p in periods if not p.is_current]
    validated = [p for p in done if p.validated]
    days_left = (current.end - ref_day).days if current else 0

    return StreakStats(
        current_streak=_current_run(periods),
        best_streak=_best_run(periods),
        total_checkins=len(checkins),
        periods_done=len(done),
        periods_validated=len(validated),
        completion_rate=round(len(validated) / len(done), 3) if done else None,
        level_counts={lvl.value: 0 for lvl in Level} | dict(Counter(c.level for c in checkins)),
        current_period=current,
        last_checkin=checkins[-1].date if checkins else None,
        today_level=next((c.level for c in checkins if c.date == ref_day), None),
        days_left_in_period=days_left,
        at_risk=bool(current and not current.validated and days_left == 0),
    )


def record_checkin(streak: Streak, day: date, level: int, note: str = "") -> CheckIn:
    """Crée ou remplace le check-in du jour (un seul par jour, le dernier gagne)."""
    if level not in Level.values:
        raise StreakError(
            f"Niveau inconnu : {level}. Attendu : 1 (minimum), 2 (simplifié), 3 (réel)."
        )
    if day > today():
        raise StreakError("Impossible de valider un jour futur.")
    if streak.archived:
        raise StreakError("Ce streak est archivé ; désarchive-le avant de cocher.")
    checkin, _ = CheckIn.objects.update_or_create(
        streak=streak, date=day, defaults={"level": level, "note": note}
    )
    return checkin


def delete_checkin(streak: Streak, day: date) -> bool:
    """Décoche un jour. Renvoie False si rien n'était coché."""
    deleted, _ = CheckIn.objects.filter(streak=streak, date=day).delete()
    return deleted > 0
