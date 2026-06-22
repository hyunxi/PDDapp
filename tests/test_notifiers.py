from pddapp.config import Settings
from pddapp.notifiers.base import Alert, Notifier
from pddapp.notifiers.manager import NotifierManager, build_default_manager


def _alert():
    return Alert(
        product_name="Widget",
        goods_id="g1",
        url="https://example.com/g1",
        price=88.0,
        threshold_price=100.0,
        original_price=140.0,
        currency="¥",
    )


def test_alert_subject_and_body():
    a = _alert()
    assert "Widget" in a.subject
    assert "¥88.00" in a.subject
    body = a.body_text()
    assert "¥100.00" in body
    assert "https://example.com/g1" in body


class _Boom(Notifier):
    name = "boom"

    def send(self, alert):
        raise RuntimeError("nope")


class _OK(Notifier):
    name = "ok"

    def __init__(self):
        self.count = 0

    def send(self, alert):
        self.count += 1


def test_manager_isolates_channel_failures():
    ok = _OK()
    mgr = NotifierManager([_Boom(), ok])
    delivered = mgr.dispatch(_alert())
    assert delivered == ["ok"]
    assert ok.count == 1


def test_build_default_manager_respects_config():
    cfg = Settings(
        console_enabled=True,
        webhook_enabled=True,
        webhook_url="https://example.com/hook",
        email_enabled=False,
    )
    mgr = build_default_manager(cfg)
    names = mgr.channel_names
    assert "console" in names
    assert "webhook" in names
    assert "email" not in names


def test_build_default_manager_console_only_by_default():
    cfg = Settings(console_enabled=True, webhook_enabled=False, email_enabled=False)
    mgr = build_default_manager(cfg)
    assert mgr.channel_names == ["console"]
