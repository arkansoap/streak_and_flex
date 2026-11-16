"""
Point d'entrée de l'API (django-ninja).

Une seule instance `NinjaAPI`, un router par app. La doc interactive OpenAPI
est servie sur /api/docs. Les erreurs métier remontent en `{"detail": "..."}`.
"""

from django.http import HttpRequest
from ninja import NinjaAPI
from ninja.errors import ValidationError as NinjaValidationError

from streaks.api import router as streaks_router
from streaks.services import StreakError

api = NinjaAPI(
    title="Streak & Flex API",
    version="1",
    description="Suivi de streaks et de projets persos.",
)

api.add_router("/streaks", streaks_router, tags=["streaks"])


@api.exception_handler(StreakError)
def on_streak_error(request: HttpRequest, exc: StreakError):
    """Une règle métier violée (date future, niveau inconnu…) → 400 lisible."""
    return api.create_response(request, {"detail": str(exc)}, status=400)


@api.get("/health", tags=["meta"], summary="Vérifie que l'API répond")
def health(request: HttpRequest):
    return {"status": "ok"}


@api.exception_handler(NinjaValidationError)
def on_validation_error(request: HttpRequest, exc: NinjaValidationError):
    """Garde le format Ninja (`detail` = liste d'erreurs) mais en 400 plutôt que 422."""
    return api.create_response(request, {"detail": exc.errors}, status=400)
