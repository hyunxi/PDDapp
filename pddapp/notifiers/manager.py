"""Fan-out manager that dispatches an alert to every enabled channel.

A failure in one channel never prevents the others from firing, and never
propagates out of ``dispatch`` — alerting must not crash the monitor.
"""

from __future__ import annotations

import logging

from ..config import Settings, settings
from .base import Alert, Notifier
from .console import ConsoleNotifier
from .email import EmailNotifier
from .webhook import WebhookNotifier

logger = logging.getLogger("pddapp.alerts")


class NotifierManager:
    def __init__(self, notifiers: list[Notifier]) -> None:
        self.notifiers = notifiers

    @property
    def channel_names(self) -> list[str]:
        return [n.name for n in self.notifiers]

    def dispatch(self, alert: Alert) -> list[str]:
        """Send ``alert`` to all channels; return the names that succeeded."""
        delivered: list[str] = []
        for notifier in self.notifiers:
            try:
                notifier.send(alert)
                delivered.append(notifier.name)
            except Exception as exc:  # noqa: BLE001 - isolate channel failures
                logger.error("Notifier %r failed: %s", notifier.name, exc)
        return delivered


def build_default_manager(cfg: Settings | None = None) -> NotifierManager:
    """Construct a manager from configuration, enabling only what's turned on."""
    cfg = cfg or settings
    notifiers: list[Notifier] = []

    if cfg.console_enabled:
        notifiers.append(ConsoleNotifier(log_file=cfg.alert_log_file or None))

    if cfg.webhook_enabled and cfg.webhook_url:
        notifiers.append(WebhookNotifier(cfg.webhook_url))

    if cfg.email_enabled:
        notifiers.append(
            EmailNotifier(
                host=cfg.smtp_host,
                port=cfg.smtp_port,
                username=cfg.smtp_user,
                password=cfg.smtp_password,
                sender=cfg.smtp_from,
                recipient=cfg.alert_email_to,
                use_tls=cfg.smtp_use_tls,
            )
        )

    return NotifierManager(notifiers)
