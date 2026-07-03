"""Observability API — thin FastAPI wrappers around obs_db.py.
Same superadmin/superuser gating as the Streamlit Observability page."""
from fastapi import APIRouter, Depends

from rag.api.auth import require_role
from rag.chat_ui.obs_db import (
    get_app_distribution,
    get_daily_volume,
    get_kpi_stats,
    get_latency_trend,
    get_low_scoring_queries,
    get_ragas_kpis,
    get_ragas_trend,
    get_recent_errors,
    get_recent_queries,
    get_token_trend,
)

router = APIRouter(prefix="/api/obs", tags=["observability"])
staff_only = require_role("superadmin", "superuser")


def _iso(rows: list[dict], *keys: str) -> list[dict]:
    for r in rows:
        for k in keys:
            if r.get(k) is not None:
                r[k] = r[k].isoformat()
    return rows


@router.get("/kpis")
def kpis(user: dict = Depends(staff_only)):
    return get_kpi_stats()


@router.get("/daily-volume")
def daily_volume(days: int = 14, user: dict = Depends(staff_only)):
    return _iso(get_daily_volume(days), "day")


@router.get("/latency-trend")
def latency_trend(days: int = 7, user: dict = Depends(staff_only)):
    return _iso(get_latency_trend(days), "day")


@router.get("/app-distribution")
def app_distribution(user: dict = Depends(staff_only)):
    return get_app_distribution()


@router.get("/token-trend")
def token_trend(days: int = 7, user: dict = Depends(staff_only)):
    return _iso(get_token_trend(days), "day")


@router.get("/recent-queries")
def recent_queries(limit: int = 50, user: dict = Depends(staff_only)):
    return _iso(get_recent_queries(limit), "created_at")


@router.get("/recent-errors")
def recent_errors(limit: int = 20, user: dict = Depends(staff_only)):
    return _iso(get_recent_errors(limit), "created_at")


@router.get("/ragas/kpis")
def ragas_kpis(user: dict = Depends(staff_only)):
    return get_ragas_kpis()


@router.get("/ragas/trend")
def ragas_trend(days: int = 7, user: dict = Depends(staff_only)):
    return _iso(get_ragas_trend(days), "day")


@router.get("/ragas/low-scoring")
def ragas_low_scoring(threshold: float = 0.5, limit: int = 20, user: dict = Depends(staff_only)):
    return _iso(get_low_scoring_queries(threshold, limit), "created_at", "evaluated_at")
