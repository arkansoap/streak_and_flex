"""Tests de contrat de l'API : les routes répondent avec la bonne forme et les bons codes."""

from datetime import timedelta

import pytest
from ninja.testing import TestClient

from config.api import api
from streaks import services
from streaks.models import Streak

client = TestClient(api)

PAYLOAD = {
    "name": "Projet perso",
    "period": "week",
    "required_count": 1,
    "full_label": "Une vraie session de 2 h",
    "simplified_label": "45 min",
    "minimum_label": "Ouvrir le projet et noter la prochaine étape",
}


@pytest.mark.django_db
def test_create_list_checkin_history_delete():
    r = client.post("/streaks", json=PAYLOAD)
    assert r.status_code == 201, r.json()
    body = r.json()
    streak_id = body["id"]
    assert body["start_date"] == services.today().isoformat()
    assert body["stats"]["current_streak"] == 0

    today = services.today().isoformat()
    r = client.put(f"/streaks/{streak_id}/checkins/{today}", json={"level": 2, "note": "ok"})
    assert r.status_code == 200, r.json()
    assert r.json()["level"] == 2

    r = client.get("/streaks")
    assert r.status_code == 200
    assert r.json()[0]["stats"]["current_streak"] == 1
    assert r.json()[0]["stats"]["current_period"]["validated"] is True

    r = client.get(f"/streaks/{streak_id}/history?periods=4")
    assert r.status_code == 200
    assert r.json()[-1]["is_current"] is True

    r = client.get(f"/streaks/{streak_id}/checkins")
    assert len(r.json()) == 1

    r = client.delete(f"/streaks/{streak_id}/checkins/{today}")
    assert r.status_code == 204
    r = client.delete(f"/streaks/{streak_id}/checkins/{today}")
    assert r.status_code == 404

    r = client.delete(f"/streaks/{streak_id}")
    assert r.status_code == 204
    assert not Streak.objects.exists()


@pytest.mark.django_db
def test_future_checkin_is_400_and_archive_toggle():
    streak_id = client.post("/streaks", json=PAYLOAD).json()["id"]
    tomorrow = (services.today() + timedelta(days=1)).isoformat()
    r = client.put(f"/streaks/{streak_id}/checkins/{tomorrow}", json={"level": 3})
    assert r.status_code == 400
    assert "futur" in r.json()["detail"]

    r = client.patch(f"/streaks/{streak_id}", json={"archived": True})
    assert r.json()["archived"] is True
    assert client.get("/streaks").json() == []
    assert len(client.get("/streaks?archived=true").json()) == 1
    r = client.patch(f"/streaks/{streak_id}", json={"archived": False, "name": "Renommé"})
    assert r.json() == r.json() | {"archived": False, "name": "Renommé"}


@pytest.mark.django_db
def test_validation_errors_are_400():
    r = client.post("/streaks", json={**PAYLOAD, "color": "bleu"})
    assert r.status_code == 400
    assert r.status_code == 400 and r.json()["detail"]
    assert client.get("/streaks/999").status_code == 404
