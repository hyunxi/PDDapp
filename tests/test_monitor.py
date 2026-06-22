import pddapp.monitor as monitor
from pddapp.fetchers.base import FetchResult, PriceFetcher
from pddapp.models import AlertLog, PriceHistory, Product
from pddapp.notifiers.base import Alert, Notifier
from pddapp.notifiers.manager import NotifierManager


class ScriptedFetcher(PriceFetcher):
    """Returns a price from a list, one per call."""

    name = "scripted"

    def __init__(self, prices, in_stock=True):
        self.prices = list(prices)
        self.in_stock = in_stock
        self.calls = 0

    def fetch(self, goods_id: str, url: str = "") -> FetchResult:
        price = self.prices[min(self.calls, len(self.prices) - 1)]
        self.calls += 1
        if price is None:
            return FetchResult.failure("boom")
        return FetchResult.success(price=price, in_stock=self.in_stock)


class RecordingNotifier(Notifier):
    name = "recording"

    def __init__(self):
        self.alerts: list[Alert] = []

    def send(self, alert: Alert) -> None:
        self.alerts.append(alert)


def _make_product(session, threshold=100.0):
    p = Product(name="Widget", goods_id="g1", threshold_price=threshold, fetcher="scripted")
    session.add(p)
    session.commit()
    return p


def _patch_fetcher(monkeypatch, fetcher):
    monkeypatch.setattr(monitor, "get_fetcher", lambda name: fetcher)


def test_alert_fires_on_crossing_below(monkeypatch, session):
    product = _make_product(session, threshold=100.0)
    _patch_fetcher(monkeypatch, ScriptedFetcher([90.0]))
    rec = RecordingNotifier()
    mgr = NotifierManager([rec])

    outcome = monitor.check_product(session, product, mgr)
    session.commit()

    assert outcome.below_threshold is True
    assert outcome.alerted is True
    assert len(rec.alerts) == 1
    assert session.query(AlertLog).count() == 1
    assert session.query(PriceHistory).count() == 1


def test_no_realert_while_staying_below(monkeypatch, session):
    product = _make_product(session, threshold=100.0)
    _patch_fetcher(monkeypatch, ScriptedFetcher([90.0, 85.0, 80.0]))
    rec = RecordingNotifier()
    mgr = NotifierManager([rec])

    for _ in range(3):
        monitor.check_product(session, product, mgr)
        session.commit()

    # Only the first dip alerts; subsequent below-threshold checks do not.
    assert len(rec.alerts) == 1
    assert session.query(AlertLog).count() == 1


def test_realert_after_recovering_above(monkeypatch, session):
    product = _make_product(session, threshold=100.0)
    _patch_fetcher(monkeypatch, ScriptedFetcher([90.0, 120.0, 95.0]))
    rec = RecordingNotifier()
    mgr = NotifierManager([rec])

    for _ in range(3):
        monitor.check_product(session, product, mgr)
        session.commit()

    # Dip -> recover -> dip again should alert twice.
    assert len(rec.alerts) == 2
    assert session.query(AlertLog).count() == 2


def test_above_threshold_never_alerts(monkeypatch, session):
    product = _make_product(session, threshold=50.0)
    _patch_fetcher(monkeypatch, ScriptedFetcher([90.0]))
    rec = RecordingNotifier()
    mgr = NotifierManager([rec])

    outcome = monitor.check_product(session, product, mgr)
    session.commit()

    assert outcome.below_threshold is False
    assert outcome.alerted is False
    assert rec.alerts == []


def test_out_of_stock_does_not_alert(monkeypatch, session):
    product = _make_product(session, threshold=100.0)
    _patch_fetcher(monkeypatch, ScriptedFetcher([90.0], in_stock=False))
    rec = RecordingNotifier()
    mgr = NotifierManager([rec])

    monitor.check_product(session, product, mgr)
    session.commit()
    assert rec.alerts == []


def test_failed_fetch_records_error_without_alert(monkeypatch, session):
    product = _make_product(session, threshold=100.0)
    _patch_fetcher(monkeypatch, ScriptedFetcher([None]))
    rec = RecordingNotifier()
    mgr = NotifierManager([rec])

    outcome = monitor.check_product(session, product, mgr)
    session.commit()

    assert outcome.ok is False
    assert outcome.error == "boom"
    assert rec.alerts == []
    history = session.query(PriceHistory).one()
    assert history.ok is False and history.error == "boom"
