# DeFi Stablecoin Rates Monitor — Specification

## Data Model

Three MongoDB collections, all append-only, all indexed identically.

### `rate_snapshots` — lending APYs

```json
{
  "ts": "<UTC naive datetime>",
  "meta": {
    "protocol": "aave-v3",
    "chain": "ethereum",
    "asset": "USDC",
    "pool_id": "aa70268e-4b52-42bf-a116-608b370f9501"
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
    "asset": "USDC-USDT-DAI",
    "pool_id": "6a2e2ad4-...-3f0c9d1b5e77"
  },
  "supply_apy": 4.5,
  "tvl_usd": 162533318.0
}
```

`asset` holds the multi-token symbol (`USDC-USDT-DAI`, `PYUSD-USDS`).
No `borrow_apy` / `utilization` for LP pools.

### `vault_snapshots` — curated stablecoin yield vaults

```json
{
  "ts": "<UTC naive datetime>",
  "meta": {
    "protocol": "morpho-blue",
    "chain": "ethereum",
    "asset": "USDC",
    "pool_id": "1e33e4a4-...-9c0d51b8e402",
    "vault_name": "steakUSDC"
  },
  "supply_apy": 7.4,
  "apy_base": 5.1,
  "apy_reward": 2.3,
  "apy_mean_30d": 6.8,
  "tvl_usd": 450000000.0
}
```

A vault is one deposit token managed by a curator — no borrow side, and
its headline APY is a blend of the markets the curator allocates to. The
`meta` gains one field over the other two collections: `vault_name` keeps
DeFi Llama's raw symbol (`steakUSDC`, `gtUSDCcore`), while `asset` holds
the **underlying** stablecoin so the asset filter works like the other
tabs. `underlying_stablecoin()` in the parser resolves it by substring
against `_UNDERLYING_STABLES`; ~89% of live vaults resolve, the rest are
exotic stables (`BOLD`, `synUSD`) that are their own underlying, so both
fields hold the raw symbol.

The APY split matters and is stored, not collapsed: a 15% headline that
is 12% `apy_reward` is a farm that ends. 43 of ~260 live vaults carry
material reward APY.

### Field semantics
- `ts` — UTC naive datetime, set at fetch time
- `meta.protocol` — DeFi Llama project slug (see whitelist in `app/config/protocols.py`)
- `meta.chain` — lowercase chain name (e.g. "ethereum", "solana")
- `meta.asset` — for lending: single token symbol; for LP: multi-token
  symbol; for vaults: the underlying stablecoin
- `meta.vault_name` — vaults only; DeFi Llama's raw symbol
- `meta.pool_id` — DeFi Llama's `pool` UUID. **The series identity.** The
  triple `(protocol, chain, asset)` is *not* unique upstream —
  `kamino-lend/solana/USDC` alone is 17 distinct markets — so without this
  field `get_latest_all()` collapsed them into one arbitrary winner and
  hid 94 of 271 lending pools. A pool with no id is skipped by the parser.
  Single-series lookups (`get_latest`, `get_history`, `get_snapshots`)
  take `pool_id` and nothing else.
- `supply_apy` — percent (5.2 = 5.2%); for LP this is the pool yield,
  for vaults the total (base + rewards). Named `supply_apy` in all three
  so the shared table / chart / sparkline components key off one field.
- `borrow_apy` — percent, can be None (Spark, Sky may omit) — lending only
- `utilization` — 0..1, always None today — lending only
- `apy_base` / `apy_reward` / `apy_mean_30d` — percent, can be None —
  vaults only. `None` means "not reported" and is never coerced to 0.
- `tvl_usd` — USD float, can be None

### Indexes (created by each repository's `ensure_indexes()`)

- `(meta.protocol, ts DESC)` — per-protocol history scans
- `(meta.asset, ts DESC)` — per-asset history scans
- `(meta.protocol, meta.chain, meta.asset, ts DESC)` — covers all
  three filter dimensions for `/{rates,pools}/latest` and `/history/all`
- `(meta.pool_id, ts DESC)` — single-series lookups

### Pydantic models (app/models.py)

```python
class SnapshotMeta(BaseModel):
    protocol: str
    chain: str
    asset: str
    pool_id: str          # DeFi Llama pool UUID — the series key

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

class VaultMeta(SnapshotMeta):
    vault_name: str       # raw DeFi Llama symbol, e.g. "steakUSDC"

class VaultSnapshot(BaseModel):
    ts: datetime
    meta: VaultMeta       # asset = underlying, e.g. "USDC"
    supply_apy: float | None    # total = base + rewards
    apy_base: float | None
    apy_reward: float | None
    apy_mean_30d: float | None
    tvl_usd: float | None
```

## Data Source Whitelist

Whitelisting is **per protocol, not per chain**: every chain DeFi Llama
reports for a listed protocol is collected. A per-chain whitelist used to
gate this, and new deployments (Monad on AAVE v3, Arbitrum on Sky) stayed
invisible until someone hand-edited a frozenset.

Slugs must match DeFi Llama's `project` field exactly — a wrong slug
matches nothing and fails silently rather than erroring.

### Lending (`PROTOCOLS` in `app/config/protocols.py`)

- aave-v3, compound-v3, fluid-lending, sparklend, spark-savings,
  sky-lending, jupiter-lend, kamino-lend, save

### Liquidity Pools (`LIQUIDITY_PROTOCOLS`)

- curve-dex, convex-finance, fluid-dex, uniswap-v3, uniswap-v4,
  kamino-liquidity

