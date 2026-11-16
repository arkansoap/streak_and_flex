"""Admin Django : secours pour corriger une donnée à la main, pas l'interface du quotidien."""

from django.contrib import admin

from .models import CheckIn, Streak


class CheckInInline(admin.TabularInline):
    model = CheckIn
    extra = 0
    fields = ("date", "level", "note")


@admin.register(Streak)
class StreakAdmin(admin.ModelAdmin):
    list_display = ("name", "period", "required_count", "start_date", "archived_at")
    list_filter = ("period", "archived_at")
    search_fields = ("name",)
    inlines = [CheckInInline]


@admin.register(CheckIn)
class CheckInAdmin(admin.ModelAdmin):
    list_display = ("streak", "date", "level")
    list_filter = ("streak", "level")
    date_hierarchy = "date"
