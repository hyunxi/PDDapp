# PDDapp — Pinduoduo Price Monitor

A web app that watches **Pinduoduo (拼多多)** products and alerts you when a price
drops to or below a threshold you set. Built to deploy on **Vercel**.

- **Next.js (App Router, TypeScript)** — dashboard + JSON API
- **Supabase Postgres** via **Prisma** — products, price history, alert log
- **Supabase `pg_cron`** (or Vercel Cron) — periodic price checks
- **Resend** email + webhook + console alerts
- **Pluggable price fetchers** — a built-in mock fetcher runs the whole app today;
  a real Pinduoduo source plugs in later

## How it works

```
 Browser ─▶ Next.js dashboard / API ─▶ Prisma ─▶ Supabase Postgres
                                            ▲
 Supabase pg_cron ──(every 15 min)──▶ GET /api/cron  (Bearer CRON_SECRET)
                                            │
                                   monitor.checkAll()
                                     ├─ PriceFetcher (mock | pdd)
                                     ├─ record price history
                                     └─ edge-triggered threshold → alert
                                           ├─ console (Vercel logs)
                                           ├─ webhook (Discord/Slack/custom)
                                           └─ email (Resend)
```

**Edge-triggered alerts:** an alert fires once when a price crosses *below* the
threshold — not on every check while it stays low — and re-arms after the price
climbs back above.

## Why the real Pinduoduo fetcher is a stub

Pinduoduo offers **no open, unauthenticated price API**, and its consumer
site/app is guarded by aggressive anti-bot measures (`anti_content` request
signing, device fingerprinting, captchas). The data layer is therefore built
behind a `PriceFetcher` interface ([`src/lib/fetchers/types.ts`](src/lib/fetchers/types.ts))
so the full pipeline runs **today** on a **mock fetcher** that synthesizes
realistic, drifting prices. To wire up real data, implement
[`src/lib/fetchers/pdd.ts`](src/lib/fetchers/pdd.ts) using either:

1. **Official affiliate API — Duoduo Jinbao / 多多进宝 (recommended, stable, legal).**
   Register at <https://open.pinduoduo.com>, get `client_id` / `client_secret` + a
   promotion `pid`, call `pdd.ddk.goods.detail`, read `min_group_price`. Outbound
   calls from a Vercel serverless function are fine.
2. **Headless-browser scraping** — not viable on Vercel's default runtime; needs a
   hosted browser service and is brittle.

Products using `fetcher="pdd"` record a clear error each check until then.

## Deploy to Vercel

1. **Create a Supabase project** → Project Settings → Database → Connection string.
   Copy the **pooled** (port 6543) and **direct** (port 5432) URIs.
2. **Import this repo into Vercel** and set environment variables (see
   [`.env.example`](.env.example)):
   - `DATABASE_URL` (pooled, add `?pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` (direct)
   - `CRON_SECRET` (a long random string)
   - `RESEND_API_KEY`, `ALERT_EMAIL_FROM`, `ALERT_EMAIL_TO` (email alerts)
   - `ALERT_WEBHOOK_URL` (optional)
3. **Create the database tables.** Locally with the same env set:
   ```bash
   npm install
   npx prisma db push
   ```
4. **Deploy.** Vercel runs `npm run build` (which also runs `prisma generate`).
5. **Schedule checks.** Either:
   - **Supabase pg_cron (recommended, frequent, free):** run
     [`supabase/schedule.sql`](supabase/schedule.sql) in the Supabase SQL editor
     after editing the URL and `CRON_SECRET`. Runs every 15 min.
   - **Vercel Cron:** [`vercel.json`](vercel.json) already defines a daily
     `/api/cron` job (Vercel injects `Authorization: Bearer $CRON_SECRET`).
     The free Hobby plan caps cron at **once per day**; use pg_cron or an external
     scheduler (cron-job.org, GitHub Actions) for more frequent checks.

## Run locally

```bash
cp .env.example .env        # fill in DATABASE_URL / DIRECT_URL (and optional alerts)
npm install
npx prisma db push
npm run dev                 # http://localhost:3000
```

Add a product (name, PDD goods_id/URL, threshold), click **Check now** — with the
mock fetcher you'll see prices, history, and threshold alerts immediately.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/products` | List products |
| `POST` | `/api/products` | Add a product (`{name, goodsId, thresholdPrice, url?, fetcher?}`) |
| `GET` | `/api/products/{id}` | Get one product |
| `PATCH` | `/api/products/{id}` | Update name / threshold / fetcher / active |
| `DELETE` | `/api/products/{id}` | Remove a product |
| `GET` | `/api/products/{id}/history` | Price history |
| `POST` | `/api/products/{id}/check` | Check now |
| `GET`/`POST` | `/api/cron` | Check all active products (requires `CRON_SECRET`) |
| `GET` | `/api/health` | Health probe |

## Project layout

```
prisma/schema.prisma         Product, PriceHistory, AlertLog
src/lib/
  config.ts                  env-driven settings
  db.ts                      Prisma client singleton
  monitor.ts                 check + edge-triggered alerting
  fetchers/                  pluggable price sources (types, mock, pdd, registry)
  notifiers/                 console, webhook, email (Resend) + fan-out manager
src/app/
  page.tsx                   dashboard (server component)
  products/[id]/page.tsx     product detail + history
  actions.ts                 server actions (add/delete/toggle/check)
  api/                       JSON API + secured /api/cron
supabase/schedule.sql        pg_cron + pg_net scheduled checks
vercel.json                  Vercel Cron fallback (daily)
```
