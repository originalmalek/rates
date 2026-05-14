# DeFi Stablecoin Rates Monitor

Live dashboard tracking lending and borrowing APYs for stablecoin
pools across major DeFi protocols. Backend collects rate snapshots
every 5 minutes from DeFi Llama and serves them through a cached
FastAPI; the Next.js frontend renders a sortable / filterable table
plus 24 h history chart.

```
┌──────────────┐   5 min cron   ┌──────────────┐
│ DeFi Llama   │ ─────────────▶ │  Worker      │
└──────────────┘                │ (APScheduler)│
                                └──────┬───────┘
                                       │ insert_snapshots
                                       ▼
                                ┌──────────────┐    GET /rates/*    ┌──────────────┐
                                │  MongoDB     │ ◀───── Repo ──────  │  FastAPI     │
                                │  time-series │                     │  (uvicorn)   │
                                └──────────────┘                     └──────┬───────┘
                                                                            │ get_or_set
                                                                            ▼
                                                                     ┌──────────────┐
                                                                     │  Redis 7     │
                                                                     │  TTL 55–300s │
                                                                     └──────┬───────┘
                                                                            │ /api/* proxy
                                                                            ▼
                                                                     ┌──────────────┐
                                                                     │  Next.js 16  │
                                                                     │  Dashboard   │
                                                                     └──────────────┘
```

## What it tracks

- **AAVE v3** on all 15 chains where it deploys (ethereum, arbitrum,
  optimism, base, polygon, avalanche, bnb, gnosis, linea, mantle,
  celo, sonic, aptos, megaeth, plasma)
- **Compound v3, Fluid, Spark, Sky** on Ethereum
- **Jupiter Lend, Kamino Lend, Save** on Solana
- All pools that DeFi Llama flags `stablecoin: true` (USDC, USDT,
  DAI, USDS, sDAI, plus bridged / synthetic / yield variants)

## Stack

- Python 3.12 · FastAPI · Motor (async MongoDB) · APScheduler · httpx
- MongoDB 7 (time-series collection, see [SPEC.md](SPEC.md))
- Redis 7 (read-through API cache)
- Next.js 16 · TypeScript · Tailwind · Recharts

## Quick start

```bash
# 1. Infra (MongoDB + Redis)
cp .env.example .env   # then edit credentials
docker compose up -d

# 2. Backend
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload  # API
.venv/bin/python -m app.worker                                                # collector

# 3. Frontend
cd web
pnpm install
pnpm dev          # or `pnpm build && pnpm start` for production
```

API at http://localhost:8000 (interactive docs at `/docs`),
dashboard at http://localhost:3000.

## Project layout

```
app/
├── cache.py            redis get_or_set + sorted-csv key normaliser
├── config/             protocols whitelist + Pydantic Settings
├── main.py             FastAPI app + lifespan (mongo/redis + cache pre-warm)
├── models.py           Pydantic v2 DTOs (RateSnapshot, SnapshotMeta)
├── parsers/            DeFi Llama parser (snapshot tests in tests/parsers/)
├── repositories/       Motor access; the only place that touches MongoDB
├── routers/            HTTP handlers (call repo via cache)
├── services/           collector — orchestrates parser → repo → cache warm
└── worker.py           APScheduler entrypoint, runs collector every 5 min

web/
├── app/                Next.js App Router (page.tsx → dashboard.tsx)
├── components/         RatesTable, ApyChart, ChainFilter, …, FilterAccordion
├── hooks/              useRates, useHistory (filter-aware fetch + cancelled
│                       flag for race conditions)
└── lib/                types, formatting, chain colour palette

tests/
├── parsers/            JSON-fixture snapshot tests (no live DeFi Llama)
├── repositories/       mongomock-motor based tests
└── routers/            httpx ASGITransport + fakeredis tests
```

## Common commands

```bash
# Backend
.venv/bin/python -m mypy app/                  # types
.venv/bin/python -m pytest tests/ -v           # tests

# Frontend
pnpm build                                     # in web/

# Free port 8000 / 3000 if uvicorn or next start hangs
fuser -k 8000/tcp
fuser -k 3000/tcp
```

## Where to read more

- [SPEC.md](SPEC.md) — data model, indexes, full HTTP API,
  Redis cache contract, frontend data flow
- [CLAUDE.md](CLAUDE.md) — architecture rules + agent guidance
- [FASTAPI_RULES.md](FASTAPI_RULES.md) — coding conventions for the API
- [MILESTONES.md](MILESTONES.md) — what's done, what's next
- [NOTES.md](NOTES.md) — known issues and workarounds
