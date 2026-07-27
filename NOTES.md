# Notes

## Settings rejects extra fields from .env (FIXED)

`app/config/settings.py` now passes `extra="ignore"` to
`SettingsConfigDict`, so unrelated `.env` keys (`MONGO_USER`,
`MONGO_PASSWORD`, etc.) no longer block tests that import
`app.main`.

## datetime.utcnow() deprecation (Python 3.12)

`datetime.utcnow()` is deprecated in Python 3.12+. The SKILL.md spec requires UTC
naive datetimes for the MongoDB time-series timeField. Until the spec is updated to
allow timezone-aware datetimes, we keep `utcnow()`. Future fix: switch to
`datetime.now(UTC).replace(tzinfo=None)` after confirming Motor / MongoDB accept it.

Used in: parsers, repositories, collector, routers, tests — search the
codebase for `datetime.utcnow()` if the spec is ever relaxed.

## MongoDB collections: time-series on fresh installs only

`ensure_indexes()` in both repositories now calls
`ensure_timeseries(db, name)` (`app/repositories/timeseries.py`)
before creating its regular indexes. Fresh installs get a real
time-series collection (`timeField=ts`, `metaField=meta`,
`granularity=minutes`, 2-year TTL); mongomock falls back silently
to a regular collection (auto-created on insert).

**Existing prod collections remain regular** — MongoDB doesn't
support converting in place. If you want them as time-series:
drop both `rate_snapshots` and `pool_snapshots`, restart the
worker, and the next collector cycle (≤5 min) will create them
properly and refill from DeFi Llama. History will be lost in
exchange.

## test_apy_values_not_divided_by_100 fails — borrow_apy is None (FIXED 2026-05-07)

Root cause: fixture used field name `apyBorrow`, but DeFi Llama's real
/lendBorrow API and the parser both use `apyBaseBorrow`. Fixed by
updating tests/fixtures/defillama_lendborrow.json.

## Morpho Blue floods the table with vault-named "stablecoins" (RESOLVED)

After enabling `stablecoin: true` filter, Morpho Blue contributed ~200
unique "assets" with custom vault names (`1337USDC`,
`ALPHAFRAXUSDENHANCED`, etc.) and APYs in the tens of thousands.
Resolution: dropped `morpho-blue` from `PROTOCOLS` in Milestone 4. If
ever re-added, Option 3 (symbol-noise regex) is probably the right
fix.

Superseded by the Vaults tab: `morpho-blue` lives in `VAULT_PROTOCOLS`
now, where the noise is handled properly rather than excluded. The vault
name goes to `meta.vault_name` (it *is* the product name there, not an
asset), `meta.asset` holds the underlying resolved by
`underlying_stablecoin()`, and the $1M TVL floor removes the dust
deployments that carried the absurd APYs. It stays out of `PROTOCOLS` —
a curated vault is not a money market.

## docker-compose worker comment says "every 5 min" but runs daily

`docker-compose.yml` labels the worker "pulls DeFi Llama every 5 min",
but no `COLLECT_INTERVAL_MINUTES` is set on the worker service, so it
falls back to the settings default of 1440 (daily). Prod data confirms
daily (freshest snapshots ~10 h old). Either set the env var to 5 or
fix the comment — left unresolved as it's outside the staleness fix.
This is why the /latest staleness cutoff derives from
`collect_interval_minutes` rather than a hardcoded value.


## router.replace() is silently dropped on query-loaded pages (FIXED 2026-07-24)

In production builds (statically prerendered routes), Next 16's
`router.replace()` is silently swallowed when the page was *served*
with search params already in the URL. Dev builds are unaffected,
which makes it easy to miss. Symptom: filter chips and the series-page
range switcher did nothing after any reload of a filtered URL — and
the localStorage filter restore puts params in the URL, so nearly
every returning visitor hit it ("фильтры перестали работать").

