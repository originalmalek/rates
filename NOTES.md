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

