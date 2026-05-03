# Project: DeFi Stablecoin Rates Monitor

Web dashboard tracking lending/borrowing rates on DeFi protocols
(AAVE v3, Fluid, Compound v3, Morpho Blue, Spark, Sky/sUSDS) for
USDC, USDT, DAI on Ethereum (later: Arbitrum, Base, Optimism).

## Stack
- Backend: Python 3.12, FastAPI, Motor (async MongoDB), httpx, APScheduler
- DB: MongoDB 7+ with time-series collections
- Frontend: Next.js 15, TypeScript, Tailwind, Recharts
- Package manager: uv (Python), pnpm (Node)

## Commands
- Worker: `uv run python -m app.worker`
- API: `uv run uvicorn app.main:app --reload`
- Tests: `uv run pytest tests/ -v`
- Type check: `uv run mypy app/`
- Frontend dev: `pnpm dev` (in /web)
- Frontend build: `pnpm build` (in /web)

## Architecture rules
- All MongoDB access goes through `app/repositories/`. No direct
  Motor calls in services or API handlers.
- Pydantic v2 for all DTOs. No raw dicts crossing layer boundaries.
- API handlers call services only — no business logic in handlers.
- Each protocol has its own parser in `app/parsers/<protocol>.py`
  with a uniform `parse() -> list[RateSnapshot]` interface.

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

## Workflow
- Always run typecheck and tests before considering a task done.
- Don't add features beyond what's in the current milestone.
- If you find an unrelated bug, note it in NOTES.md, don't fix it.
