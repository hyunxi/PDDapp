"""Application configuration, loaded from environment / .env file."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Override any field via environment variable or .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Core ---
    database_url: str = "sqlite:///./pddapp.db"
    check_interval_seconds: int = 300
    default_fetcher: str = "mock"
    currency_symbol: str = "¥"

    # --- Console / file alerts ---
    console_enabled: bool = True
    alert_log_file: str = "alerts.log"

    # --- Webhook alerts ---
    webhook_enabled: bool = False
    webhook_url: str = ""

    # --- Email alerts ---
    email_enabled: bool = False
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_use_tls: bool = True
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    alert_email_to: str = ""


settings = Settings()
