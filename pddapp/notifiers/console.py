"""Console + file notifier — always-on, zero-config, great for testing."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

from .base import Alert, Notifier

logger = logging.getLogger("pddapp.alerts")


class ConsoleNotifier(Notifier):
    name = "console"

    def __init__(self, log_file: str | None = None) -> None:
        self.log_file = log_file

    def send(self, alert: Alert) -> None:
        line = f"🔔 ALERT  {alert.subject}"
        logger.info(line)
        if self.log_file:
            stamp = datetime.now(timezone.utc).isoformat()
            record = f"[{stamp}] {alert.subject} (threshold {alert.currency}{alert.threshold_price:.2f})\n"
            Path(self.log_file).open("a", encoding="utf-8").write(record)
