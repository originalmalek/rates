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

Affected files:
- app/parsers/defillama.py:51
- tests/repositories/test_rates_repository.py:20

## test_apy_values_not_divided_by_100 fails — borrow_apy is None (FIXED 2026-05-07)

Root cause: fixture used field name `apyBorrow`, but DeFi Llama's real
/lendBorrow API and the parser both use `apyBaseBorrow`. Fixed by
updating tests/fixtures/defillama_lendborrow.json.

## Morpho Blue floods the table with vault-named "stablecoins"

After enabling `stablecoin: true` filter for all whitelisted protocols,
Morpho Blue contributes ~200 unique "assets" with custom vault names
(`1337USDC`, `ALPHAFRAXUSDENHANCED`, `9SUSDC11CORE`, etc.). Each is a
bespoke USDC/USDT/DAI strategy, technically a stablecoin pool but
useless in a comparison dashboard. Options:
1. Drop morpho-blue from PROTOCOLS until Phase 2.
2. Add per-protocol asset whitelist back, only for morpho-blue.
3. Filter out symbols containing more than one stablecoin name or that
   match a noise regex.

Affected files:
- app/config/protocols.py
- app/parsers/defillama.py
