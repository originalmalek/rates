# DeFi Stablecoin Rates Monitor — Specification

## Data Model

Two MongoDB collections, both append-only, both indexed identically.

### `rate_snapshots` — lending APYs

```json
{
  "ts": "<UTC naive datetime>",
  "meta": {
    "protocol": "aave-v3",
    "chain": "ethereum",
    "asset": "USDC"
  },
  "supply_apy": 5.23,
  "borrow_apy": 6.41,
  "utilization": null,
  "tvl_usd": 234567890.0
}
```

### `pool_snapshots` — stablecoin LP / AMM pools

```json
{
  "ts": "<UTC naive datetime>",
  "meta": {
    "protocol": "curve-dex",
    "chain": "ethereum",
    "asset": "USDC-USDT-DAI"
  },
  "supply_apy": 4.5,
  "tvl_usd": 162533318.0
}
```

`asset` holds the multi-token symbol (`USDC-USDT-DAI`, `PYUSD-USDS`).
No `borrow_apy` / `utilization` for LP pools.

### Field semantics
- `ts` — UTC naive datetime, set at fetch time
- `meta.protocol` — DeFi Llama project slug (see whitelist in `app/config/protocols.py`)
- `meta.chain` — lowercase chain name (e.g. "ethereum", "solana")
- `meta.asset` — for lending: single token symbol; for LP: multi-token symbol
- `supply_apy` — percent (5.2 = 5.2%); for LP this is the pool yield
- `borrow_apy` — percent, can be None (Spark, Sky may omit) — lending only
- `utilization` — 0..1, always None today — lending only
- `tvl_usd` — USD float, can be None

### Indexes (created by each repository's `ensure_indexes()`)

- `(meta.protocol, ts DESC)` — per-protocol history scans
- `(meta.asset, ts DESC)` — per-asset history scans
- `(meta.protocol, meta.chain, meta.asset, ts DESC)` — covers all
  three filter dimensions for `/{rates,pools}/latest` and `/history/all`

### Pydantic models (app/models.py)

```python
class SnapshotMeta(BaseModel):
    protocol: str
    chain: str
    asset: str

class RateSnapshot(BaseModel):
    ts: datetime          # UTC naive
    meta: SnapshotMeta
    supply_apy: float | None
    borrow_apy: float | None
    utilization: float | None
    tvl_usd: float | None

class PoolSnapshot(BaseModel):
    ts: datetime
    meta: SnapshotMeta    # asset = LP symbol e.g. "USDC-USDT"
    supply_apy: float | None
    tvl_usd: float | None
```

## Data Source Whitelist

### Lending (`PROTOCOLS` in `app/config/protocols.py`)

- AAVE v3 on 15 chains: ethereum, arbitrum, optimism, base, polygon,
  avalanche, bnb, gnosis, linea, mantle, celo, sonic, aptos, megaeth,
  plasma
- Ethereum-only: fluid-lending, compound-v3, spark, sky-lending
- Solana: jupiter-lend, kamino-lend, save

### Liquidity Pools (`LIQUIDITY_PROTOCOLS`)

- curve-dex, uniswap-v3, uniswap-v4 — major EVM chains
- convex-finance — ethereum, arbitrum
- fluid-dex — ethereum, arbitrum, base
- kamino-liquidity — solana

Filter: `stablecoin: true` AND `exposure: "multi"` (multi-token
pools only — no single-sided staking).

---

## HTTP API

Base: `http://localhost:8000` (proxied as `/api/*` by Next.js dev/prod).

All filter query params are comma-separated strings. Omitted = no
filter (returns everything in scope).

### `GET /health`

Returns `{"status": "ok"}`.

### `GET /rates/latest`

Latest snapshot per `(protocol, chain, asset)` series, optionally
filtered.

