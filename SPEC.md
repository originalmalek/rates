# DeFi Stablecoin Rates Monitor — Specification

## Data Model (rate_snapshots)

MongoDB time-series collection.

### Collection settings
- timeField: `ts`
- metaField: `meta`
- granularity: `minutes`
- expireAfterSeconds: 63072000 (2 years)

### Document shape

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

### Field semantics
- `ts` — UTC naive datetime, set at fetch time
- `meta.protocol` — DeFi Llama project slug (see whitelist in app/config/protocols.py)
- `meta.chain` — lowercase chain name (e.g. "ethereum")
- `meta.asset` — token symbol (e.g. "USDC", "USDT", "DAI", "USDS", "sDAI")
- `supply_apy` — percent (5.2 = 5.2%), can be None
- `borrow_apy` — percent (5.2 = 5.2%), can be None (Spark, Sky may omit)
- `utilization` — 0..1, can be None (DeFi Llama does not provide it)
- `tvl_usd` — USD float, can be None

### Indexes (created by `RatesRepository.ensure_indexes()`)

- `(meta.protocol, ts DESC)` — per-protocol history scans
- `(meta.asset, ts DESC)` — per-asset history scans
- `(meta.protocol, meta.chain, meta.asset, ts DESC)` — covers all
  three filter dimensions for `/rates/latest` and
  `/rates/history/all` queries

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
    utilization: float | None  # 0..1
    tvl_usd: float | None
```

## Data Source Whitelist

- Chains tracked for AAVE v3 (15): ethereum, arbitrum, optimism, base,
  polygon, avalanche, bnb, gnosis, linea, mantle, celo, sonic, aptos,
  megaeth, plasma
- Other protocols (Ethereum-only): fluid-lending, compound-v3,
  morpho-blue, spark, sky-lending
- Solana protocols: jupiter-lend, kamino-lend, save
- Assets: any pool with DeFi Llama's `stablecoin: true` flag
  (USDC, USDT, DAI, USDS, sDAI, plus bridged / synthetic / yield
  variants like USDC.E, USDE, sUSDE)

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

---

## Redis Cache

- All rate endpoints wrap their repo call in
  `app.cache.get_or_set(redis, key, ttl, loader)`.
- Keys are built with `make_key("rates:latest", chains, protocols,
  assets)` etc. CSV values are normalised by sorting, so
  `?chains=arbitrum,ethereum` and `?chains=ethereum,arbitrum` share
  one cache entry.
- Lifespan in `app/main.py` pre-warms the no-filter latest +
  24h-history-all keys on startup.
- Worker (`app/worker.py`) deletes and re-populates those two keys
  after each successful collection cycle so the cache never lags
  behind the database.
- Tests use `fakeredis[asyncio]`; production uses Redis 7 (compose
  service `redis`).

---

## Frontend Data Flow

- URL search params are the source of truth for filter state
  (`?chains=`, `?protocols=`, `?assets=`).
- Dashboard derives selected sets via `readSet(searchParams, …)`
  and converts them back to CSV strings via `toParam()`. "All
  selected" → `null` (no param), "none selected" → `""` (hook
  short-circuits and returns `[]`).
- Available options (the chips you can toggle) are accumulated in
  component state — they never shrink when the server returns a
  filtered subset.
- Hooks (`useRates`, `useHistory`) build `/api/rates/*` URLs from
  those filter strings, set `loading=true` at the start of every
  fetch (initial / filter change / 60 s polling / visibility
  change), and use a `cancelled` flag in the effect closure to
  discard stale in-flight responses. The dashboard renders a
  pulsing emerald dot + "Refreshing…" while `loading && data > 0`,
  and fades the table / chart to `opacity-60`.
