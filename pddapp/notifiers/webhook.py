"""Webhook notifier — posts a JSON payload to a configured URL.

The payload includes a ``content`` field so it works out-of-the-box with Discord
and Slack incoming webhooks, plus structured fields for custom consumers.
"""

from __future__ import annotations

import logging

import httpx

from .base import Alert, Notifier

logger = logging.getLogger("pddapp.alerts")


class WebhookNotifier(Notifier):
    name = "webhook"

    def __init__(self, url: str, *, timeout: float = 10.0) -> None:
        self.url = url
        self.timeout = timeout

    def send(self, alert: Alert) -> None:
        if not self.url:
            logger.warning("Webhook enabled but WEBHOOK_URL is empty; skipping.")
            return

        payload = {
            # Discord/Slack-friendly:
            "content": f"{alert.subject}\n{alert.url}".strip(),
            "text": alert.subject,
            # Structured fields for custom consumers:
            "alert": {
                "product_name": alert.product_name,
                "goods_id": alert.goods_id,
                "url": alert.url,
                "price": alert.price,
                "threshold_price": alert.threshold_price,
                "original_price": alert.original_price,
                "currency": alert.currency,
            },
        }
        resp = httpx.post(self.url, json=payload, timeout=self.timeout)
        resp.raise_for_status()
