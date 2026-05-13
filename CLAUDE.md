# Project: DeFi Stablecoin Rates Monitor

Web dashboard tracking lending/borrowing rates on DeFi protocols.
AAVE v3 is collected from **all 15 chains** where it deploys
(Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, BNB, Gnosis,
Linea, Mantle, Celo, Sonic, Aptos, MegaETH, Plasma). The other
protocols (Fluid, Compound v3, Morpho Blue, Spark, Sky-lending) stay
on Ethereum for now. Stablecoin filtering uses DeFi Llama's
`stablecoin: true` flag, so bridged (`USDC.E`), synthetic (`USDE`,
`sUSDE`) and yield-bearing variants flow in automatically.

## Stack
- Backend: Python 3.12, FastAPI, Motor (async MongoDB), httpx, APScheduler
- DB: MongoDB 7+ with time-series collections
- Cache: Redis 7 (alpine in compose) for read-through API caching
- Frontend: Next.js 16, TypeScript, Tailwind, Recharts
- Package manager: project venv at `.venv/` (Python), pnpm (Node)

## Commands
Run Python tools through the project venv (uv is not installed for
the `sergey` user — `.venv/bin/python -m <tool>` is the canonical form).

- Worker: `.venv/bin/python -m app.worker`
- API: always on port 8000 — `fuser -k 8000/tcp 2>/dev/null; sleep 1 && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Tests: `.venv/bin/python -m pytest tests/ -v`
- Type check: `.venv/bin/python -m mypy app/`
- Frontend dev: `pnpm dev` (in `web/`)
- Frontend build: `pnpm build` (in `web/`)
- Frontend prod start: `pnpm start` (in `web/`) — serves the latest `.next/` build
- Infra (MongoDB + Redis): `docker compose up -d` (from project root)

## Architecture rules
- All MongoDB access goes through `app/repositories/`. No direct
  Motor calls in services or API handlers.
- All Redis access goes through `app/cache.py` (`make_key`,
  `get_or_set`). Routes wrap their repo call in `get_or_set(...)`;
  the worker invalidates + re-warms cache keys after every insert.
- Pydantic v2 for all DTOs. No raw dicts crossing layer boundaries.
- API handlers call services only — no business logic in handlers.
- Each protocol has its own parser in `app/parsers/<protocol>.py`
  with a uniform `parse() -> list[RateSnapshot]` interface.
- Frontend filter state lives in URL search params. Hooks
  (`useRates` / `useHistory`) translate the active filter sets to
  CSV query params; "all selected" sends no param. A `cancelled`
  flag in each effect's closure discards stale in-flight responses
  when the URL changes.

## Data model (do not change without updating SPEC.md)
- Collection `rate_snapshots` is a time-series collection:
  timeField=ts, metaField=meta, granularity=minutes
- Document shape: see @.claude/skills/mongodb-timeseries/SKILL.md

## Testing
- Each parser has snapshot tests in tests/parsers/ using fixed
  JSON fixtures (never hit real APIs in tests).
- Mock httpx with respx.
- Repository tests use mongomock-motor.

## Gotchas
- DeFi Llama API: no auth, ~30 req/min, single /pools call gives
  everything we need per cycle.
- APY normalization: DeFi Llama already returns percent (5.2 = 5.2%).
  Some on-chain sources return decimals — always normalize to percent
  in parser layer.
- Some protocols (Spark, Sky) may report only supply, no borrow.
  Treat missing fields as None, not 0.

## FastAPI coding rules
See @FASTAPI_RULES.md

## Workflow
- Always run typecheck and tests before considering a task done.
- Don't add features beyond what's in the current milestone.
- If you find an unrelated bug, note it in NOTES.md, don't fix it.