Query params:
- `chains` — CSV chain names, e.g. `ethereum,arbitrum`
- `protocols` — CSV protocol slugs, e.g. `aave-v3,fluid-lending`
- `assets` — CSV symbols, e.g. `USDC,USDT,DAI`
- `max_age_minutes` — int ≥ 1; drops snapshots older than the cutoff
  so chains the worker hasn't refreshed recently silently disappear
  instead of showing stale APYs

Cache: TTL 55 s, key derived from sorted CSV parts plus
`max_age_minutes`.

### `GET /rates/history/all`

24 h (or `?hours=N`) bucketed history for ALL series, suitable for
the dashboard chart. Same `chains` / `protocols` / `assets` filters
as `/rates/latest`. Aggregated into `bucket_minutes`-sized buckets
(default 60).

Cache: TTL 300 s.

### `GET /rates/history`

Single-series history. Required: `protocol`, `chain`, `asset`,
`since`. Optional: `until` (default now), `bucket_minutes`
(default 60). Returns 422 if `since >= until`.

Cache: TTL 300 s.

### `GET /pools/latest`

Latest snapshot per `(protocol, chain, asset)` series for stablecoin
LP pools (multi-token, AMM/DEX). Filters: `chains` / `protocols` /
`assets` (CSV). LP `asset` is the symbol like `USDC-USDT-DAI` or
`PYUSD-USDS`. No `max_age_minutes` cutoff for now.

Cache: TTL 55 s, key `pools:latest:<chains>:<protocols>:<assets>`.

### `GET /pools/history/all`

Bucketed history for all LP series. Same `chains` / `protocols` /
`assets` filters; `hours` (default 24), `bucket_minutes` (default
60).

Cache: TTL 300 s.

---

## Redis Cache

- All `/rates/*` and `/pools/*` endpoints wrap their repo call in
  `app.cache.get_or_set(redis, key, ttl, loader, model_type)`.
  `model_type` is the Pydantic class used to deserialise cached JSON
  (`RateSnapshot` or `PoolSnapshot`).
- Keys are built with `make_key("rates:latest", chains, protocols,
  assets, max_age_minutes)` etc. CSV values are normalised by sorting,
  so `?chains=arbitrum,ethereum` and `?chains=ethereum,arbitrum` share
  one cache entry.
- Separate namespaces: `rates:latest`, `rates:history_all`,
  `rates:history`, `pools:latest`, `pools:history_all` — no collision.
- Lifespan in `app/main.py` pre-warms the no-filter latest +
  24h-history-all keys for both rates and pools on startup.
- Worker (`app/worker.py`) deletes and re-populates the no-filter
  keys after each successful collection cycle so the cache never
  lags behind the database.
- Tests use `fakeredis[asyncio]`; production uses Redis 7 (compose
  service `redis`).

---

## Frontend Data Flow

- Two top-level routes share a `TabsNav` in the root layout:
  `/` → Lending, `/pools` → Liquidity Pools. Each route wires up
  a generic `<Dashboard>` with its own data hooks and table.
- URL search params are the source of truth for filter state
  (`?chains=`, `?protocols=`, `?assets=`). Filter state is
  independent per tab.
- Dashboard derives selected sets via `readSet(searchParams, …)`
  and converts them back to CSV strings via `toParam()`. "All
  selected" → `null` (no param), "none selected" → `""` (hook
  short-circuits and returns `[]`).
- Available options (the chips you can toggle) are accumulated in
  component state — they never shrink when the server returns a
  filtered subset.
- Hooks (`useRates` / `useHistory` for lending, `usePools` /
  `usePoolHistory` for LP) build `/api/{rates,pools}/*` URLs from
  those filter strings, set `loading=true` at the start of every
  fetch (initial / filter change / 60 s polling / visibility
  change), and use a `cancelled` flag in the effect closure to
  discard stale in-flight responses. The dashboard renders a
  pulsing emerald dot + "Refreshing…" while `loading && data > 0`,
  and fades the table / chart to `opacity-60`.
