# PDDapp — Pinduoduo Price Monitor

A self-hostable service that watches **Pinduoduo (拼多多)** products and alerts you
when a price drops to or below a threshold you set. It ships with a web dashboard,
a background scheduler, a JSON API, and email / webhook / console alerting.

## Architecture at a glance

```
                    ┌──────────────────────────────────────────┐
   Web dashboard ──▶│  FastAPI app (pddapp/main.py)            │
   JSON API     ──▶ │   • products, thresholds, history        │
                    └───────────────┬──────────────────────────┘
                                    │
        APScheduler ── every N s ──▶│  monitor.check_all()
                                    │   ├─ PriceFetcher (pluggable)
                                    │   │     • mock   (built-in, no network)
                                    │   │     • pdd    (stub — see below)
                                    │   ├─ records price history
                                    │   └─ edge-triggered threshold → alert
                                    ▼
                           NotifierManager
                            ├─ console + log file
                            ├─ webhook (Discord/Slack/custom)
                            └─ email (SMTP)
```

**Data source is pluggable.** The app is built against a `PriceFetcher` interface
([`pddapp/fetchers/base.py`](pddapp/fetchers/base.py)) so the whole pipeline —
scheduling, history, thresholds, alerts — runs **today** on a built-in **mock
fetcher** that synthesizes realistic, drifting prices with no network access.
Swap in a real Pinduoduo source later by implementing one class.

## Why the real Pinduoduo fetcher is a stub

Pinduoduo offers **no open, unauthenticated price API**, and its consumer
site/app is protected by aggressive anti-bot measures (`anti_content` request
signing, device fingerprinting, captchas). The two realistic ways to populate
real prices, documented in [`pddapp/fetchers/pdd.py`](pddapp/fetchers/pdd.py):

1. **Official affiliate API — Duoduo Jinbao / 多多进宝 (recommended).** Register at
   <https://open.pinduoduo.com>, get `client_id` / `client_secret` + a promotion
   `pid`, and call `pdd.ddk.goods.detail`. Stable and legal.
2. **Headless-browser scraping (Playwright).** No credentials, but brittle and
   higher ToS risk.

Until one is wired up, products with `fetcher="pdd"` simply record a clear error
on each check instead of crashing the monitor.

## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # optional: configure alerts
python run.py                 # serves http://localhost:8000
```

Open <http://localhost:8000>, add a product (name, PDD goods_id/URL, threshold),
and click **Check now** — with the default mock fetcher you'll see prices, history,
and threshold alerts immediately.

## Configuration (`.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `CHECK_INTERVAL_SECONDS` | `300` | How often the scheduler re-checks all products |
| `DEFAULT_FETCHER` | `mock` | Fetcher for new products (`mock` or `pdd`) |
| `CURRENCY_SYMBOL` | `¥` | Symbol shown in the UI |
| `CONSOLE_ENABLED` | `true` | Log alerts to console + `ALERT_LOG_FILE` |
| `WEBHOOK_ENABLED` / `WEBHOOK_URL` | `false` | POST alerts to a Discord/Slack/custom webhook |
| `EMAIL_ENABLED` + `SMTP_*` | `false` | Email alerts over SMTP (e.g. Gmail app password) |

Alerts are **edge-triggered**: an alert fires once when a price crosses *below* the
threshold, not on every check while it stays low. It re-arms once the price climbs
back above.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/products` | List watched products |
| `POST` | `/api/products` | Add a product |
| `GET` | `/api/products/{id}` | Get one product |
| `PATCH` | `/api/products/{id}` | Update threshold / pause / fetcher |
| `DELETE` | `/api/products/{id}` | Remove a product |
| `GET` | `/api/products/{id}/history` | Price history |
| `POST` | `/api/products/{id}/check` | Check now |
| `POST` | `/api/check-all` | Check every active product |
| `GET` | `/api/health` | Health probe |

## Tests

```bash
pytest
```

Covers fetcher registry/fallback, the edge-triggered alert logic (crossing,
no re-alert, re-arm, out-of-stock, fetch failure), and notifier fan-out /
failure isolation.

## Project layout

```
pddapp/
  config.py          # env-driven settings
  database.py        # SQLAlchemy engine/session
  models.py          # Product, PriceHistory, AlertLog
  monitor.py         # core check + edge-triggered alerting
  scheduler.py       # APScheduler background job
  main.py            # FastAPI routes (web + JSON API)
  fetchers/          # pluggable price sources (base, mock, pdd, registry)
  notifiers/         # console, webhook, email + fan-out manager
  templates/ static/ # dashboard UI
tests/
run.py               # uvicorn entry point
```
