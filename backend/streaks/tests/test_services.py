"""Tests des règles de streak : c'est là que se joue la confiance dans le compteur."""

from datetime import date, timedelta

import pytest

from streaks import services
from streaks.models import CheckIn, Level, Period, Streak

D0 = date(2026, 11, 16)  # un lundi


def make_streak(period=Period.DAY, required=1, start=D0 - timedelta(days=30)) -> Streak:
    return Streak.objects.create(
        name="Sport",
        period=period,
        required_count=required,
        full_label="Séance prévue",
        simplified_label="30 min de sport",
        minimum_label="15 min à la maison",
        start_date=start,
    )


def check(streak, day, level=Level.FULL):
    return CheckIn.objects.create(streak=streak, date=day, level=level)


def test_period_helpers_week():
    wed = date(2026, 11, 18)
    assert services.period_start(wed, Period.WEEK) == date(2026, 11, 16)
    assert services.period_end(date(2026, 11, 16), Period.WEEK) == date(2026, 11, 22)
    assert services.shift_period(date(2026, 11, 16), Period.WEEK, -1) == date(2026, 11, 9)


def test_period_helpers_day():
    assert services.period_start(D0, Period.DAY) == D0
    assert services.period_end(D0, Period.DAY) == D0


@pytest.mark.django_db
def test_daily_streak_counts_consecutive_days():
    s = make_streak()
    for i in range(1, 4):
        check(s, D0 - timedelta(days=i))
    stats = services.compute_stats(s, ref_day=D0)
    assert stats.current_streak == 3
    assert stats.best_streak == 3
    assert stats.current_period.validated is False
    assert stats.at_risk is True


@pytest.mark.django_db
def test_today_unvalidated_does_not_break_but_gap_does():
    s = make_streak()
    check(s, D0 - timedelta(days=1))
    check(s, D0 - timedelta(days=3))
    check(s, D0 - timedelta(days=4))
    stats = services.compute_stats(s, ref_day=D0)
    assert stats.current_streak == 1
    assert stats.best_streak == 2


@pytest.mark.django_db
def test_today_validated_extends_streak():
    s = make_streak()
    check(s, D0, Level.MINIMUM)
    check(s, D0 - timedelta(days=1), Level.SIMPLIFIED)
    stats = services.compute_stats(s, ref_day=D0)
    assert stats.current_streak == 2
    assert stats.at_risk is False
    assert stats.today_level == Level.MINIMUM
    assert stats.level_counts == {1: 1, 2: 1, 3: 0}


@pytest.mark.django_db
def test_missed_yesterday_resets_to_zero():
    s = make_streak()
    check(s, D0 - timedelta(days=2))
    assert services.compute_stats(s, ref_day=D0).current_streak == 0


@pytest.mark.django_db
def test_completion_rate_ignores_current_period():
    s = make_streak(start=D0 - timedelta(days=4))
    check(s, D0 - timedelta(days=1))
    check(s, D0 - timedelta(days=2))
    stats = services.compute_stats(s, ref_day=D0)
    assert stats.periods_done == 4
    assert stats.periods_validated == 2
    assert stats.completion_rate == 0.5


@pytest.mark.django_db
def test_weekly_streak_with_two_required():
    s = make_streak(period=Period.WEEK, required=2, start=D0 - timedelta(weeks=3))
    week_minus_1 = D0 - timedelta(weeks=1)
    week_minus_2 = D0 - timedelta(weeks=2)
    check(s, week_minus_1)
    check(s, week_minus_1 + timedelta(days=3))
    check(s, week_minus_2 + timedelta(days=2))
    check(s, week_minus_2 + timedelta(days=5))
    check(s, D0)
    stats = services.compute_stats(s, ref_day=D0)
    assert stats.current_streak == 2
    assert stats.current_period.count == 1
    assert stats.current_period.validated is False
    assert stats.days_left_in_period == 6
    assert stats.at_risk is False


@pytest.mark.django_db
def test_weekly_at_risk_on_sunday():
    s = make_streak(period=Period.WEEK, start=D0 - timedelta(weeks=1))
    check(s, D0 - timedelta(weeks=1))
    sunday = D0 + timedelta(days=6)
    stats = services.compute_stats(s, ref_day=sunday)
    assert stats.at_risk is True
    assert stats.current_streak == 1


@pytest.mark.django_db
def test_checkin_before_start_date_is_counted():
    s = make_streak(start=D0)
    check(s, D0 - timedelta(days=1))
    check(s, D0)
    assert services.compute_stats(s, ref_day=D0).current_streak == 2


@pytest.mark.django_db
def test_record_checkin_replaces_level_and_refuses_future():
    s = make_streak()
    day = services.today()
    services.record_checkin(s, day, Level.MINIMUM)
    c = services.record_checkin(s, day, Level.FULL, note="bonne séance")
    assert c.level == Level.FULL
    assert CheckIn.objects.filter(streak=s).count() == 1
    with pytest.raises(services.StreakError):
        services.record_checkin(s, day + timedelta(days=1), Level.FULL)
    with pytest.raises(services.StreakError):
        services.record_checkin(s, day, 9)