Filter: `stablecoin: true` AND `exposure: "multi"` (multi-token
pools only — no single-sided staking).

### Vaults (`VAULT_PROTOCOLS`)

- morpho-blue, euler-v2, yearn-finance, curve-llamalend, midas-rwa,
  centrifuge-protocol, ember-protocol, resupply, silo-v2, fraxlend,
  curvance, lagoon, fusion-by-ipor, harvest-finance, wildcat-protocol,
  accountable, strata-markets

Filter: `stablecoin: true` AND `exposure: "single"` AND
`tvlUsd >= VAULT_MIN_TVL_USD` ($1M). The TVL floor is what makes the
tab readable — 686 pools carry the flags, but below $1M they are test
deployments and abandoned curators whose APY is noise.

The three sets are disjoint. `exposure: "single"` alone would also match
every lending market, so protocol membership is what separates a vault
from a money market; a pool therefore never appears on two tabs.

---

## HTTP API

Base: `http://localhost:8000` (proxied as `/api/*` by Next.js dev/prod).

All filter query params are comma-separated strings. Omitted = no
filter (returns everything in scope).

### `GET /health`

Returns `{"status": "ok"}`.

### `GET /rates/latest`

Latest snapshot per series (one per `meta.pool_id`), optionally
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

Single-series history. Required: `pool_id`, `since`. Optional:
`until` (default now), `bucket_minutes` (default 60). Returns 422 if
`since >= until`.

Cache: TTL 300 s.

### `GET /rates/snapshots`

Raw (unbucketed) snapshots for one series, newest first. Required:
`pool_id`. Optional: `limit` (1..200, default 50), `offset`.
Returns `{items, total}`. Not cached.

### `GET /pools/latest`

Latest snapshot per series for stablecoin LP pools (multi-token,
AMM/DEX). Filters: `chains` / `protocols` / `assets` (CSV). LP
`asset` is the symbol like `USDC-USDT-DAI` or `PYUSD-USDS`. No
`max_age_minutes` cutoff for now.

Cache: TTL 55 s, key `pools:latest:<chains>:<protocols>:<assets>`.

### `GET /pools/history/all`

Bucketed history for all LP series. Same `chains` / `protocols` /
`assets` filters; `hours` (default 24), `bucket_minutes` (default
60).

Cache: TTL 300 s.

### `GET /pools/history`, `GET /pools/snapshots`

Same contract as the `/rates` equivalents above, over
`pool_snapshots`. Cache namespace `pools:history`.

### `GET /vaults/latest`, `/vaults/history/all`, `/vaults/history`, `/vaults/snapshots`

Same four-endpoint contract as `/rates` and `/pools`, over
`vault_snapshots`, with `max_age_minutes` on `/latest` (default: the
server staleness cutoff, so a vault that drops below the TVL floor
falls off instead of lingering). `assets` filters on the **underlying**
stablecoin (`?assets=USDC,DAI`), not on `vault_name`. Cache namespaces
`vaults:latest`, `vaults:history_all`, `vaults:history`.

---

## Redis Cache

- All `/rates/*`, `/pools/*` and `/vaults/*` endpoints wrap their repo
  call in `app.cache.get_or_set(redis, key, ttl, loader, model_type)`.
  `model_type` is the Pydantic class used to deserialise cached JSON
  (`RateSnapshot`, `PoolSnapshot` or `VaultSnapshot`).
- Keys are built with `make_key("rates:latest", chains, protocols,
  assets, max_age_minutes)` etc. CSV values are normalised by sorting,
  so `?chains=arbitrum,ethereum` and `?chains=ethereum,arbitrum` share
  one cache entry.
- Separate namespaces: `rates:latest`, `rates:history_all`,
  `rates:history`, `pools:latest`, `pools:history_all`,
  `pools:history`, `vaults:latest`, `vaults:history_all`,
  `vaults:history` — no collision.
- Lifespan in `app/main.py` pre-warms the no-filter latest +
  24h-history-all keys for all three collections on startup. A pre-warm
  must build its key and call its loader *exactly* as the route does,
  or it writes an entry nothing ever reads (see NOTES.md).
- Worker (`app/worker.py`) deletes and re-populates the no-filter
  keys after each successful collection cycle so the cache never
  lags behind the database.
- Tests use `fakeredis[asyncio]`; production uses Redis 7 (compose
  service `redis`).

---

## Frontend Data Flow

- Three top-level routes share a `TabsNav` in the root layout:
  `/` → Lending, `/pools` → Liquidity Pools, `/vaults` → Vaults.
  Each route wires up a generic `<Dashboard>` with its own data
  hooks and table.
- The Vaults tab passes two optional `<Dashboard>` props the other
  tabs leave unset: `extraSearchText` and `cardLabel`, both
  `(snap) => snap.meta.vault_name`. A vault's `meta.asset` is the
  underlying stablecoin, so without them the search box couldn't
  find `STEAKUSDC` and every carousel card would be headlined
  "USDC".
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
  `usePoolHistory` for LP, `useVaults` / `useVaultHistory` for
  vaults) build `/api/{rates,pools,vaults}/*` URLs from
  those filter strings, set `loading=true` at the start of every
  fetch (initial / filter change / 60 s polling / visibility
  change), and use a `cancelled` flag in the effect closure to
  discard stale in-flight responses. The dashboard renders a
  pulsing emerald dot + "Refreshing…" while `loading && data > 0`,
  and fades the table / chart to `opacity-60`.
