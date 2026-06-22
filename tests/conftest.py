"""Shared pytest fixtures: an isolated in-memory database per test."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from pddapp.database import Base


@pytest.fixture()
def session():
    # In-memory SQLite shared across the single connection for the test.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine, expire_on_commit=False)
    db = TestSession()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()