Fix: all query-only URL updates (`useDashboardFilters`, `SeriesDetail`)
now go through `window.history.replaceState`, which Next keeps in sync
with `useSearchParams` (documented Native History API pattern). Rule
for future code: never use `router.replace` for query-param-only
updates; reserve router.push/replace for real page transitions.

Related: right after hydration Next re-syncs the URL itself and can
clobber an *early* effect-driven `replaceState` — the dead-filter URL
cleanup in `useDashboardFilters` is therefore delayed by 1.2 s and
reads `location.search` at fire time. Data correctness never depends
on that cleanup: `readSet` intersects persisted selections with the
available universe (dead-only selection ⇒ no filter).

When verifying web deploys with a browser: clear the browser cache
first. Prerendered HTML is served with `s-maxage=31536000` and a
previously visited URL can render the old bundle, faking a failed
deploy.

## (protocol, chain, asset) is not unique in DeFi Llama — FIXED via meta.pool_id

The series key `meta.{protocol, chain, asset}` assumed one pool per triple.
DeFi Llama disagrees: 34 keys mapped to more than one pool, hiding 94 of 271
lending pools. Worst offenders are the Solana isolated-market lenders —
`kamino-lend/solana/USDC` alone is 17 distinct markets (TVL $21.7M down to
$0), `save/solana/USDC` is 14, `kamino-lend/solana/USDG` is 10.

All 271 were inserted, but `get_latest_all()` groups by `meta` and takes
`$first` after `$sort: {ts: -1}`. Within one collection cycle every doc
shares a `ts`, so the winner was effectively arbitrary — the dashboard could
show a dead $0 market's APY as if it were the whole Kamino USDC market.

Fixed by adding `meta.pool_id` (DeFi Llama's `pool` UUID) to `SnapshotMeta`:
`$group: {_id: "$meta"}` then separates them on its own. Single-series
lookups key off `pool_id` alone. Both collections were dropped when this
landed — old docs have no `pool_id` and the field is required, and history
keyed by the old triple would not have carried over anyway.

Beware when adding a collection: a triple-keyed series key looks fine in
small samples and only collapses on the isolated-market protocols.

## The "pools:latest" pre-warm in app/main.py is dead weight

`lifespan` warms `make_key("pools:latest", "", "", "")` — three empty
parts — while `/pools/latest` reads
`make_key("pools:latest", "", "", "", "")` with four. Different key, so
the first request always misses and recomputes. It also calls
`pools_repo.get_latest_all` bare, without
`max_age_minutes=settings.effective_max_age_minutes`, so even with the
key fixed the cached value would not match what the route serves (stale
pools included).

Harmless today — the worker's `_warm_pools_cache` writes the correct
key on every cycle — which is exactly why nobody noticed. Left alone as
out of scope; `vaults:latest` was written to match its route.

## silo-v2 matches zero vault pools

`VAULT_PROTOCOLS` lists `silo-v2`, but a live `/pools` fetch returns no
row for it under (stablecoin, single, ≥$1M). Either the slug is wrong —
the `spark` failure mode, and DeFi Llama fails silently on those — or
every Silo market falls outside the filters. Verify against
https://yields.llama.fi/pools before assuming the tab is missing data.

## Editing caddy/Caddyfile needs a container recreate, not a reload

`docker-compose.yml` bind-mounts the Caddyfile as a *single file*, so
the container follows the inode, not the path. Any editor that writes
via temp-file + rename (most of them, including Claude Code's Edit
tool) leaves the container reading the old, now-unlinked inode —
`caddy reload` then cheerfully reloads stale config and the change
silently does nothing.

Symptom: `caddy validate` passes on the host, `caddy reload` reports
success, and the new routes still 404.

Check: `docker compose exec caddy grep <new-directive> /etc/caddy/Caddyfile`
— if it's missing, the mount is stale.

Fix: `docker compose up -d --force-recreate caddy` (~1-2 s downtime for
*every* site on this Caddy, esimspotter.com included). In-place writes
that preserve the inode (`cat new > caddy/Caddyfile`) avoid the problem
and let a plain reload work.
