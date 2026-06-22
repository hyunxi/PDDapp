"""Email notifier over SMTP (works with Gmail app passwords, etc.)."""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

from .base import Alert, Notifier


class EmailNotifier(Notifier):
    name = "email"

    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str,
        password: str,
        sender: str,
        recipient: str,
        use_tls: bool = True,
        timeout: float = 20.0,
    ) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.sender = sender or username
        self.recipient = recipient
        self.use_tls = use_tls
        self.timeout = timeout

    def send(self, alert: Alert) -> None:
        msg = EmailMessage()
        msg["Subject"] = alert.subject
        msg["From"] = self.sender
        msg["To"] = self.recipient
        msg.set_content(alert.body_text())

        with smtplib.SMTP(self.host, self.port, timeout=self.timeout) as server:
            server.ehlo()
            if self.use_tls:
                server.starttls()
                server.ehlo()
            if self.username and self.password:
                server.login(self.username, self.password)
            server.send_message(msg)
