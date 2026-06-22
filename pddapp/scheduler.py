"""Background scheduler that periodically re-checks every active product."""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from .config import settings
from .monitor import check_all

logger = logging.getLogger("pddapp.scheduler")

_scheduler: BackgroundScheduler | None = None
JOB_ID = "check-all-products"


def _job() -> None:
    try:
        check_all()
    except Exception:  # noqa: BLE001 - keep the scheduler alive on any error
        logger.exception("Scheduled check_all run failed")


def start_scheduler() -> BackgroundScheduler:
    """Start the recurring check job. Idempotent."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        _job,
        trigger="interval",
        seconds=settings.check_interval_seconds,
        id=JOB_ID,
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler started: checking every %d seconds", settings.check_interval_seconds
    )
    _scheduler = scheduler
    return scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
