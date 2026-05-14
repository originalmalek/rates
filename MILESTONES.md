# Milestones

## Milestone 4 — Multi-chain support for AAVE v3 + Solana protocols

Goal: extend the system to fetch lending/borrowing rates from AAVE v3
on **all 15 chains** where it is deployed, using DeFi Llama's
built-in `stablecoin: true` flag to automatically include all
stablecoin pools (basic, bridged, synthetic, yield-bearing, EUR-pegged).

Also added three major Solana lending protocols. Morpho Blue removed
due to unreliable DeFi Llama data (vault names as symbols, APYs in
the tens of thousands).

---

### Completed

- **Config refactor** — `app/config/protocols.py` switched to
  per-protocol `{chains: frozenset}` map. AAVE v3 whitelists 15
  chains; other protocols stay Ethereum-only. Helpers
  `canonical_chain()` and `is_supported()` exported.
- **Parser refactor** — drops `_CHAIN_FILTER` and `_clean_symbol`,
  filters by `stablecoin: true`, canonicalises chain names
  (`OP Mainnet` → `optimism`, `BSC` → `bnb`). Symbols kept verbatim
  so bridged tokens (`USDC.E`, `DAI.E`, `USD₮0`) stay distinct.
- **Frontend — chain column + filter** —
  - `RatesTable` shows a coloured chain badge per row, rows sorted
    `chain → tvl desc` within asset groups.
  - `ChainFilter` chips with All / None controls; selection synced
    with URL (`?chains=ethereum,arbitrum`); shareable links.
  - `ApyChart` series keyed by `(protocol, chain, asset)`; capped to
    top-20 by avg TVL with a "showing top N" hint.
- **Frontend — sortable rate columns** — click Supply APY / Borrow
  APY / TVL header to sort. Toggle: desc → asc → off (back to
  grouped-by-asset). When a sort is active, asset section headers
  collapse and rows render flat with an extra `Asset` column. Null
  cells sink to the bottom regardless of direction.
- **Frontend — protocol and asset filters** — `ProtocolFilter` and
  `AssetFilter` mirror the chain filter pattern. Asset filter has a
  text search and `+ visible` / `− visible` bulk actions. All three
  filters compose via set intersection. URL:
  `?protocols=...&chains=...&assets=...`.
- **Parser tests** — 10/10 pass; covers multichain AAVE, chain
  alias canonicalisation, stablecoin flag, bridged distinct.
- **Database — compound index** — `RatesRepository.ensure_indexes()`
  now creates `(meta.protocol, meta.chain, meta.asset, ts DESC)`
  alongside the per-protocol and per-asset indexes.
- **API — server-side filters** — `/rates/latest` and
  `/rates/history/all` accept optional CSV `?chains=`, `?protocols=`,
  `?assets=` query params. Repository methods learn matching kwargs
  that compile into a `$match` stage.
- **Frontend hooks pass filters to API** — `useRates` /
  `useHistory` build URLs with the active filters. A `cancelled`
  flag in each effect's closure ignores in-flight responses when
  the URL changes (was a real race condition — old "no filter"
  responses were overwriting filtered ones). Available options
  are accumulated in component state so filter chips never shrink
  when the server returns a subset. Cuts history payload from
  ~1–2 MB to a few KB once the user narrows down.
