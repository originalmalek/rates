# Milestones

## Milestone 4 — Multi-chain support for AAVE v3

Goal: extend the system to fetch lending/borrowing rates from AAVE v3
on **all 15 chains** where it is deployed, using DeFi Llama's
built-in `stablecoin: true` flag to automatically include all
stablecoin pools (basic, bridged, synthetic, yield-bearing, EUR-pegged).

Other protocols (compound-v3, fluid-lending, morpho-blue, spark,
sky-lending) remain Ethereum-only.

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
  text search and `+ visible` / `− visible` bulk actions because
  there are ~200 unique stablecoin symbols (Morpho Blue vault names
  included). All three filters compose via set intersection. URL:
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

---

### Remaining

#### 1. Tests

- **Repository**: `chains` / `protocols` / `assets` filters narrow
  results correctly.
- **Router**: `?chains=arbitrum,base` returns only those chains;
  empty / missing param returns everything. Cache hit/miss path
  beyond the existing `test_get_latest_cache_hit_skips_repo`.

---

### Out of scope (deferred)

- On-chain fetching (we still use DeFi Llama for everything).
- Multi-chain support for other protocols (compound-v3 has multi-chain
  deployments — left for Milestone 5).
- Per-chain TVL aggregation card.
- Morpho Blue vault-name spam handling — see `NOTES.md`.
