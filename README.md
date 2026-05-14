# DeFi Stablecoin Rates Monitor

Live dashboard tracking stablecoin APYs across major DeFi protocols.
Two top-level views:

- **Lending** — supply / borrow APYs on AAVE v3, Compound v3, Fluid,
  Spark, Sky, Jupiter Lend, Kamino Lend, Save.
- **Liquidity Pools** — LP APY + TVL on Curve, Convex, Uniswap v3/v4,
  Fluid DEX, Kamino Liquidity.

Backend collects fresh snapshots every 5 minutes from DeFi Llama and
serves them through a cached FastAPI; the Next.js frontend renders
sortable / filterable tables plus a 24 h history chart for each view.

```
┌──────────────┐   5 min cron   ┌──────────────┐
│ DeFi Llama   │ ─────────────▶ │  Worker      │
└──────────────┘                │ (APScheduler)│
                                └──────┬───────┘
                                       │ insert  (rate_snapshots
                                       ▼                 │  +
                                ┌──────────────┐   pool_snapshots)
                                │  MongoDB     │   GET /rates/*  ┌──────────────┐
                                │              │ ◀──── Repo ───  │  FastAPI     │
                                │              │   GET /pools/*  │  (uvicorn)   │
                                └──────────────┘                 └──────┬───────┘
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
                                                                 │  /  /pools   │
                                                                 └──────────────┘
```

## What it tracks

### Lending (`/`)

- **AAVE v3** on all 15 chains where it deploys (ethereum, arbitrum,
  optimism, base, polygon, avalanche, bnb, gnosis, linea, mantle,
  celo, sonic, aptos, megaeth, plasma)
- **Compound v3, Fluid, Spark, Sky** on Ethereum
- **Jupiter Lend, Kamino Lend, Save** on Solana
- Pools flagged `stablecoin: true` by DeFi Llama (USDC, USDT, DAI,
  USDS, sDAI, plus bridged / synthetic / yield variants)

### Liquidity Pools (`/pools`)

- **Curve, Convex, Fluid DEX, Uniswap v3, Uniswap v4** on Ethereum
  (+ multi-chain where applicable)
- **Kamino Liquidity** on Solana
- Pools flagged `stablecoin: true` AND `exposure: "multi"` (so single-
  sided staking pools are excluded; only AMM stablecoin pairs/baskets)

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
├── cache.py            redis get_or_set (generic over BaseModel)
├── config/             lending + liquidity protocol whitelists, settings
├── main.py             FastAPI app + lifespan (mongo/redis + cache pre-warm)
├── models.py           Pydantic v2 DTOs (RateSnapshot, PoolSnapshot)
├── parsers/            DeFi Llama parser — fetch_snapshots + fetch_pool_snapshots
├── repositories/       RatesRepository + PoolsRepository (only MongoDB access)
├── routers/            rates.py (/rates/*), pools.py (/pools/*)
├── services/           collector — orchestrates parser → repo → cache warm
└── worker.py           APScheduler entrypoint, runs both collectors every 5 min

web/
├── app/                Next.js App Router
│   ├── Dashboard.tsx     generic — takes hooks, table component, labels
│   ├── page.tsx          /  → lending dashboard
│   └── pools/page.tsx    /pools → LP dashboard
├── components/         TabsNav, RatesTable, PoolsTable, ApyChart, filters
├── hooks/              useRates / useHistory, usePools / usePoolHistory
└── lib/                types (BaseSnapshot + specialisations), formatting,
                        chain colour palette, chartData

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