- **Mobile layout fix** — `<main>` had `mx-auto` (cross-axis auto
  margins) which disables `align-items: stretch` in a flex-col
  body, causing content (the table's `min-w-[560px]`) to drive
  layout width to 560 px on every screen. Added explicit `w-full`
  + `overflow-x-hidden` on `<html>` and `min-w-0` on the table
  wrapper so the table scrolls inside its rounded container instead
  of expanding the page. Filters got a `FilterAccordion` collapse
  on mobile (`md:hidden` toggle + `md:block` always-on for desktop).
- **Refreshing indicator** — hooks set `loading=true` at the start
  of every fetch (initial, filter change, polling, visibility
  change). `LastUpdated` shows a pulsing emerald dot + "Refreshing…"
  while a fetch is in flight; table and chart fade to `opacity-60`
  for instant visual feedback on filter clicks.
- **API — freshness cutoff** — `/rates/latest` accepts optional
  `?max_age_minutes=N` (validated `ge=1`); snapshots with `ts` older
  than `now - N min` are dropped via the same `$match` stage. Cache
  key includes `max_age_minutes` so different cutoffs don't collide.
- **Redis cache layer (bonus)** — added in addition to milestone
  scope. `app/cache.py` exposes `make_key()` (sorts CSV parts so
  equivalent filter combinations share a key) and `get_or_set()`
  (load-then-store with TTL). `/rates/latest` cached for 55 s,
  `/rates/history*` for 300 s. Lifespan in `main.py` pre-warms the
  no-filter latest + 24 h history keys so the first request is
  instant. Worker invalidates and re-warms those keys after every
  insert. Adds `redis[asyncio]` runtime dep, `fakeredis[asyncio]`
  for tests.
- **Solana protocols** — added `jupiter-lend` (~$600M TVL),
  `kamino-lend`, `save` to whitelist. Added `"Solana" → "solana"`
  chain alias. No new parser needed — universal DeFi Llama parser
  handles them automatically.
- **Morpho Blue removed** — unreliable DeFi Llama data (vault names
  as asset symbols, APYs in the tens of thousands). Dropped from
  whitelist entirely.

---

### Tests

- **Repository** — 9 filter tests verify `chains` / `protocols` /
  `assets` narrow results correctly; no-filter returns all.
- **Router** — 6 tests cover CSV filter forwarding, no-filter passes
  `None`, empty `chains=` treated as no-filter, cache hit/miss,
  `max_age_minutes` forwarded.

---

### Out of scope (deferred — moved to Milestone 5)

- Multi-chain support for other protocols (compound-v3 has multi-chain
  deployments).
- Per-chain TVL aggregation card.
- On-chain fetching (we still use DeFi Llama for everything).

---

## Milestone 5 — Stablecoin Liquidity Pools

Goal: add a second top-level view for stablecoin LP / AMM pools
(Curve, Convex, Uniswap, Fluid DEX, Kamino Liquidity, etc.) alongside
the existing lending rates. Data source remains DeFi Llama; LP pools
are filtered by `stablecoin: true` AND `exposure: "multi"`.

---

### Completed

- **Phase 1 — Data layer** —
  - `PoolSnapshot` model (`supply_apy`, `tvl_usd`, no borrow /
    utilization) in `app/models.py`.
  - `LIQUIDITY_PROTOCOLS` whitelist in `app/config/protocols.py`:
    curve-dex, convex-finance, fluid-dex, uniswap-v3, uniswap-v4,
    kamino-liquidity. `is_liquidity_supported()` helper exported.
  - `PoolsRepository` (`pool_snapshots` collection) mirrors
    `RatesRepository`: `insert_snapshots`, `get_latest_all`,
    `get_history_all` with the same `chains`/`protocols`/`assets`
    filter kwargs and indexes.
  - `fetch_pool_snapshots()` in the DeFi Llama parser — same
    `/pools` endpoint, additional `exposure: "multi"` filter on
    top of `stablecoin: true`.
  - Worker now runs `collect_pools_and_store()` in the same cycle
    as the rates collector.
  - Tests: 7 parser tests (whitelist, exposure filter, Solana
    canonicalisation, APY fallback) + 7 repo tests (insert,
    filter kwargs, latest-per-series).
- **Phase 2 — `/pools/*` API** —
  - `app/cache.py` made generic over `BaseModel` so the same
    `get_or_set` works for both rates and pools.
  - `/pools/latest` and `/pools/history/all` accept the same
    `chains`/`protocols`/`assets` CSV filters as `/rates/*`.
    Separate cache namespace (`pools:latest`, `pools:history_all`).
  - Lifespan pre-warms pools cache; worker invalidates + re-warms
    after every insert.
  - **Fixed**: pre-existing cache-key mismatch on `/rates/latest`
    — the lifespan/worker built a 4-part key while the router
    built a 5-part one (with `max_age_minutes`), so the
    no-filter pre-warm never matched real requests.
  - Tests: 6 router tests covering filter forwarding, cache
    hit/miss, history endpoint.
- **Phase 3 — Frontend Liquidity Pools tab** —
  - Top-level `TabsNav` (Lending | Liquidity Pools) in the shared
    layout, sticky and route-aware via `usePathname()`.
  - `Dashboard` refactored to a generic component parameterised
    by `useData` / `useHistoryData` hooks, `TableComponent`,
    `assetOrder`, and section labels.
  - Routes: `/` keeps the lending dashboard (RatesTable); new
    `/pools` route wires up `usePools` + `usePoolHistory` +
    `PoolsTable`.
  - `PoolsTable` — protocol, chain, multi-token pool symbol
    (`USDC · USDT · DAI`), APY, TVL. No borrow column. Default
    sort: TVL desc.
  - Types refactored: `BaseSnapshot` interface with `RateSnapshot`
    and `PoolSnapshot` specialisations. `chartData` and `ApyChart`
    are now generic on `BaseSnapshot`.

---

### Out of scope (deferred)

- On-chain fetching (we still use DeFi Llama for everything).
- `max_age_minutes` cutoff for `/pools/latest` (LP TVL data
  doesn't go as stale as lending APYs — can add if needed).
- Per-token filter for pool symbols (e.g. filter by "USDC" and get
  all pools containing USDC) — current asset filter matches full
  pool symbol like `USDC-USDT-DAI`.
- Compound v3 multi-chain support (deferred from Milestone 4).
