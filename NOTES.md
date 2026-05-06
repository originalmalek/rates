# Notes

## Settings rejects extra fields from .env (blocks tests that import app.main)

`app/config/settings.py` uses `SettingsConfigDict(env_file=".env")` without
`extra="ignore"`. The `.env` file contains keys (`MONGO_USER`, `MONGO_PASSWORD`,
`MONGO_APP_USER`, `MONGO_APP_PASSWORD`, `MONGO_URL`) that are not declared in
`Settings`, causing a `ValidationError` at import time. This prevents any test
that imports `app.main` from collecting. Fix: add `extra="ignore"` to
`SettingsConfigDict`.

Affected files:
- app/config/settings.py

## datetime.utcnow() deprecation (Python 3.12)

`datetime.utcnow()` is deprecated in Python 3.12+. The SKILL.md spec requires UTC
naive datetimes for the MongoDB time-series timeField. Until the spec is updated to
allow timezone-aware datetimes, we keep `utcnow()`. Future fix: switch to
`datetime.now(UTC).replace(tzinfo=None)` after confirming Motor / MongoDB accept it.

Affected files:
- app/parsers/defillama.py:51
- tests/repositories/test_rates_repository.py:20

## test_apy_values_not_divided_by_100 fails — borrow_apy is None (pre-existing)

`tests/parsers/test_defillama.py::test_apy_values_not_divided_by_100` asserts
`aave_usdc.borrow_apy == 6.41`, but the parser returns `None`. The lendBorrow
join by pool ID is not populating `borrow_apy` from the fixture data. This was
failing before Docker support was added.

Affected files:
- app/parsers/defillama.py (borrow_apy join logic)
