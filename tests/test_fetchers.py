from pddapp.fetchers import available_fetchers, get_fetcher
from pddapp.fetchers.mock import MockFetcher
from pddapp.fetchers.pdd import PinduoduoFetcher


def test_registry_contains_known_fetchers():
    names = available_fetchers()
    assert "mock" in names
    assert "pdd" in names


def test_unknown_fetcher_falls_back_to_mock():
    assert isinstance(get_fetcher("does-not-exist"), MockFetcher)


def test_mock_fetcher_returns_positive_price():
    result = MockFetcher().fetch("goods-123")
    assert result.ok
    assert result.price is not None and result.price > 0
    assert result.original_price is not None


def test_mock_baseline_is_stable_per_goods_id():
    f = MockFetcher()
    assert f.baseline_price("abc") == f.baseline_price("abc")
    assert f.baseline_price("abc") != f.baseline_price("xyz")


def test_pdd_fetcher_returns_clear_failure():
    result = PinduoduoFetcher().fetch("goods-123")
    assert not result.ok
    assert result.error is not None
