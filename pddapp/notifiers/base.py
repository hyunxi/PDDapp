"""The notifier interface and the Alert payload."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(slots=True)
class Alert:
    """A price-drop alert ready to be delivered over any channel."""

    product_name: str
    goods_id: str
    url: str
    price: float
    threshold_price: float
    original_price: float | None
    currency: str = "¥"

    @property
    def subject(self) -> str:
        return (
            f"Price drop: {self.product_name} now "
            f"{self.currency}{self.price:.2f}"
        )

    def body_text(self) -> str:
        lines = [
            f"{self.product_name} has dropped below your threshold.",
            "",
            f"Current price:   {self.currency}{self.price:.2f}",
            f"Your threshold:  {self.currency}{self.threshold_price:.2f}",
        ]
        if self.original_price is not None:
            lines.append(f"List price:      {self.currency}{self.original_price:.2f}")
        lines += [
            f"Goods ID:        {self.goods_id}",
        ]
        if self.url:
            lines.append(f"Link:            {self.url}")
        return "\n".join(lines)


class Notifier(ABC):
    """A single delivery channel (email, webhook, console, ...)."""

    name: str = "base"

    @abstractmethod
    def send(self, alert: Alert) -> None:
        """Deliver the alert. May raise; the manager isolates failures."""
        raise NotImplementedError
